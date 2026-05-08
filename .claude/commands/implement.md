# Implement

Implements features directly without agent delegation. You handle both planning and execution yourself, following the implement skill.

## Skill Used

| Skill                                                                  | Purpose                                   |
| ---------------------------------------------------------------------- | ----------------------------------------- |
| [implement-guide](../skills/implement-guide/SKILL.md)                  | Planning + implementation guide           |
| [principal-architect.md](../agents/principal-architect.md) (reference) | Architectural checklist for --review mode |
| [sde2.md](../agents/sde2.md) (reference)                               | Code quality checklist for --review mode  |

## Input

- **$ARGUMENTS**: GitHub issue number, file path, or description
- **Optional flag**: `--review` / `-r`

```
Examples:
  /implement                     -> Conversation context, no per-phase review
  /implement #42                 -> GitHub issue, no per-phase review
  /implement ./specs/feature.md  -> Markdown spec, no per-phase review
  /implement #42 --review        -> GitHub issue + per-phase self-review
  /implement #42 -r              -> Short flag
```

## Flow

```
Detect Context
     |
     v
Branch Setup
     |
     v
Read skill -> Plan (yourself)
     |
     v
Show plan to user -> WAIT for approval -> create TodoWrite
     |
     v
+--- For each phase ----------------------------------------+
|                                                            |
|   Mark in_progress                                         |
|   Implement phase (yourself, following skill)              |
|   ** COMMIT changes (MANDATORY before moving on) **        |
|                                                            |
|   If --review:                                             |
|     Self-review diff against checklist                     |
|     +-- No issues -> mark completed -> next phase          |
|     +-- Issues found -> self-fix (max 2 attempts)          |
|           +-- Fixed -> mark completed -> next phase        |
|           +-- Still failing after 2 -> ask user            |
|                                                            |
|   If no --review:                                          |
|     Mark completed -> next phase                           |
+------------------------------------------------------------+
     |
     v
Report summary
```

---

## Execution

### Phase 1: Detect Context

Parse `$ARGUMENTS`:

```
If #123 found   -> gh issue view 123 --json number,title,body,labels,state,url
If .md path     -> Read file content
Otherwise       -> Use conversation context
```

Also parse for `--review` or `-r` flag. Store as `review_mode = true/false`.

Collect:

- Full requirements text
- Acceptance criteria (explicit or inferred)
- Any design references or constraints

### Phase 2: Branch Setup

1. Check current branch:

   ```bash
   git branch --show-current
   ```

2. Derive branch name:

   | Context      | Branch name pattern                           |
   | ------------ | --------------------------------------------- |
   | GitHub issue | `{username}/issue-{number}-{slugified-title}` |
   | Spec file    | `{username}/{slugified-filename}`             |
   | Conversation | Ask user                                      |

3. Check if branch exists:

   ```bash
   git branch --list "{branch_name}"
   git ls-remote --heads origin "{branch_name}"
   ```

   - Exists locally -> ask user: checkout existing or create new?
   - Exists on remote only -> fetch and checkout

4. Ask user for base branch (default: `main`)

5. Create and checkout:

   ```bash
   git checkout -b {branch_name} {base_branch}
   ```

6. Confirm to user:

   ```
   On branch: {branch_name} (based on {base_branch})
   ```

### Phase 3: Planning

**Do this yourself. Do NOT spawn any agents.**

1. Read the implement skill at `.claude/skills/implement-guide/SKILL.md`
2. Follow Part 1 (Planning) of the skill exactly:
   - Understand requirements
   - Research technology context
   - Explore existing architecture
   - Design the solution
   - Create the implementation plan

3. Present the plan in the skill's planning output format.

### Phase 4: Plan Approval

After creating the plan:

1. Create TodoWrite from the phase list
2. Present to user:

   ```markdown
   ## Implementation Plan

   {plan content from Phase 3}

   **Mode:** {With per-phase self-review | Implementation only}

   Does this plan look good? Let me know if you'd like any changes before we start.
   ```

3. **WAIT for user approval**

4. If user requests changes -> adjust the plan, update TodoWrite, present again

### Phase 5: Implementation Loop

For each phase in the approved plan:

#### Step A -- Mark in_progress

Update the todo item to `in_progress`.

#### Step B -- Implement

**Do this yourself. Do NOT spawn any agents.**

Follow Part 2 (Implementation) of the skill:

1. Explore existing code relevant to this phase
2. Research any third-party dependencies
3. Implement only this phase
4. Verify with typecheck and lint

#### Step B.1 -- Commit (MANDATORY)

**You MUST commit after every phase, before moving to the next phase or self-review.**

```bash
git add -A && git commit -m "phase {n}: {phase name}"
```

Do NOT batch commits. Do NOT defer commits to the end. Each phase gets its own commit immediately after implementation.

#### Step C -- Self-Review (only if `review_mode = true`)

**Do this yourself. Do NOT spawn any agents. Do NOT wait for user approval.**

This is a self-review — you review your own work, fix issues, and move on. The user is not involved unless you get stuck.

1. Run `git diff HEAD~1` to see the phase's changes
2. Review against the architectural + code quality checklists (Part 3 of the skill)
3. If issues found: fix them, re-verify, amend the commit

   ```bash
   git add -p && git commit --amend --no-edit
   ```

4. If no issues or issues are fixed: proceed to Step D
5. If issues persist after 2 fix attempts, only then ask user:

   ```markdown
   I found issues in **Phase {n}: {phase name}** that I couldn't resolve after 2 self-review attempts.

   **Remaining issues:**
   {issues list}

   How should we proceed?

   1. Try a different approach (describe it)
   2. Accept as-is and move to the next phase
   3. Stop here and review manually
   ```

#### Step D -- Mark completed

Mark todo item as `completed` and proceed immediately to the next phase. Do NOT wait for user confirmation between phases.

### Phase 6: Report

After all phases are done:

```markdown
## Implementation Complete

### Task Reference

{GitHub Issue #123 -- title | Spec: filename.md | Request: summary}

### Completed Phases

| #   | Phase        | Status |
| --- | ------------ | ------ |
| 1   | {phase name} | Done   |
| 2   | {phase name} | Done   |

### Files Modified

| File               | Change        |
| ------------------ | ------------- |
| `path/to/file.tsx` | {description} |

### Verification

- TypeScript: No errors
- Lint: No warnings

### Next Steps

- Review changes: `git diff main`
- Create PR: `gh pr create` or `/pr-review`
```

---

## When to Ask User

| Situation                            | Action                                  |
| ------------------------------------ | --------------------------------------- |
| After creating the plan              | Always show plan and WAIT for approval  |
| Branch already exists                | Ask: checkout existing or create new?   |
| Branch name unknown (conversation)   | Ask user for branch name                |
| Blocked on ambiguous requirements    | Ask for clarification before continuing |
| Self-review raises a design decision | Ask user -- don't resolve alone         |
| Fix attempts hit 2 failures          | Ask user for guidance                   |
