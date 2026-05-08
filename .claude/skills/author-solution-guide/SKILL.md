---
name: author-solution-guide
description: Author one teaching-grade, step-by-step solution for a single exam question into a strictly-typed bare importSolutionItemSchema JSON item. Use when the orchestrator provides a question's UUID and full questionContent (from a q-NNN.json draft or a DB row) and asks for a single s-NNN.json draft.
allowed-tools:
  - Read
  - Bash
  - Write
  - Edit
  - Skill
---

# Author Solution — Skill

Takes **one** exam question and produces a bare `importSolutionItemSchema` item, written to the orchestrator-supplied draft path.

> **One question per invocation.** Multi-question batches force the model to compress steps to fit one tool-call output budget — exactly the failure mode that produced dense, formatting-hostile solutions in the NEET 2025 corpus. One question, one full output budget.

---

## Role

You write the step-by-step solution for **one** exam question. The `solution` text's **end reader** is a learner — a teacher writing notes, or a student studying the question. Write so that reader can reconstruct _why_ each step is taken, not just follow the arithmetic. Emit **only** the JSON — no prose, no Markdown fence, no commentary.

---

## Inputs from the orchestrator

- **A single question** as a bare `importQuestionItemSchema` item (from a `q-NNN.json` draft or a DB row). Shape:

  ```json
  {
    "id": "<uuid>",
    "questionType": "mcq_single | mcq_multi | numerical | matrix_match",
    "questionContent": { ... }
  }
  ```

- **Draft output path** — typically `data/<paper-slug>/solutions/s-NNN.json`.

You must produce **exactly one** solution entry keyed by the question's `id` (which becomes `questionId` in the output). Do not invent a question, change the `id`, or output a solution for a different question — the import endpoint matches by UUID, and a mismatch is rejected with a 404 or 409.

---

## Task

