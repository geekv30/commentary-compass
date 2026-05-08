---
name: paper-discovery-guide
description: Stage 0 of the Examlly ingestion pipeline. Discover a PYQ / textbook PDF's shape (exam identity, subject boundaries, per-question taxonomy, answer key) and emit `taxonomy.json` — a single machine-readable plan the rest of the pipeline consumes. Use when the orchestrator provides one PDF path and asks for a fully-classified plan ready for Stage 1 extraction.
allowed-tools:
  - Read
  - Bash
  - Write
---

# Paper Discovery — Skill

Stage 0 of the ingestion pipeline. Takes one PDF, does the heavy comprehension work once so that Stage 1 is pure transcription:

1. Identify exam / year / paperCode.
2. Detect subject boundaries and per-question page ranges.
3. Look up `subjectId` per subject + candidate `chapters` / `topics` from the taxonomy DB.
4. Classify each question against the candidate lists — assigns `chapterId` and (optionally) `topicId` per question.
5. Parse the answer-key pages at the end of the PDF — assigns `correctOption` per question (null when the key is missing or unreadable).
6. Write `taxonomy.json` at the paper root.

Stage 1 consumes the per-question entries and only transcribes the stem + options — no solving, no classification.

---

## Inputs from the orchestrator

- **PDF path** — absolute filesystem path.
- **Optional exam hint** — one-line hint like "NEET 2025" if the header is ambiguous. Usually omitted.

Keep PDF reads minimal: cover, section headers, answer-key pages, and one pass over each question for classification.

---

## What to detect

### 1. Exam identity (from the cover / first-page header)

- `examType` — `neet` | `jee_mains` | `jee_advanced` (from header wording: "NEET (UG)", "JEE Main", "JEE Advanced").
- `year` — four-digit year.
- `paperCode` — shift / date / set code (e.g. `Shift-1-April-8`). If absent, emit empty string and flag it in the summary.

### 2. Subject boundaries

PYQ papers use section dividers — `PHYSICS`, `CHEMISTRY`, `BIOLOGY` (NEET collapses `BOTANY` + `ZOOLOGY` into the single `biology` subject code), `MATHEMATICS`. For each section capture the page range and Q-number range. For mixed-subject pages, split by printed Q-number, not by page.

### 3. Taxonomy lookup

For each detected subject, query the local taxonomy DB:

```bash
pnpm --filter @examlly/db exec supabase db query \
  "select id, code, name from subjects where code = 'physics'" 2>/dev/null
```

Then load the full chapter + topic tree for the subject so you can classify questions against it:

```bash
pnpm --filter @examlly/db exec supabase db query \
  "select c.id as chapter_id, c.name as chapter_name,
          t.id as topic_id,   t.name as topic_name
   from chapters c
   left join topics t on t.chapter_id = c.id
   where c.subject_id = <subjectId>
   order by c.sort_order, t.sort_order" 2>/dev/null
```

Seed reference data is loaded by `0002_seed-reference-data.sql` on `make db-reset`, so taxonomy rows are always present locally.

### 4. Per-question taxonomy classification

For each question in the PDF, pick the best-matching `chapterId` from that subject's candidates. Assign `topicId` **only when the question's subject matter clearly maps to a single topic** — otherwise leave it null. Topics are a soft signal; getting them wrong is worse than leaving them empty.

**Batching:** if the paper has ~20 questions or fewer, classify them sequentially in this same skill run. For larger papers (NEET: 180 questions), the orchestrator dispatches 8-way parallel classifier agents — each classifier is a separate invocation of this skill with a narrower scope. Work with whichever slice the orchestrator hands you.

Classifier inputs per Q: the question stem + options (read from the PDF pages), plus the candidate chapter / topic list for the subject. Output: `{nnn, questionNumber, pages, subjectId, chapterId, topicId}`.

### 5. Answer-key extraction

PYQ papers print an answer key in the appendix — usually the last 1–3 pages. The key is typically a table keyed by question number. Parse it:

```
Q.1 — B       Q.2 — D       Q.3 — A
Q.4 — A       Q.5 — B, D    ...
```

For each question in the key, set `correctOption`:

