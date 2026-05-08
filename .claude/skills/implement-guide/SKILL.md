---
name: implement-guide
description: Plan and implement features directly without agent delegation. Combines architectural planning and implementation into a single-agent flow.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
  - Edit
  - Write
  - WebSearch
  - WebFetch
user-invocable: false
---

# Implement Guide

## Purpose

Plan and implement features in a single-agent flow. You handle both the architectural planning (normally done by Principal Architect) and the implementation (normally done by SDE2) directly.

## Base Rules

Always load and follow:

| Rule                                                                             | Purpose                                                                                    |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [code-quality.md](../../rules/code-quality.md)                                   | Governing principle: favor simplicity over cleverness; index to per-rule files             |
| [ripple-effect.md](../../rules/ripple-effect.md)                                 | A change isn't done until callers, callees, and adjacent code are consistently clean       |
| [parse-dont-narrow.md](../../rules/parse-dont-narrow.md)                         | zod at every boundary; never hand-roll `typeof` guards or `as` casts for runtime narrowing |
| [dont-duplicate-validation.md](../../rules/dont-duplicate-validation.md)         | Once parsed, FK-protected, or caller-gated — stop re-validating                            |
| [guard-clauses.md](../../rules/guard-clauses.md)                                 | Keep the happy path at column 0; exit early                                                |
| [composition-over-render-props.md](../../rules/composition-over-render-props.md) | `children` or per-mode components; never `renderItem` / `mode` discriminators              |
| [useeffect-escape-hatch.md](../../rules/useeffect-escape-hatch.md)               | Effects sync with external systems, not React state                                        |
| [logging-proportionality.md](../../rules/logging-proportionality.md)             | One dense canonical log line beats ten incremental ones                                    |
| [code-comments.md](../../rules/code-comments.md)                                 | Comment only non-obvious logic; no rationale blocks; TODOs require tracked issues          |
| [project-stage.md](../../rules/project-stage.md)                                 | Pre-production: no backcompat, no migration files; edit the three baseline files           |
| [docs-mcp.md](../../rules/docs-mcp.md)                                           | MANDATORY: query examlly-docs-mcp for any third-party API; do not guess from memory        |
| [github.md](../../rules/github.md)                                               | PR title/body templates, branch naming, commit format, `Closes #N`                         |
| [design.md](../../rules/design.md)                                               | Mobile-first, three required states (loading/empty/error), accessibility floors            |

## Part 1: Planning

### Step 1: Understand Requirements

1. **If a GitHub issue is referenced:**

   ```bash
   gh issue view {number} --json number,title,body,labels,state,url
   ```

2. **Extract key information:**
   - What problem is being solved?
   - What are the acceptance criteria?
   - Any constraints or requirements?
   - Linked designs or references?

### Step 2: Research Technology Context

Before designing, understand the technologies involved.

1. **Identify technologies in scope** — check `package.json` for versions
2. **Research using WebSearch:**
   - Latest best practices
   - Version-specific features or limitations
   - Known issues, deprecations, or breaking changes
   - Recommended patterns from official docs

3. **Key questions:**

   | Question                        | Why It Matters               |
   | ------------------------------- | ---------------------------- |
   | What version are we using?      | APIs differ between versions |
   | What's the recommended pattern? | Avoid deprecated approaches  |
   | Any known issues?               | Prevent predictable problems |
   | What's new in this version?     | Leverage latest features     |

### Step 3: Explore Existing Architecture

1. **Find related code:**
   - How do similar features work?
   - What patterns are established?
   - What can be reused?

2. **Identify integration points:**
   - What existing modules will this touch?
   - What APIs/interfaces exist?
   - What dependencies are involved?

3. **Note constraints:**
   - Performance requirements
   - Backwards compatibility
   - Security considerations

### Step 4: Design the Solution

1. **Consider multiple approaches** with trade-offs
2. **Choose the best approach based on:**
   - Alignment with existing patterns
   - Maintainability
   - Scalability
   - Simplicity (avoid over-engineering)

3. **Define the architecture:**
   - File structure
   - Data flow
   - Component/module boundaries
   - Interfaces between parts

### Step 5: Create Implementation Plan

Break down into ordered, independently testable phases.

**For each phase, specify:**

- What files to create/modify
- What the code should do
- What patterns to follow
- What to test

### Planning Output Format

