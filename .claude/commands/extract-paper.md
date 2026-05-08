# Extract Paper

Parse a PYQ or textbook PDF, extract every question into `questions/q-NNN.json` drafts, merge per paper, and ingest into the Examlly question bank. Solutions are authored separately by `/author-solutions` after this finishes.

## Skills Used

| Skill                                                                 | Stage                       |
| --------------------------------------------------------------------- | --------------------------- |
| [paper-discovery-guide](../skills/paper-discovery-guide/SKILL.md)     | 0 — discover + classify     |
| [extract-questions-guide](../skills/extract-questions-guide/SKILL.md) | 1 — transcribe per-question |

## Agent Used

| Agent                           | Purpose                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| [teacher](../agents/teacher.md) | Runs every skill above. Orchestrator dispatches one teacher sub-agent per question for Stage 1. |

## Required Input

- **PDF path**: `$ARGUMENTS` — absolute path to the PYQ / textbook PDF.

If no path is provided, ask the user for one. Reject non-PDF inputs.

## Flow

```
+----------------------------------------+
|     /extract-paper <pdf-path>          |
+-------------------+--------------------+
                    |
                    v
+----------------------------------------+
| Stage 0: Discovery (multi-step)        |
|  a) exam / year / subjects             |
|  b) taxonomy DB lookup                 |
|  c) 8-way parallel classifier agents   |
|     → chapter/topic per question       |
|  d) answer-key parser                  |
|     → correctOption per question       |
|  → taxonomy.json at paper root         |
+-------------------+--------------------+
                    |
                    v
+----------------------------------------+
|    Pause: show discovery summary       |
|    Wait for operator confirmation      |
+-------------------+--------------------+
                    |
                    v
+----------------------------------------+
| Stage 1: Transcribe per question       |
|  batches of 8 teacher sub-agents       |
|  each runs extract-questions-guide     |
|  consumes pre-classified entries       |
|  writes questions/q-NNN.json           |
+-------------------+--------------------+
                    |
                    v
+----------------------------------------+
| Stage 2: Merge + validate + ingest     |
|  single batch per paper                |
|  echo API URL, confirm, ingest         |
+-------------------+--------------------+
                    |
                    v
+----------------------------------------+
|            Final report                |
+----------------------------------------+
```

---

## Execution

### Phase 0: Parse input

1. Read `$ARGUMENTS`. Extract the PDF path.
2. If empty or not a `.pdf` filepath that exists on disk, ask the user for a valid path and wait.
3. Resolve the path to an absolute path. Confirm readability with `ls -la <path>`.

### Phase 1: Stage 0 — Discovery (multi-step)

**Do NOT extract questions here.** The goal is to produce `taxonomy.json` — a complete per-question plan that Stage 1 consumes verbatim.

Spawn **one** teacher sub-agent to run `paper-discovery-guide` end-to-end:

```
Agent(
  subagent_type: "teacher",
  description: "Stage 0 discovery for <pdf-basename>",
  prompt: """
  Run the paper-discovery-guide skill on this PDF end-to-end.

  PDF: <absolute path>
  Output: data/<paper-slug>/taxonomy.json (slug derived by the skill)

  Produce a fully-classified taxonomy.json:
  - Exam identity (examType, year, paperCode).
  - Subject boundaries + per-question page ranges.
  - Per-question chapter + optional topic (from the taxonomy DB).
  - Per-question correctOption from the answer-key appendix (null if missing).

  For papers >20 questions you may dispatch your own 8-way parallel classifier
  agents — paper-discovery-guide documents the slicing strategy. Return the
  discovery summary as your final response.
  """
)
```

When the sub-agent returns:

1. Display the discovery summary to the operator verbatim.
2. Ask: **"Proceed with Stage 1 transcription?"** — wait for a yes.
3. If the operator says no, stop. The operator can edit `taxonomy.json` directly (e.g. fix a misclassified chapter) and re-invoke, or abandon.

### Phase 2: Stage 1 — Transcribe per question

Read `data/<paper-slug>/taxonomy.json`. It contains a flat `questions` array with per-question entries. Build a work queue of all entries.

Dispatch **batches of 8 in parallel**. Issue the 8 `Agent(...)` calls in a single assistant message; wait for all 8 completion notifications before dispatching the next batch.

Per work item:

