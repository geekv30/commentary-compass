---
name: extract-questions-guide
description: Stage 1 of the Examlly ingestion pipeline. Transcribe one exam question from a PDF page into a bare importQuestionItemSchema JSON item. Consumes a pre-classified entry from taxonomy.json (examType, subjectId, chapterId, optional topicId, optional correctOption). No chapter guessing, no solving — pure transcription.
allowed-tools:
  - Read
  - Bash
  - Write
  - Edit
---

# Extract Questions — Skill

Takes a **single** exam question from PDF pages plus a metadata block, produces a bare `importQuestionItemSchema` item, writes it to the orchestrator-supplied draft path.

> **One question per invocation.** Multi-question batches force compression and lose diagram fidelity.

---

## Role

You extract **one** exam question from a PDF page range into a strictly-typed JSON item. Output is ingested by bank curators; emit **only** the JSON — no prose, no Markdown fence around the outer object, no commentary.

---

## Inputs from the orchestrator

Stage 0 (`paper-discovery-guide`) has already written `taxonomy.json` with a per-question entry. The orchestrator hands you one entry plus the PDF path. Per work item:

- **PDF path** — absolute filesystem path to the source PDF.
- **PDF page range** — the `pages` field from the entry. Use `Read` tool's `pages` argument.
- **Classified taxonomy** — `{examType, subjectId, chapterId, topicId?, correctOption?}` from Stage 0. Do **not** classify yourself; consume these as-is.
- **Draft output path** — typically `data/<paper>/questions/q-NNN.json`.

### What `correctOption` means for you

- `"A" | "B" | "C" | "D"` — the PDF's answer key says this letter is correct. For `mcq_single`, emit exactly that option with `isCorrect: true` and the rest `false`.
- Array of letters, e.g. `["A","C"]` — for `mcq_multi`, flip those options true, rest false.
- `null` — no answer key was found for this question. Emit **all options with `isCorrect: false`**. The schema accepts zero-correct MCQ; Stage 3 (solution authoring) sets the correct option later.
- For `numerical` / `matrix_match`, Stage 0 may populate the answer differently — treat the taxonomy field as the source of truth when present.

---

## Task

1. Read the question in the attached PDF pages (use the `pages` range from the entry).
2. Assign a fresh v4 UUID to `id`.
3. Classify `questionType`:
   - `mcq_single` — four options, typically one correct in the answer key (if available).
   - `mcq_multi` — four options, typically two or more correct.
   - `numerical` — the answer is a number, no options.
   - `matrix_match` — two columns to be matched.