```markdown
## Implementation Plan

### Task

- **Source:** {GitHub issue #N | spec file | conversation}
- **Complexity:** {Low|Medium|High}
- **Phases:** {count}

### Overview

{1-2 sentence summary}

### Architecture Decision

**Approach:** {chosen approach}

**Why:**

- {reason 1}
- {reason 2}

**Alternatives considered:**
| Alternative | Why Not |
|-------------|---------|
| {option} | {reason} |

### File Structure

{path}/
+-- {file1} -- {purpose}
+-- {file2} -- {purpose}

### Phases

#### Phase 1: {name}

**Goal:** {what this phase accomplishes}
**Files:**

- Create `{path/file}` -- {description}
- Modify `{path/file}` -- {description}
  **Key Notes:**
- {note}
  **Verification:**
- {how to verify}

#### Phase 2: {name}

{same structure}

### Risks & Decisions

| Item   | Type          | Notes     |
| ------ | ------------- | --------- |
| {item} | Risk/Decision | {details} |
```

**After presenting the plan: WAIT for user approval before implementing.**

---

## Part 2: Implementation

After user approves the plan, implement one phase at a time.

### Per-Phase Process

#### Step 1: Explore Existing Code

Before writing anything:

1. Find similar implementations -- how do existing features work?
2. Identify reusable utilities, hooks, and types
3. Note file structure and naming conventions
4. Understand patterns established by already-completed phases

#### Step 2: Research Dependencies

Before writing any code, research every third-party dependency you will use:

```
"{library} best practices {current year}"
"{library} {version} documentation"
"{library} common mistakes"
```

This is mandatory -- do not guess how a library works.

#### Step 3: Implement

1. Follow existing patterns in the codebase exactly
2. Use proper TypeScript types -- no `any`
3. Handle errors appropriately
4. Keep code readable and explicit
5. Implement **only this phase** -- do not begin the next one

#### Step 4: Verify

Run after completing:

```bash
npm run typecheck
npm run lint
```

Fix all errors before presenting your summary.

#### Step 5: Commit (MANDATORY)

**You MUST commit after every phase before moving on. Do NOT batch commits or defer to the end.**

```bash
git add -A && git commit -m "phase {n}: {phase name}"
```

### Per-Phase Output Format

```markdown
### Phase {n} Complete: {phase name}

#### Changes Made

| File               | Change        |
| ------------------ | ------------- |
| `path/to/file.tsx` | {description} |

#### Key Code

{Most important snippet with file:line reference}

#### Verification

- TypeScript: {No errors | N errors fixed}
- Lint: {No warnings | N warnings fixed}
- Commit: {commit hash}
```

**After each phase: commit, then proceed immediately to the next phase. Do NOT wait for user confirmation between phases.**

---

## Part 3: Self-Review (when --review mode is active)

After completing each phase, review your own changes autonomously. This is a self-review — fix issues yourself and move on. Do NOT wait for user approval.

### Review Checklist

Apply the architectural lens from [principal-architect.md](../../agents/principal-architect.md):

- [ ] Architecture follows established patterns in codebase
- [ ] Correct separation of concerns
- [ ] API contracts are clear and consistent
- [ ] Security boundaries properly defined
- [ ] Dependencies justified and appropriate
- [ ] Third-party dependencies used as intended

Apply the code quality lens from [sde2.md](../../agents/sde2.md):

- [ ] TypeScript strict mode compliance
- [ ] Consistent naming conventions
- [ ] No hardcoded values that should be constants/config
- [ ] Proper error handling (not swallowing errors)
- [ ] No console.log or debugging code
- [ ] Imports organized and minimal
- [ ] Functions have single responsibility
- [ ] No obvious performance issues

### Self-Review Process

1. Run `git diff HEAD~1` to see the phase's changes
2. Review against the checklist above
3. If issues found: fix them, re-verify, amend the commit
4. If no issues or issues are fixed: proceed to the next phase
5. If issues persist after 2 fix attempts: only then surface them to the user

---

## Principles

1. **Read before write** -- understand existing patterns first
2. **Research before coding** -- look up libraries, never guess
3. **Follow loaded rules** -- `.claude/rules/` files are source of truth
4. **One phase at a time** -- do not implement beyond the current phase
5. **Plan is not code** -- planning and implementation are distinct steps
6. **Ask when blocked** -- surface ambiguity rather than assuming
