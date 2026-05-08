# PLAN: Commentary Compass

**Status:** Draft v0.3 — free-tier execution plan (supersedes v0.2)
**Date:** 2026-05-07
**Total estimated time:** 7–12 focused hours, ideally over a weekend.

---

## What changed from v0.2

v0.2 stripped the backend out entirely. v0.3 puts it back — but on free tiers (Vercel + Supabase + Gemini) so the recurring cost stays at $0. See TRD v0.3 for the matching design.

---

## Prerequisites

Both `gh` and `vercel` CLIs are already authenticated on this machine (as `geekv30`), and Node 24 + yarn/npm/pnpm are installed. So the irreducible list is just two account actions you do once, ~7 minutes total:

| # | What | Where | Time | Why only you |
| --- | --- | --- | --- | --- |
| 1 | **Google AI Studio API key** (Gemini) | `aistudio.google.com` → "Get API key" | 2 min | Requires your Google login + ToS accept |
| 2 | **Supabase project** (free tier) | `supabase.com` → new project | 5 min | Requires your Supabase signup + project provision |

From Supabase, copy these into a quick note:
- The Postgres connection string (Settings → Database → Connection string → URI form)
- The project URL and anon key (Settings → API)
- The service-role key (Settings → API → service_role) — **server-side only, never ship to the client**

Optional and only needed at Step 7 (smoke test):
- **1–2 sample panel images** saved from X — for prompt tuning. The build proceeds fine until then.

### What I'll handle myself (no action from you)

- Create the GitHub repo (`gh repo create`, default private)
- Scaffold the Next.js app + install all dependencies
- Initialize git, commit, push
- Link the project to Vercel (`vercel link`)
- Set Vercel env vars from the values you provide for #1 + #2
- Default favorites to Harsha Bhogle / R Ashwin / Jatin Sapru (from the PRD); edit `lib/favorites.ts` later to change

---

## Step 1 — Scaffold + connect (~1 hour)

```bash
npx create-next-app@latest commentary-compass --typescript --tailwind --app --no-eslint --src-dir=false --import-alias='@/*'
cd commentary-compass
npm i zod @google/genai @supabase/supabase-js drizzle-orm postgres
npm i -D drizzle-kit
npx shadcn@latest init
npx shadcn@latest add button card input badge skeleton
```

Create `.env.local` with placeholders only (no real secrets in repo):

```
GEMINI_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=                    # the Postgres connection string from Supabase
ADMIN_SECRET=                    # any long random string; gates /upload
```

Push to GitHub, link Vercel, set the same env vars in Vercel project settings. Confirm:
- `npm run dev` → hello world at `localhost:3000`
- A Vercel preview URL deploys successfully on push

**Done when:** local dev server runs and Vercel preview URL works.

---

## Step 2 — Schema + storage setup (~1 hour)

Define the data model from TRD §"Data model" in `db/schema.ts` using Drizzle. Tables: `match`, `feed`, `panel_announcement`, `panel_entry`. FKs as in TRD.

```bash
npx drizzle-kit generate    # produces a single baseline SQL file
npx drizzle-kit push        # applies it to Supabase
```

Per `.claude/rules/project-stage.md`: a single baseline migration file; if the schema changes during development, edit `schema.ts` and regenerate — no migration history to maintain.

Seed the three `feed` rows (English, Star Sports Hindi, JioHotstar Hindi Championswaali) via a one-shot script `scripts/seed.ts`.

Create a Supabase Storage bucket named `panels` (private, RLS off — this is a single-user app behind `ADMIN_SECRET`).

**Done when:** Drizzle Studio (`npx drizzle-kit studio`) shows the four empty tables + three feed rows; the `panels` bucket exists in the Supabase dashboard.

---

## Step 3 — Gemini parser + favorites (~45 min)

Create `lib/parse.ts`:

- `PanelParseSchema` (zod) per TRD §"Parsing"
- `parsePanel(imageBytes: Buffer, mimeType: string)` returning `{ ok: true, data } | { ok: false, error }`
- Calls Gemini 2.5 Flash with the image (inline base64), prompt, and `responseSchema`
- `safeParse` at the boundary; returns typed error on parse or schema failure (no throws crossing the boundary)

Create `lib/favorites.ts`:

```ts
export const FAVORITES = ['Harsha Bhogle', 'R Ashwin', 'Jatin Sapru'];
export const isFavorite = (name: string) =>
  FAVORITES.some(f => name.toLowerCase().includes(f.toLowerCase()));
```

