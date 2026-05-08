# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This repo is **pre-implementation**. There is no code, no `package.json`, no build system, no tests. The substantive artifacts are:

- `docs/PRD-commentary-compass.md` — product spec (v0.1, source of truth for scope and non-goals)
- `docs/TRD-commentary-compass.md` — technical requirements (v0.1, derived from PRD; architecture, data model, ingestion strategy, stack decisions, open-question dispositions)
- `docs/PLAN-commentary-compass.md` — phased execution plan (Phase 0 scaffolding → Phase 6 ship; decision gates per phase)

The `.claude/` directory contains rules, agents, skills, and command definitions that govern how future code should be written.

When asked to scaffold, plan, or implement, **read PRD → TRD → PLAN in order**. The PRD is product truth; the TRD encodes the technical decisions made on top of it; the PLAN sequences the work. Do not infer requirements beyond what is written.

## What this product is

**Commentary Compass** is a single-user web tool that ingests JioHotstar / Star Sports commentary panel announcements (published 30–90 minutes before IPL match toss on X / Instagram), matches them against a personal watch-list of preferred commentators (Harsha Bhogle, R Ashwin, Jatin Sapru, etc.), and notifies the user which feed (English / Star Sports Hindi / JioHotstar Hindi) carries the desired voice.

Critical product constraints from the PRD that affect technical decisions:

- **Single user, no accounts.** No auth system, no multi-tenancy. Building for one person (the author) until proven.
- **IPL only.** No regional languages, no WPL, no internationals. Don't generalize past this.
- **Pre-match decisioning, not real-time.** v1 reads *announced* panels; live audio identification is explicitly deferred to v2. Don't build toward speaker-ID.
- **Web only.** No native iOS/Android in v1.
- **Notification surface is undecided.** PRD lists Telegram / email / iOS PWA push / Slack DM as candidates — pick one when implementing, don't build all four.
- **Source ingestion is the riskiest part** (broadcaster format changes, ambiguous "and others" panels). Design ingestion source-agnostic; surface low-confidence panels rather than guessing.

## Heads-up: `.claude/` config is templated from another project

The `.claude/rules/`, `.claude/skills/`, and `.claude/agents/` directories were carried over from the **Examlly** project (an exam question-paper tool). Treat them critically:

- **Apply directly:** the generic engineering rules — `code-quality.md`, `guard-clauses.md`, `parse-dont-narrow.md`, `dont-duplicate-validation.md`, `ripple-effect.md`, `composition-over-render-props.md`, `useeffect-escape-hatch.md`, `code-comments.md`, `logging-proportionality.md`, `no-follow-up-deferral.md`, and `design.md`. These are language/framework-level guidance and apply to any TypeScript/React project.
- **Apply with adjustment:** `project-stage.md` (the "pre-production, no backward compat, clean over safe" stance is correct for Commentary Compass too — but the specific Drizzle/Supabase/`make db-reset`/three-migration-files mechanics are Examlly-specific. Ignore those until/unless this project picks the same stack).
- **Apply with adjustment:** `github.md` (the conventional-commit format, PR template, and `Closes #N` discipline carry over — the `examlly-tech` shared bot account does not. Use the user's personal `gh` account for everything until told otherwise).
- **Ignore for this project:** `docs-mcp.md` references an `examlly-docs-mcp` server that is not running here. Skills like `extract-questions-guide`, `author-solution-guide`, `paper-discovery-guide`, `diagram-contract`, and the `teacher` agent are Examlly-only and should not be invoked.

If a rule references Examlly-specific concepts (taxonomy, importQuestionItemSchema, NEET/JEE, drizzle, Supabase, db-reset), it is not relevant here.

## Commands

There are no commands yet — nothing has been built. `.claude/settings.json` pre-allows `yarn`, `turbo`, `vitest`, `tsc`, `eslint`, `shadcn@latest`, and `storybook`, which is a hint at the *expected* future stack but not a commitment. Do not run them until the corresponding tooling actually exists in the repo. When scaffolding, confirm the stack with the user before picking — the PRD is silent on it.

## Working in this repo today

Until code exists, valuable work in this repo is one of:

1. **PRD refinement** — answering the eight open questions in the PRD's "Open questions for alignment" section.
2. **TRD drafting** — the PRD explicitly says "TRD follows after sign-off." If asked to plan implementation, produce a TRD-shaped artifact (architecture, data model, ingestion source decision, notification surface decision) before writing code.
3. **Scaffolding** — when the user is ready, set up the project structure. Confirm stack choices first; don't assume the Examlly-templated allowlists imply commitment.

## Style reminders specific to this product

- **Plain language in user-facing copy.** The PRD specifies "Harsha on English tonight" as the target notification tone — terse, conversational, one line. Don't write "Commentator preference match found in panel for fixture..." anywhere a user reads it.
- **Mobile-first.** The user reads notifications and dashboard content on a phone during evening match windows. The `design.md` mobile-first guidance applies.
- **"Unknown" is a first-class state, not an error.** When a panel hasn't been announced, the system says "unknown" and notifies the user — it does not guess, retry indefinitely, or stay silent. Model this explicitly in any UI/data design.