1. Read the question's `questionContent` (stem, options, answer, etc.).
2. Work out the solution yourself — do not just restate the correct option.
3. Write a **teaching-grade, step-by-step** solution in the `solution` field following the [per-step pattern](#per-step-pattern) below. Conceptual context, wrong-option analysis, and common-pitfall notes belong inside the derivation itself.
4. Copy the question's `id` into `questionId`.
5. **Set `correctOption`** if and only if the input question is MCQ (`mcq_single` / `mcq_multi`) **and** every `options[*].isCorrect` is `false` — see [Setting correctOption](#setting-correctoption) below.
6. Emit the bare item `{ questionId, solutionContent, correctOption? }` directly to the draft path using the `Write` tool.

### Setting `correctOption`

Stage 0 (`paper-discovery-guide`) parses the PDF's answer-key appendix and bakes the letter(s) into the question at ingest. When that lookup fails (appendix missing, unreadable, or the question genuinely has no printed key), the question lands in the DB with every option flagged `isCorrect: false`. The `importSolutionItemSchema` carries an optional `correctOption` so solution authoring can close that gap atomically with the solution write — the server flips the matching option(s) to `true` in the same transaction.

Rules:

- **Emit `correctOption` only when required.** If any `options[*].isCorrect` is already `true`, omit the field entirely. Never overwrite a baked-in key — the server rejects overwrite attempts with `InvalidStateTransitionError`.
- **`mcq_single`** — exactly one letter, e.g. `"correctOption": "B"`.
- **`mcq_multi`** — array of at least two letters, e.g. `"correctOption": ["A", "C"]`.
- **`numerical` / `matrix_match`** — never emit `correctOption`; the correctness data lives in `answer` / `mappings` on `questionContent` itself.
- **Stay consistent with your derivation.** The letter you emit must match the option your solution concludes is correct. Disagreement is a bug — re-derive or respond `UNSOLVABLE` rather than guess.

---

## Required structure of the `solution` field

A good solution has three sections:

1. **Setup** — restate what's given and asked in your own words; introduce variables.
2. **Derivation** — one numbered step per logical move, each following the per-step pattern.
3. **Final answer** — on its own line (e.g. `**Answer:** $\pi/4$`). For MCQ, name the correct option letter. For numerical, the final line is the value with units.

### Per-step pattern

Every numbered step follows **concept → calculation**:

1. **Concept first.** One short paragraph (1–2 sentences) naming the law, theorem, identity, or physical principle applied. The reader should learn the concept from this paragraph, not just follow the arithmetic.
2. **One calculation per `$$…$$` block.** Formula, substitution, simplification, evaluation — each meaningful algebraic move gets its own display-math block. **Never chain substitutions with inline `=` across one line.**
3. **One step does one thing.** If a step does derivation + substitution + evaluation, split it.

Shape: **prose → display math → prose → display math → …**, never a wall of inline equations.

### Quality bar

- **No handwaving.** "Clearly" / "obviously" means you skipped a step.
- **No restating the stem verbatim.** Summarize in your own words in the Setup.
- **No ASCII diagrams.** If a figure is essential (free-body, ray construction, reaction mechanism, annotated stem), emit a `.tex` diagram — see hard rules below.
- **Show work.** Do not jump to the final number.
- **Simplest correct method.** Elementary technique when it suffices.

---

## Content format

The `solution` field is **Markdown with embedded LaTeX**: `$x^2$` for inline math, `$$\int_0^1 x\,dx$$` for display math, `\ce{H2SO4}` for chemistry formulas (inside math mode), `**Step 1:** ...` for bold step headers.

---

## Diagrams — hard rules

Default to text-only solutions. A diagram is essential only when the step depends on a figure that prose + math cannot convey: free-body / force diagram, ray or geometric construction, reaction mechanism with arrow pushing, annotated graph (shaded region, tangent), annotated re-render of a stem figure.

**Before writing any `.tex` source, invoke the `diagram-contract` skill for the full contract** (package stack, boilerplate, worked examples, style conventions). These hard rules always apply:

- **`\documentclass[border=2pt]{standalone}` only.** No other class.
- **Packages whitelisted**: `tikz`, `circuitikz`, `chemfig`, `pgfplots`, `siunitx`, `amsmath`, `pst-pdgr`. Nothing else.
- **No color**. No `\color`, `\textcolor`, `\colorbox`, no named colors (`red`, `blue`, `green`, `orange`, `yellow`, `purple`, `cyan`, `magenta`, `brown`, `violet`, `teal`, `pink`, `lime`, `olive`). Only `black`, `black!XX`, `gray` shades. Distinguish by line style, weight, patterns, labels.
- **No shell escape**. No `\input`, `\include`, `\write18`, `fontspec`. ASCII source only (`\degree`, `\pi`, `\alpha`).
- **JSON escape**: every `\` doubles to `\\`, newlines become `\n` inside the JSON `source` string.
- **Compile-test** every `.tex` against `http://localhost:3003/compile` before emit; must return 200 with `{"svg": ...}`.

### Solution diagrams are a separate namespace

`{{diagram:key}}` tokens in `solutionContent.solution` resolve against `solutionContent.diagrams` **only**. Question-phase keys under `questionContent.diagrams` cannot be reached by a token in the solution. If the solution needs a stem figure, emit a fresh entry under a new key in `solutionContent.diagrams` (same `.tex` source, or an annotated refinement). The compile service content-addresses SVGs, so duplication is free on disk.

Keys match `^[a-z][a-zA-Z0-9_]*$`. Conventional names: `fbd` (free-body diagram), `ray`, `step1`/`step2`/`mechanism`, `graph_annotated`, `stem_annotated`.

---

## JSON output shape

```jsonc
{
  "questionId": "<uuid from the input question>",
  "solutionContent": {
    "solution": "**Setup:** ...\n\n**Step 1 — …**\n\n$$...$$\n\n**Answer:** ...",
    "diagrams": {
      // optional; omit the key entirely if the solution is text-only
      "fbd": {
        "description": "...",
        "source": "\\documentclass[border=2pt]{standalone}\n...\n\\end{document}",
        "hash": null,
        "status": "pending",
        "error": null,
      },
    },
  },
  // optional; set only when the input MCQ has all options isCorrect=false.
  // Letter for mcq_single, array of letters for mcq_multi.
  "correctOption": "B",
}
```

### Worked example — text-only MCQ solution

<!-- validate: importSolutionItemSchema -->

```json
{
  "questionId": "e8b4c9f2-4a13-4d5e-9f1b-7c2a6d8e0f11",
  "solutionContent": {
    "solution": "**Setup:** Evaluate $\\int_0^{\\pi/2} \\sin^2 x \\, dx$.\n\n**Step 1 — Linearize $\\sin^2 x$ via the power-reduction identity.**\n\nThe integrand has no elementary antiderivative as a quadratic in $\\sin x$. The power-reduction identity rewrites it as a linear combination of $1$ and $\\cos 2x$, both of which integrate immediately:\n\n$$\\sin^2 x = \\frac{1 - \\cos 2x}{2}.$$\n\nSubstitute into the integral:\n\n$$\\int_0^{\\pi/2} \\sin^2 x \\, dx = \\int_0^{\\pi/2} \\frac{1 - \\cos 2x}{2} \\, dx.$$\n\n**Step 2 — Split by linearity.**\n\nConstants pull out; the integral of a sum is the sum of integrals:\n\n$$= \\frac{1}{2}\\int_0^{\\pi/2} 1 \\, dx - \\frac{1}{2}\\int_0^{\\pi/2} \\cos 2x \\, dx.$$\n\n**Step 3 — Antidifferentiate.**\n\nThe antiderivative of $1$ is $x$. The antiderivative of $\\cos 2x$ is $\\sin(2x)/2$ by the chain rule:\n\n$$= \\frac{1}{2}\\bigl[x\\bigr]_0^{\\pi/2} - \\frac{1}{4}\\bigl[\\sin 2x\\bigr]_0^{\\pi/2}.$$\n\n**Step 4 — Evaluate at the bounds.**\n\n$$= \\frac{1}{2} \\cdot \\frac{\\pi}{2} - \\frac{1}{4}(\\sin \\pi - \\sin 0)$$\n\n$$= \\frac{\\pi}{4} - 0.$$\n\n**Answer:** $\\pi/4$. Therefore, **option B** is correct. Worth remembering: $\\int_0^{\\pi/2} \\sin^2 x \\, dx = \\int_0^{\\pi/2} \\cos^2 x \\, dx = \\pi/4$, by symmetry of $\\sin^2$ and $\\cos^2$ over $[0, \\pi/2]$ combined with $\\sin^2 x + \\cos^2 x = 1$."
  }
}
```

---

## Final instructions

- Produce exactly **one** bare solution item `{ "questionId": ..., "solutionContent": ... }`. The output `questionId` must equal the input `id`.
- **Write the JSON directly to the draft path** (`Write` tool). Valid JSON — no trailing comma, no Markdown fence, no commentary.
- Respond to the orchestrator with **only** `OK` on success or `UNSOLVABLE: <one-line reason>` if the question is malformed or has no determinate answer. Do not produce a placeholder, do not repeat the JSON.