```
Agent(
  subagent_type: "teacher",
  description: "Extract Q.<questionNumber> (<subjectCode>)",
  prompt: """
  Run the extract-questions-guide skill on this question.

  PDF: <absolute path to the paper PDF>
  PDF pages: <entry.pages>
  Pre-classified entry (consume verbatim, do not re-classify):
    examType: <from taxonomy.source.exam>
    subjectId: <entry.subjectId>
    chapterId: <entry.chapterId>
    topicId:   <entry.topicId>   (may be null)
    correctOption: <entry.correctOption>   (may be null)

  Output path: data/<paper-slug>/questions/q-<entry.nnn>.json

  Return OK on success or UNSOLVABLE: <reason> on failure.
  """,
  run_in_background: true
)
```

**Batch protocol:**

- Build a status map: `OK` / `UNSOLVABLE: <reason>` per question.
- On `UNSOLVABLE`: retry once with a widened page range (±1 page). If the second attempt also fails, add to a `deferred` list and continue — do not block the rest of the paper.

**After Stage 1 completes:** report the deferred list to the operator before moving to ingest.

### Phase 3: Stage 2 — Merge, validate, ingest

One-shot for the whole paper:

1. **Merge** all questions/\*.json into a single batch:

   ```bash
   pnpm --silent merge-batch /abs/path/data/<paper-slug> \
     > /abs/path/data/<paper-slug>/questions-batch.json
   ```

   The merger reads `taxonomy.json` for the `source` block and the flat `questions/` directory for per-question items.

2. **Validate** against `importQuestionsBodySchema`:

   ```bash
   pnpm --silent validate-import /abs/path/data/<paper-slug>/questions-batch.json
   ```

   On schema failure: stop. Show the Zod error. Do not ingest.

3. **Echo target API + confirm**:

   ```
   Target API:  <EXAMLLY_API_URL>
   Operator:    <EXAMLLY_OPERATOR_ID>
   Paper:       <paper-slug>
   Questions:   <count>
   Confirm ingest? [y/N]
   ```

4. **Ingest** as a single POST:
   ```bash
   pnpm --silent ingest-questions /abs/path/data/<paper-slug>/questions-batch.json
   ```
   Server returns `imported: <N>`. Mismatch vs `questions.length` → stop, surface the error.

### Phase 4: Report

```markdown
## Paper Ingested — <paper-slug>

### Stage 0 classification

- Chapter classified: <N> / <total>
- Topic classified: <N> / <total>
- Answer key parsed: <N> / <total> (rest will have isCorrect set during /author-solutions)

### Stage 1 transcription

- Extracted successfully: <N> / <total>
- Deferred (UNSOLVABLE): <list>

### Stage 2 ingest

- Imported: <N> questions as a single batch.

### Next step

Author solutions:

/author-solutions --paper <paperCode>
```

---

## Pause points (always wait for operator)

1. After Stage 0 discovery summary — before dispatching Stage 1.
2. Before the ingest POST — echo URL + operator id.
3. On any `validate-import` schema failure.
4. On any `ingest-questions` count mismatch.

## Errors and recovery

| Error                                | Handling                                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| PDF unreadable                       | Stop at Stage 0; ask operator for a correct path                                       |
| Discovery skill returns `UNSOLVABLE` | Show the reason; operator decides whether to retry with a hint                         |
| Stage 1 subagent crashes / times out | Retry once; if still failing, add to deferred list and continue                        |
| `ingest-questions` 5xx / timeout     | Transient; retry the same batch once, then stop and surface the error                  |
| `ingest-questions` 409               | A prior partial ingest left rows behind; ask operator whether to `make db-reset` first |

## Prerequisites

Before running this command, ensure:

- Local Supabase stack is up (`pnpm --filter @examlly/db exec supabase start`).
- Local API is on `:3002` (`pnpm dev:api`).
- `poppler-utils` is installed on the host — `make operator-setup` (one-time). `pnpm crop-figure` shells out to `pdftoppm` + `pdfinfo`.
- `.env` has `EXAMLLY_API_URL`, `EXAMLLY_API_SERVICE_KEY`, `EXAMLLY_OPERATOR_ID` set for the intended target environment.

The compile service on `:3003` is **not** required for this command — questions are ingested with image-first diagrams (no TeX compilation at ingest time). It's only needed later for AI-generated content.