4. Assign `difficulty` (`easy` / `medium` / `hard`) based on conceptual depth, not length.
5. Populate `questionContent` in the shape matching `questionType` (see [JSON schema](#json-schema) below; authoritative source: `QuestionContentSchema` in `packages/db/src/validators/question-content.ts`).
6. Set `isCorrect` per option **from the `correctOption` input** — do not solve the question yourself.
7. Copy `examType` / `subjectId` / `chapterId` / `topicId` verbatim from the entry. Do not re-classify.
8. Copy `questionNumber` from the PDF if visible (e.g. "Q.12"). Copy `pageNumber` if visible.
9. Emit the **bare** item — a single `importQuestionItemSchema` object — directly to the draft path using the `Write` tool.
10. Skip "instructions to candidates" / "section headers" — only the actual question.

### Stop-and-ask clauses

If any of these hold, respond with `UNSOLVABLE: <one-line reason>` and do **not** emit placeholders:

- Attached pages contain more than one question, or more than one subject / exam / source.
- The question type is unclassifiable (e.g. requires a free-response essay).
- The entry's `questionType` (from Stage 0 or inferred here) does not match what the pages actually contain (Stage 0 made a classification error — flag, don't patch).

---

## Diagrams — image-first ingest

You do **not** author `.tex` for imported figures. When the PDF contains a figure essential to the question (circuit topology, structural formula, graph referenced by "curve shown", ray construction with marked angles, pedigree, etc.), crop the figure directly out of the source PDF and upload it as-is. The rest of the pipeline renders the uploaded SVG unchanged.

Per figure in the source PDF:

1. **Report the bounding box** in fractional page coordinates: `x,y,w,h` where each value is in `[0,1]`. The origin `(0,0)` is the top-left of the page; width and height are fractions of the full page. Include the PDF page number the figure appears on.

   **Tight fit required.** The bbox must enclose **only the figure's geometry** (lines, curves, atoms, bonds, pedigree nodes, waveforms, etc.). Exclude:
   - Question number (`Q.82`, `(41)`, etc.) — outside the bbox, even if it sits flush against the diagram
   - Caption text / figure label (`Fig. 3`, `as shown below`) — outside
   - Option labels (`(a)`, `(b)`) — outside unless they are literally _inside_ the figure's lines
   - Surrounding whitespace — trim to the visible ink
   - Adjacent paragraph text from the next question — **especially check this on dense DPP / book pages where questions are packed close**

   There is **no automatic padding** — the crop matches the bbox you report.

2. **Crop + preview** with the standalone script:

   ```bash
   pnpm crop-figure \
     --pdf <absolute path to the source PDF you are extracting from> \
     --page <page number> \
     --bbox <x,y,w,h> \
     --preview-png /tmp/fig-<key>-preview.png \
     --out /tmp/fig-<key>.svg
   ```

   Default DPI is 300. Pass `--pad 0.005` only if the figure's ink touches the bbox edge and you need a thin visual margin; keep `--pad 0` otherwise.

3. **Verify the preview.** Read `/tmp/fig-<key>-preview.png` with your vision. Aim for a preview that contains **only** the figure — no question number, no caption, no neighbouring-question text, no speckles of unrelated ink.

   If the preview is loose, narrow the bbox and re-run step 2 (use an `_v2`, `_v3` suffix on the preview path). Cap at **2 retries** (3 crops total) per figure.

   **Never emit `UNSOLVABLE` because a crop is imperfect.** After the cap — or if further retries are not visibly improving the crop — ship the tightest attempt so far. A small amount of stray text, a partial adjacent character, or a thin rule line is acceptable; the operator can re-crop and swap the DB hash later. `UNSOLVABLE` is reserved for structural failures (wrong page, figure not present, page rendering failed) — not bbox precision.

4. **Upload** and receive the content-addressed hash:

   ```bash
   pnpm upload-svg /tmp/fig-<key>.svg
   ```

   stdout is a single JSON line: `{"hash":"...","publicUrl":"...","cached":true|false}`. Parse and capture the `hash`.

5. **Emit the `diagrams` entry** with `source: null`, the received `hash`, and `status: "stored"`:

   ```json
   "diagrams": {
     "stem": {
       "description": "<one- or two-sentence plain-language summary of what the figure shows; enumerate every label and value>",
       "source": null,
       "hash": "<hash from step 4>",
       "status": "stored",
       "error": null
     }
   }
   ```

The `description` still matters — it's used as SVG alt text for accessibility and by the reconcile skill for fidelity checks. Enumerate every component, label, value, and connectivity as you would if you were authoring the figure; don't summarize.

Decorative cartoons and photos — skip; describe in the stem prose instead.

### Diagram tokens

Reference a diagram inline with `{{diagram:key}}`. Allowed positions by question type:

| Question type              | Valid token fields                                     |
| -------------------------- | ------------------------------------------------------ |
| `mcq_single` / `mcq_multi` | `stem`, each `options[i].text`                         |
| `numerical`                | `stem`                                                 |
| `matrix_match`             | `stem`, each `columnA[i].text`, each `columnB[i].text` |

Keys match `^[a-z][a-zA-Z0-9_]*$`. Conventional names: `stem` (a single figure in the stem), `optA`/`optB`/`optC`/`optD` (per MCQ option), `colA_P`/`colB_1` (matrix-match cells, label as suffix). Every token must resolve to a key in the `diagrams` map and every key must be referenced by at least one token — the server checks both directions.

**Tail-placement rule (questions & options).** In every question-side text field (`stem`, `options[i].text`, `columnA[i].text`, `columnB[i].text`), the `{{diagram:key}}` token must be the **final non-whitespace content** — no prose, punctuation, or sub-expression may follow it. Questions and options render images **after** their text; inline mid-text figures are not allowed here. If the PDF shows the figure mid-sentence, restructure the prose so the figure trails the text, then emit the token at the end.

Multiple tokens at the end are fine (`... shown in the circuit. {{diagram:stem}} {{diagram:inset}}`). Solutions are exempt — author-solution-guide may place diagram tokens anywhere inside a solution's `explanation` steps.

```
✓ "A resistor network is shown below. Find R_eq between A and B. {{diagram:stem}}"
✗ "A resistor network {{diagram:stem}} is shown above. Find R_eq between A and B."
```

---

## JSON schema

The output is a **single bare `importQuestionItemSchema` object**. `questionType` (camelCase, outer) and `questionContent.question_type` (snake_case, inner) must be identical; desync fails the discriminated union with an opaque error. `topicId` is optional — omit the key entirely if unset; never set it to `null`.

Outer shape:

```json
{
  "id": "<v4 uuid>",
  "examType": "jee_mains",
  "subjectId": 12,
  "chapterId": 87,
  "questionType": "mcq_single",
  "difficulty": "medium",
  "questionContent": {
    /* one of the four shapes documented by QuestionContentSchema */
  },
  "questionNumber": 12,
  "pageNumber": 3
}
```

### Example: `mcq_single` with a stem diagram

<!-- validate: importQuestionItemSchema -->

```json
{
  "id": "7c1a5b2e-3d9f-4a0c-b5e8-2f4d9a6c1b73",
  "examType": "jee_mains",
  "subjectId": 12,
  "chapterId": 87,
  "questionType": "mcq_single",
  "difficulty": "medium",
  "questionContent": {
    "question_type": "mcq_single",
    "stem": "The galvanometer reads zero in the circuit shown. Find $R_x$ in ohms. {{diagram:stem}}",
    "options": [
      { "label": "A", "text": "$4.0$", "isCorrect": false },
      { "label": "B", "text": "$5.0$", "isCorrect": true },
      { "label": "C", "text": "$6.0$", "isCorrect": false },
      { "label": "D", "text": "$8.0$", "isCorrect": false }
    ],
    "diagrams": {
      "stem": {
        "description": "Wheatstone bridge: R_1 = 10 ohms between A and B, R_2 = 5 ohms between B and C, R_3 = 10 ohms between A and D, R_x between D and C. 12 V battery across A to C; galvanometer between B and D.",
        "source": null,
        "hash": "a3f1b8c9d4e2f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5",
        "status": "stored",
        "error": null
      }
    }
  },
  "questionNumber": 12
}
```

Text-field content is Markdown + embedded LaTeX: `$...$` for inline math, `$$...$$` for display math, `\ce{H2SO4}` for chemistry formulas (inside math mode). `1. ... 2. ...` for numbered multi-part stems.

---

## Enum reference

| Field                            | Valid values                                           |
| -------------------------------- | ------------------------------------------------------ |
| `examType`                       | `neet`, `jee_mains`, `jee_advanced`                    |
| `questionType` / `question_type` | `mcq_single`, `mcq_multi`, `numerical`, `matrix_match` |
| `difficulty`                     | `easy`, `medium`, `hard`                               |
| MCQ `options.label`              | exactly `A`, `B`, `C`, `D` — in order, always four     |

---

## Final instructions

- Produce exactly **one** bare `importQuestionItemSchema` item for the one attached question. Fresh v4 UUID.
- **Write the JSON directly to the draft path** the orchestrator gave you (`Write` tool). Valid JSON — no trailing comma, no Markdown fence, no commentary.
- Respond to the orchestrator with **only** `OK` on success or `UNSOLVABLE: <one-line reason>` on failure. Do not repeat the JSON you wrote.