- `"A" | "B" | "C" | "D"` for `mcq_single`.
- `["A","C"]` or `"A,C"` (your choice, as long as it's a list of letters) for `mcq_multi`.
- The question's `answer` field for `numerical` (if the key prints it; otherwise null).
- A mapping object for `matrix_match` if the key prints one; otherwise null.
- **`null` for any question missing from the key** or ambiguous. Stage 1 will emit all `isCorrect: false`; Stage 3 (solution authoring) will set the flag when solving.

If the PDF has no answer key at all (e.g. a textbook), skip this stage entirely — every question gets `correctOption: null`.

### 6. Paper source block

Build a bare `importBatchSourceSchema` value for the `source` field:

```json
{ "type": "pyq", "exam": "neet", "year": 2025, "paperCode": "Code-45" }
```

Use `type: "pyq"` for PYQ papers; `type: "book"` with `bookName` (+ optional `edition`) for textbook ingests.

---

## File to write

`data/<paper-slug>/taxonomy.json` — a single file. No per-subject splits, no separate `source.json`. Shape:

```json
{
  "paperSlug": "neet-2025",
  "pdfPath": "/abs/path/to/neet-2025.pdf",
  "source": {
    "type": "pyq",
    "exam": "neet",
    "year": 2025,
    "paperCode": "Code-45"
  },
  "subjects": [
    { "code": "physics", "subjectId": 1 },
    { "code": "chemistry", "subjectId": 2 },
    { "code": "biology", "subjectId": 3 }
  ],
  "questions": [
    {
      "nnn": "001",
      "questionNumber": 1,
      "pages": [1, 1],
      "subjectId": 1,
      "chapterId": 12,
      "topicId": 42,
      "correctOption": "B"
    },
    {
      "nnn": "002",
      "questionNumber": 2,
      "pages": [1, 2],
      "subjectId": 1,
      "chapterId": 15,
      "topicId": null,
      "correctOption": null
    }
  ]
}
```

`paperSlug` is derived from the detected `{examType}-{year}` (e.g. `neet-2025`). If that slug is already in use, append the paper code (`neet-2025-code-45`).

**Heuristic for page ranges**: do not `Read` every page of a 100-question paper — expensive. For fixed layouts (2 or 3 questions per page), compute pages from Q-number. For variable layouts, read the first page of each subject to confirm the first few Q positions, then interpolate. When unsure, widen the range by ±1 page — Stage 1 re-reads cheaply.

---

## Discovery summary (response to orchestrator)

Return a Markdown block verbatim to the orchestrator:

```markdown
## Discovery summary

**Paper:** NEET 2025 (Code-45)
**PDF:** /abs/path/to/neet-2025.pdf
**Paper slug:** `neet-2025`
**Source:** `{ type: pyq, exam: neet, year: 2025, paperCode: "Code-45" }`

### Subjects

| Subject   | subjectId | Pages | Q-range    | Count |
| --------- | --------- | ----- | ---------- | ----- |
| physics   | 1         | 1–12  | Q.1–Q.45   | 45    |
| chemistry | 2         | 13–24 | Q.46–Q.90  | 45    |
| biology   | 3         | 25–48 | Q.91–Q.180 | 90    |

### Classification

- 180 / 180 questions classified with a chapter.
- 124 / 180 questions classified with a topic (rest left null — ambiguous).
- 178 / 180 questions have a `correctOption` from the answer key.
- Missing `correctOption`: Q.73, Q.112 (answer-key print illegible).

### Output

- `data/neet-2025/taxonomy.json`

### Warnings / notes

_(list any ambiguities: missing paperCode, unclear subject boundary, NEET Botany+Zoology collapsed to biology, chapter classification confidence concerns, etc. Empty list is fine.)_
```

---

## Failure modes

- **Unreadable header** and no operator hint → `UNSOLVABLE: cannot determine examType/year from PDF header, please supply a hint`.
- **Mixed paper** (multiple papers concatenated) → `UNSOLVABLE: PDF contains multiple papers — split before re-running`.
- **Taxonomy miss** (subject not seeded for this exam) → `UNSOLVABLE: subject <name> not found in taxonomy for exam <type>`.

Do not guess IDs. Do not extract question text into files — that is Stage 1's job. The only writes this skill makes are to `taxonomy.json`.

---

## Final instructions

- Return the discovery summary as your final response (Markdown, under 400 words).
- Write exactly one file: `data/<paper-slug>/taxonomy.json`.
- Do not touch files outside `data/<paper-slug>/`.
- Do not populate `questions/` or `solutions/` directories — Stage 1 and Stage 3 do that.
