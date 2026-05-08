# Author Solutions

Generate teaching-grade solutions for questions already in the Examlly bank, then ingest them. Reads candidate question UUIDs from the local DB, dispatches one teacher sub-agent per question running the author-solution-guide skill, compile-tests any diagrams, and PATCHes a single solutions batch back to the API.

Run this after `/extract-paper` has seeded questions, or any time the bank has questions with `solution_content IS NULL`.

## Skills Used

| Skill                                                             | Stage                            |
| ----------------------------------------------------------------- | -------------------------------- |
| [author-solution-guide](../skills/author-solution-guide/SKILL.md) | 3 — author one solution/question |

## Agent Used

| Agent                           | Purpose                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| [teacher](../agents/teacher.md) | Runs author-solution-guide. One sub-agent per question, dispatched in batches of 8. |

## Required Input

- **Filter**: `$ARGUMENTS` — optional. Selects which questions to author solutions for. Defaults to every question whose `solution_content IS NULL`.

```
Examples:
  /author-solutions                                # all with NULL solution
  /author-solutions --paper Code-45                # by source.paperCode
  /author-solutions --subject physics              # by subjects.code
  /author-solutions --exam neet --year 2025        # compound
  /author-solutions --where "q.exam_type='neet'"   # raw SQL escape hatch
```

## Flow