Quick verify with a tiny throwaway script (`scratch/test-parse.ts`) that loads one sample image and prints the parsed result. Delete or move to `scratch/` once it works.

**Done when:** a real panel image, fed into `parsePanel`, returns a valid `PanelParseSchema` object.

---

## Step 4 — Upload flow with URL paste + file upload (~2.5 hours)

URL paste is a first-class input alongside file upload, with proper retries and graceful fallback.

### 4a. URL fetch helper (~45 min)

`lib/fetchPanelFromUrl.ts`:

- `fetchPanelFromUrl(url: string): Promise<{ ok: true, bytes: Buffer, mimeType: string } | { ok: false, error: FetchError }>`
- Pipeline: fetch HTML (browser-like UA) → parse `og:image` → zod-validate URL is on a known X host (`pbs.twimg.com` or `abs.twimg.com`) → fetch image bytes
- Retries: 3 attempts per stage, exponential backoff (300ms / 900ms / 2.7s)
- Timeouts: 8s per fetch, 25s total
- `FetchError` is a discriminated union: `'host_blocked' | 'og_image_missing' | 'invalid_image_host' | 'image_404' | 'timeout'` so the UI can show the right message

Verify with a throwaway script (`scratch/test-url-fetch.ts`) hitting one real X panel post.

### 4b. API route (~30 min)

`app/api/parse/route.ts`:

- `POST(request)` accepts `multipart/form-data` with **either** an `image` file field **or** a `source_url` text field — exactly one
- For `source_url`: call `fetchPanelFromUrl`; on failure return `{ ok: false, error, fallback_to_file: true }` so the UI knows to switch input modes
- For `image`: read bytes + MIME directly
- Either path then calls `parsePanel(buffer, mimeType)`
- On parse success:
  - Upload raw image to Supabase Storage (`panels/<ulid>.<ext>`)
  - Upsert `match` row (lazy creation by `(date, home_team, away_team)`)
  - Insert `panel_announcement` rows (one per parsed feed; `source` = `'manual-url-paste'` or `'manual-upload'`)
  - Insert `panel_entry` rows for commentators
  - Return `{ ok: true, match_id }`
- On parse failure: return `{ ok: false, error }`; **do not** store partial results

### 4c. Upload page (~1 hour)

`app/upload/page.tsx`:

- Two equal input modes shown as a tab/segmented control: **Paste URL** | **Upload file**
- URL mode:
  - Single text input with paste handler
  - Submit button: "Fetch and parse"
  - Progress states: "Fetching from X…" → "Got the image — parsing…" → "Done"
  - On URL-fetch failure: switch to file-upload mode, preserve any UI context, show a clear inline message ("X blocked our fetch — please upload the image instead")
- File mode:
  - Drag-and-drop zone + fallback picker
  - Submit button: "Parse panel"
- Both modes:
  - Loading skeleton during the parse (~3–5s for Gemini)
  - Redirect to `/match/[id]` on success
  - Inline error message + retry on parse failure

### 4d. Admin gate (~15 min)

Gate `/upload` (and `/api/parse`) with `ADMIN_SECRET`: a server-side cookie check; if no cookie, present a one-field form to set the secret. Single-user app, single-purpose gate. No login, no users table.

**Done when:**
- File upload of a real panel image lands on `/match/[id]` with the parsed panel.
- URL paste of a real X panel post does the same.
- A deliberately bad URL (e.g. a deleted post) shows the right error and offers file upload as fallback.

---

## Step 5 — `/today` and `/match/[id]` (~1.5 hours)

`app/today/page.tsx` — **default route** (redirect `/` → `/today`):

- Server Component reads from Supabase: today's matches (date = current IST date) + their panels
- Per match: a card with the teams + toss time + three feed sub-cards
- Each feed sub-card lists commentators; favorites get ⭐ + accent
- States:
  - Loading: skeleton match cards (Server Component → Suspense)
  - Empty (no matches today): "No matches today. Next match: [date]." Static copy is fine if we don't have the schedule loaded — just say "No matches scheduled."
  - Error: "Couldn't load today's panels. Retry."
  - Per match with no panels uploaded yet: muted card with a one-tap link to `/upload`
- Mobile-first: cards stack vertically; works at 390px

`app/match/[id]/page.tsx`:

- Same shape as `/today`'s match card but full-screen
- Three feed cards stacked on mobile, side-by-side on `md+`
- Source link to the original X post if `source_url` is set
- Confidence shown discretely for `unverified` panels ("Confidence: 0.72 — verify with the original")