```
+----------------------------------------+
|   /author-solutions [filter args]      |
+-------------------+--------------------+
                    |
                    v
+----------------------------------------+
| Phase 0: Resolve candidates            |
|  pnpm query-questions <filter>         |
|  → list of {questionId, subject,       |
|     questionContent, paperCode}        |
+-------------------+--------------------+
                    |
                    v
+----------------------------------------+
|   Pause: show count + first 5 UUIDs    |
|   Wait for operator confirmation       |
+-------------------+--------------------+
                    |
                    v
+----------------------------------------+
| Phase 1: Author per question           |
|  batches of 8 teacher sub-agents       |
|  each runs author-solution-guide       |
|  writes s-NNN.json to solutions/       |
+-------------------+--------------------+
                    |
                    v
+----------------------------------------+
| Phase 2: Compile-test diagrams         |
|  POST every diagrams[*].source to      |
|  :3003/compile in parallel             |
|  Re-author failures (1 retry) or strip |
+-------------------+--------------------+
                    |
                    v
+----------------------------------------+
| Phase 3: Merge + validate + ingest     |
|  single batch per run                  |
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

### Phase 0: Resolve candidate questions

Build the filter flags from `$ARGUMENTS` and invoke the query script:

```bash
pnpm --silent query-questions <filter-flags> 2>/dev/null > /tmp/author-queue.json
```

Parse `/tmp/author-queue.json`. Each row:

```json
{
  "questionId": "<uuid>",
  "subject": "physics",
  "questionContent": { ... },
  "paperCode": "Code-45",
  "questionNumber": 12
}
```

**Derive the run directory:**

- If every row has the same `paperCode` and exactly one `data/*/taxonomy.json` on disk carries that `source.paperCode`, reuse that paper directory. Solutions land in `data/<paper-slug>/solutions/s-NNN.json` alongside the extraction drafts.
- Otherwise mint `data/author-runs/<yyyy-mm-dd-hhmmss>/` and write solutions to `<run-dir>/solutions/s-NNN.json`. No `taxonomy.json` is needed — `merge-batch --solutions` does not read it.

Pause and show the operator:

```
Solution-authoring queue:

  Total: 137 questions with solution_content IS NULL
  Physics:   42
  Chemistry: 44
  Biology:   51

  First 5 UUIDs:
    5fd2bc8a-… (physics, Q.12)
    7c1a5b2e-… (physics, Q.13)
    …

  Drafts target: data/neet-2025/solutions/s-NNN.json

  Proceed? [y/N]
```

Wait for confirmation. If the operator says no, exit.

### Phase 1: Author per question

**NNN derivation:** zero-padded 3-digit suffix from `questionNumber`. If `questionNumber` is absent, use the next free ordinal across the whole queue (not per subject — solutions share one flat directory).

**Batch protocol:** 8 teacher sub-agents in parallel. Issue the 8 `Agent(...)` tool calls in a single assistant message; wait for all 8 completion notifications before dispatching the next batch.

Per work item:

```
Agent(
  subagent_type: "teacher",
  description: "Author solution for Q.<questionNumber> (<subject>)",
  prompt: """
  Run the author-solution-guide skill.

  Question:
  {
    "id": "<questionId>",
    "questionType": "<inferred from questionContent.question_type>",
    "questionContent": <full JSON>
  }

  Output path: <run-dir>/solutions/s-<nnn>.json

  If every questionContent.options[*].isCorrect is false (MCQ only), emit the
  `correctOption` field in the bare item — see author-solution-guide §Setting
  correctOption. Otherwise omit it.

  Return OK on success or UNSOLVABLE: <reason> on failure.
  """,
  run_in_background: true
)
```

**On UNSOLVABLE:** retry once. If the second attempt fails, add to a deferred list and continue.

### Phase 2: Compile-test diagrams

After all authoring batches complete, walk every `<run-dir>/solutions/s-NNN.json` and compile-test each `solutionContent.diagrams[*].source` against `http://localhost:3003/compile`:

```bash
curl -sS -X POST http://localhost:3003/compile \
  -H 'Content-Type: application/json' \
  --data "$(jq -n --arg src "<tex source>" '{source: $src}')"
```

Expected: `{"svg": "..."}`. On failure (`{"error": {phase, stderr}}`):

1. Dispatch a single teacher sub-agent to re-author that specific diagram (reuse the author-solution-guide but scope the prompt to rewriting one `source` field in the existing `s-NNN.json`).
2. Re-compile. If the retry also fails, **strip the diagram and every `{{diagram:key}}` token that referenced it** from the solution's text, and flag the question for manual review.

Batch the compile-tests in parallel — 8 at a time for throughput.

### Phase 3: Merge + validate + ingest

Single batch for the whole run:

1. **Move deferred / flagged drafts aside** (`<run-dir>/solutions/.deferred/s-NNN.json`) so they don't enter the merge.
2. **Merge:**
   ```bash
   pnpm --silent merge-batch --solutions /abs/path/<run-dir> \
     > /abs/path/<run-dir>/solutions-batch.json
   ```
3. **Validate:**
   ```bash
   pnpm --silent validate-import --solutions /abs/path/<run-dir>/solutions-batch.json
   ```
   On schema failure: stop. Show the Zod error. Do not ingest.
4. **Echo target API + confirm:**

   ```
   Target API:  <EXAMLLY_API_URL>
   Operator:    <EXAMLLY_OPERATOR_ID>
   Run:         <run-dir basename>
   Solutions:   <count>
   correctOption patches: <N> (questions with all-false isCorrect → flipped via /import/questions/correct-option before solutions land)
   Confirm ingest? [y/N]
   ```

5. **Ingest:**
   ```bash
   pnpm --silent ingest-solutions /abs/path/<run-dir>/solutions-batch.json
   ```
   The script first PATCHes `/import/questions/correct-option[/global]` with the correctOptions array (if non-empty), then PATCHes `/import/solutions[/global]` with the solutions array. Each endpoint returns `updated: <N>`; any mismatch stops the script and surfaces the error.

### Phase 4: Report

```markdown
## Solutions Authored — <run-dir basename>

### Pipeline

| Subject   | Queue | Authored | Diagram-failed | correctOption set | Deferred | Ingested |
| --------- | ----- | -------- | -------------- | ----------------- | -------- | -------- |
| physics   | 42    | 42       | 1 (stripped)   | 3                 | 0        | 42       |
| chemistry | 44    | 43       | 0              | 0                 | 1        | 43       |
| biology   | 51    | 51       | 0              | 5                 | 0        | 51       |

### Deferred (not ingested)

| Subject   | QuestionId | Reason                                      |
| --------- | ---------- | ------------------------------------------- |
| chemistry | 5fd2bc8a-… | UNSOLVABLE: stem requires context not given |

### Next step

Deferred items remain with `solution_content IS NULL` in the DB. Re-run `/author-solutions` with a narrower filter to retry.
```

---

## When to Ask User

| Situation                           | Action                                           |
| ----------------------------------- | ------------------------------------------------ |
| Queue is empty                      | Tell operator "nothing to author" and exit       |
| Queue resolved, ready to author     | Show count + first 5 UUIDs, wait for "proceed"   |
| Any `UNSOLVABLE` after retry        | Defer and continue (no pause)                    |
| Diagram compile fails twice         | Strip diagram + flag (no pause; report in final) |
| About to POST to the API            | Echo URL + operator id, wait for "yes"           |
| `validate-import --solutions` fails | Stop. Show the Zod error. Do not ingest.         |
| Server `updated` count mismatches   | Stop. Do not retry blindly.                      |

## Errors and Recovery

| Error                                                        | Handling                                                                                                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm query-questions` returns empty                         | Report "no candidates" and exit gracefully                                                                                                                         |
| Teacher sub-agent crashes / times out                        | Retry once; if still failing, defer and continue                                                                                                                   |
| Compile service `:3003` unreachable                          | Stop at Phase 2; ask operator whether to skip diagram checks (risky)                                                                                               |
| `ingest-solutions` 409 on a question                         | `solution_content` already populated; ask operator whether to `NULL` it via SQL and retry                                                                          |
| `ingest-solutions` 422 on correctOption overwrite            | Question already has a correct option baked in; drop the `correctOption` field from the flagged drafts and re-run                                                  |
| Correct-option step succeeded, solutions step failed mid-run | Partial state is committed on the answer-key side. Edit drafts to drop correctOption for already-patched questions, then re-run to retry the solutions PATCH alone |
| `ingest-solutions` 5xx / timeout                             | Transient; retry the same batch once, then stop and surface the error                                                                                              |

## Prerequisites

Before running this command, ensure:

- Local Supabase stack is up.
- Local API is on `:3002`.
- Local compile service is on `:3003` (only needed if any solution authors a TeX diagram).
- Target questions already exist in the DB (the filter needs something to select).
- `.env` has `EXAMLLY_API_URL`, `EXAMLLY_API_SERVICE_KEY`, `EXAMLLY_OPERATOR_ID` set for the intended target environment.