**Done when:** opening `/today` on your phone shows a real uploaded panel for today's match with favorites highlighted.

---

## Step 6 — `/history` (~45 min)

`app/history/page.tsx`:

- Server Component reads `panel_announcement` + `match` joined, ordered by date desc
- Grouped by match-day (a header row per date)
- Each row shows: match teams, feed, commentator list (favorites highlighted), source link
- Pagination: 30 per page; "Load more" button (server action)

States: loading skeleton, empty ("No panels yet — upload one at /upload"), error.

**Done when:** uploading three panels and refreshing `/history` shows all three grouped by match-day.

---

## Step 7 — Real-panel smoke check + prompt tuning (~1 hour)

Test against your 3–5 sample panels:

- Each one must produce: correct feed identification (English vs Star Hindi vs JioHotstar Hindi), all visible names extracted, favorites highlighted in the rendered UI.
- Common failure modes to watch:
  - Gemini grouping all names under one feed when graphic shows two columns
  - Names missing roles or with garbled extraction from low-res images
  - "Championswaali" vs "JioHotstar Hindi" feed-label confusion
- Tweak the prompt (be explicit about feed labels, role separation, ordering) until 4 of 5 sample panels parse cleanly.
- If still bad: swap the model from `gemini-2.5-flash` to `gemini-2.5-pro` — one-line change in `lib/parse.ts`. Free tier has lower RPM but better vision; for our 1–2 calls per match day, fine.

**Done when:** 4 of 5 sample panels parse with all favorites correctly highlighted.

---

## Step 8 — Deploy + verify on phone (~30 min)

```bash
npx vercel --prod
```

- Confirm production env vars set in Vercel dashboard (Settings → Environment Variables): all six from Step 1
- Open the production URL on your phone
- Set the `ADMIN_SECRET` cookie via the gate page
- Upload one real panel from the phone (using the X "save image" → upload flow)
- Confirm `/today` and `/history` render correctly

**Done when:** the production URL works on your phone end-to-end: upload a panel, see it on `/today`, see it on `/history`.

---

## Total: 6–10 hours

| Step | What | Estimate |
| --- | --- | --- |
| 1 | Scaffold + connect | 1h |
| 2 | Schema + storage setup | 1h |
| 3 | Gemini parser + favorites | 45min |
| 4 | Upload flow (URL paste + file upload) | 2.5h |
| 5 | `/today` + `/match/[id]` | 1.5h |
| 6 | `/history` | 45min |
| 7 | Smoke check + prompt tuning | 1h |
| 8 | Deploy + verify | 30min |
| | **Total** | **~7h optimistic, ~12h realistic** |

If Gemini's vision struggles (unlikely on Flash but possible), add another hour to Step 7. If Supabase setup is unfamiliar, add 30 min to Step 2.

---

## Out of scope (do not let these creep in)

- Automated ingestion via cron / scrapers / RSS bridges — exploratory v1.5 only.
- Telegram or any other notification surface.
- Watch-list edit UI — edit `lib/favorites.ts` and redeploy.
- Tests beyond the manual smoke check (one optional unit test on `isFavorite` is fine).
- CI beyond Vercel's auto-deploy.
- Sentry, analytics, or any third-party monitoring.
- A custom domain (use `*.vercel.app` for v1).
- Storybook, Husky, lint-staged, or any polish tooling.
- Multi-user / auth / login flows.

If a polish item is tempting and would take less than 15 minutes, do it. If it would take more, write it down for later and move on.

---

## What I need from you to start

Just two things (see Prerequisites above for detail):

1. **Google AI Studio API key** — `aistudio.google.com` → Get API key (~2 min).
2. **Supabase free-tier project** — `supabase.com` → new project. Copy: connection string, anon key, service-role key, project URL (~5 min).

Everything else is automated. Sample panel images are only needed at Step 7 — the build proceeds fine until then.

**When you have the Gemini key + Supabase details, say "go"** and paste them into the chat (they live server-side; not a leak risk to share with the dev environment) — or save them yourself and tell me you're ready, and I'll prompt you to drop them into `.env.local` at the right moment.

---

## Decisions made

1. **Watch-list:** in code (`lib/favorites.ts`).
2. **URL paste:** built properly with retries, og:image extraction, and a graceful fallback to file upload on failure (Step 4a + 4b).
3. **v1.5 automation:** skipped in v1. Revisit only after v1 has been used for 2+ weeks.
