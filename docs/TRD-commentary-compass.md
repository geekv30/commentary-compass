# TRD: Commentary Compass

**Status:** Draft v0.3 — free-tier rewrite (supersedes v0.2, which over-stripped scope)
**Date:** 2026-05-07
**Author:** Varun

---

## TL;DR

Commentary Compass is a personal webapp that turns broadcaster panel announcements into a one-glance answer: *"Harsha is on English tonight; Ashwin is on JioHotstar Hindi."* You upload (or paste a link to) the panel image when it lands on X; Gemini 2.5 Flash parses it; the result is stored in Supabase and rendered on `/today` with your favorites highlighted. Past panels accumulate in `/history`. No notifications. No paid services. Built and hosted entirely on free tiers.

---

## Why v0.3 (revision history)

| Version | Scope | Why rejected |
| --- | --- | --- |
| v0.1 | Full automated ingestion, Telegram notifier, 6 phases, ~16–25 days, paid Anthropic + Turso | Over-engineered for a hobby project |
| v0.2 | Single page, no DB, no history, ~3 hours | Stripped too far — lost the "open the app and see today" experience |
| **v0.3** | **Manual upload, free-tier backend, dashboard with history, ~6–10 hours** | **Right size: keeps the product real, costs $0** |

---

## Goal

A working personal tool that meaningfully reduces the friction of *"who's on the mic tonight?"* — without recurring cost and without daring fragile scraping infrastructure.

### What "working" means in this version

- I upload tonight's panel image once when it lands on X (one tap, ~10 seconds).
- The app parses it, stores it, and shows me the structured panel with my favorites highlighted in under 5 seconds.
- I can also pull up past panels (last week, last month) for reference.
- I never pay anyone anything to run this.

### What "working" does NOT mean here

- Fully automated ingestion of X. This is technically possible but free-tier X read access does not exist in 2026; the workarounds (Nitter, RSS bridges) break frequently. Adding a manual upload step (~10 seconds, once per match day) is a much better trade than fragile scraping. **Optional exploration in v1.5** — see §"Optional automation."

---

## Architecture

```
                                  ┌──────────────────────────────────┐
                                  │   Browser (mobile-first)         │
                                  │   /today  /history  /upload      │
                                  └─────────┬────────────────┬───────┘
                                            │                │
                          read panels       │                │   POST image
                          via Server        │                │
                          Components        │                │
                                            ▼                ▼
                                  ┌──────────────────────────────────┐
                                  │   Next.js (Vercel free tier)     │
                                  │   - Server Components for reads  │
                                  │   - /api/parse for uploads       │
                                  └─────────┬────────────────┬───────┘
                                            │                │
                              SQL queries   │                │   image bytes
                                            │                │
                                            ▼                ▼
                              ┌─────────────────────┐   ┌─────────────────────┐
                              │  Supabase (free)    │   │  Gemini 2.5 Flash   │
                              │  - Postgres DB      │   │  (Google AI Studio  │
                              │  - Storage (raw     │   │   free tier)        │
                              │    image blobs)     │   │  - vision           │
                              └─────────────────────┘   │  - JSON output      │
                                                        └─────────────────────┘
```

Three components, all free, no scraping, no cron, no notifications.

---

## Stack (everything on a free tier)

| Layer | Choice | Free tier limit | Why |
| --- | --- | --- | --- |
| Framework | Next.js App Router | n/a | Server Components for the dashboard; Route Handlers for the upload endpoint; one runtime |
| Hosting | **Vercel Hobby** | unlimited bandwidth for personal use; serverless functions free | Trivial Next.js deploy; preview URLs per branch |
| Database | **Supabase Postgres** | 500 MB DB, 2 free projects | Real SQL; works with Drizzle or the Supabase JS client; pause-on-inactivity is acceptable for a personal tool |
| Object storage | **Supabase Storage** | 1 GB | Raw panel image blobs (~200 KB each = 5,000 panels of headroom — orders of magnitude more than we'll ever need) |
| LLM | **Gemini 2.5 Flash** via Google AI Studio | very generous (RPM/RPD well above our usage) | Vision-capable, JSON-schema output, free |
| Validation | zod | n/a | Parse the Gemini boundary (per `.claude/rules/parse-dont-narrow.md`) |
| ORM | Drizzle ORM (libSQL/Postgres flavor) | n/a | Type-safe SQL; pairs with `drizzle-zod` for schema-derived types |
| Styling | Tailwind | n/a | Default with the Next.js template; mobile-first by convention |
| UI primitives | shadcn/ui | n/a | Owned components; minimal install; mobile-friendly defaults |
| Source control | GitHub free | unlimited public repos | Vercel auto-deploys from a push |

**Total recurring cost: $0.** A custom domain is optional (~$10/year if you want one — `commentary.vercel.app` is fine until then).

**Explicitly not used:** Anthropic Claude (paid), Turso (paid above 1 free DB; Supabase covers us), separate cron service (skipped), Sentry (skipped — Vercel logs are enough), Telegram bot (no notifications), CI providers beyond Vercel's auto-deploy.

---

## Data model

Smaller than v0.1 — only what is needed to serve `/today`, `/history`, and the upload flow.

```ts
// Match — created lazily on first upload that references it.
type Match = {
  id: string;            // ULID
  date: string;          // ISO date, IST
  toss_at: string | null;
  home_team: string;     // 'CSK', 'MI', etc.
  away_team: string;
  marquee: boolean | null;
};

// Feed — three seed rows, never edited at runtime.
type Feed = {
  id: 'english' | 'star-sports-hindi' | 'jiohotstar-hindi-championswaali';
  display_name: string;
  language: 'english' | 'hindi';
  broadcaster: 'star-sports' | 'jiohotstar';
};

// PanelAnnouncement — one row per (match, feed) panel uploaded.
type PanelAnnouncement = {
  id: string;
  match_id: string;
  feed_id: Feed['id'];
  source: 'manual-upload' | 'manual-url-paste';
  source_url: string | null;        // X post URL if pasted, else null
  raw_blob_path: string;            // Supabase Storage key
  parsed_at: string;                // ISO timestamp
  confidence: number;               // 0..1 from Gemini
  status: 'confirmed' | 'unverified';
  raw_parse_json: unknown;          // the full Gemini response, kept for debugging
};

// PanelEntry — one row per commentator on a panel.
type PanelEntry = {
  panel_announcement_id: string;
  position: number;                 // ordering as shown on the graphic
  name_as_shown: string;            // exact string Gemini extracted
};
```

**Notes:**

- No separate `Commentator` table. Names are stored as strings; favorites match by case-insensitive substring against the hardcoded `FAVORITES` list (see §"Favorites"). This avoids alias-table maintenance and is honest about scope.
- No `WatchListItem`, `NotificationRule`, `NotificationLog`, `IngestRun` — none are needed without notifications or automation.
- `status` is binary (`confirmed` | `unverified`) — `pending` and `unknown` were lifecycle states for cron-driven panels; without a cron they don't exist. If Gemini's confidence is below threshold, `status = 'unverified'` and the UI shows a "verify manually" hint.

---

## Parsing

Same shape as v0.2 — Gemini 2.5 Flash with a `responseSchema`, zod re-validates at the boundary.

```ts
const PanelParseSchema = z.object({
  match: z.object({
    home_team: z.string().nullable(),
    away_team: z.string().nullable(),
    date_hint: z.string().nullable(),
  }),
  panels: z.array(z.object({
    feed: z.enum([
      'english',
      'star-sports-hindi',
      'jiohotstar-hindi-championswaali',
    ]),
    commentators: z.array(z.string().min(1)),
  })).min(1),
  confidence: z.number().min(0).max(1),
});
```

**Prompt (inline):**

> You are reading an IPL 2026 commentary panel announcement graphic. Identify which feed each commentator is on (English, Star Sports Hindi, or JioHotstar Hindi "Championswaali"). Return JSON matching the provided schema. If a name is unclear, omit it — do not guess. If the feed identity is ambiguous, lower the confidence score.

`safeParse` at the boundary; on failure, return a typed error and store the raw Gemini response in `raw_parse_json` so debugging is cheap.

---

## Favorites

```ts
// lib/favorites.ts
export const FAVORITES = ['Harsha Bhogle', 'R Ashwin', 'Jatin Sapru'];
```

Edit one line to change. Match is case-insensitive substring (handles "Harsha" vs "Harsha Bhogle"). No CRUD UI in v1; if you want add/remove later it's a 30-min addition.

---

## Routes / UI

Mobile-first, per `.claude/rules/design.md`. All four states (loading / empty / error / loaded) implemented for routes that fetch data.

| Route | Purpose | Notes |
| --- | --- | --- |
| `/today` | Today's matches with their parsed panels | Server Component reads from Supabase. Per match: three feed cards (English / Star Sports Hindi / JioHotstar Hindi). Favorites highlighted with a star + accent color. If a match has no panel uploaded yet → "No panel uploaded yet" state with a one-tap link to `/upload`. |
| `/upload` | Admin: upload a panel image **or** paste an X post URL (both first-class) | Single form with two equal input paths. On submit: server fetches the image (URL path) or uses the uploaded file (file path), calls Gemini, stores in Supabase, redirects to the panel's match page. Gated by an `ADMIN_SECRET` env var (cookie-based check). |
| `/history` | Past panels, paginated by date | Read-only list grouped by match-day. Quick scan of who was on what feed in past matches. |
| `/match/[id]` | Per-match deep view | Three feeds side-by-side on `md+`, stacked on mobile. Source link to the original X post if pasted. Confidence shown for `unverified` panels. |

**No `/admin` dashboard, no `/settings`, no `/watchlist` route.** If favorites need editing, edit `lib/favorites.ts` and redeploy.

---

## Upload flow (the one user-facing write path)

1. User opens `/upload` on phone (admin secret cookie already set from first visit).
2. User chooses one of two equal paths:
   - **File path:** drag-and-drop or pick a panel image directly.
   - **URL path:** paste the X post URL. The server fetches the post HTML, extracts the `og:image` URL from meta tags, then fetches the image bytes. Retries with backoff and a browser-like User-Agent on failure (see §"URL fetch design" below). On exhausted retries, the form switches to file-upload mode with a clear message ("Couldn't fetch from X — please upload the image manually").
3. Server:
   - Saves raw image to Supabase Storage.
   - Calls Gemini 2.5 Flash with the image + prompt + `responseSchema`.
   - `safeParse` the response. On failure → return `{ ok: false, error }`, do not store.
   - On success → upsert `Match` (lazy create), insert `PanelAnnouncement` + `PanelEntry` rows.
   - Redirect to `/match/[id]`.
4. User sees the parsed panel with favorites highlighted.

Total user time per panel: ~5–15 seconds (URL paste is faster; file upload requires the save-image-first step).

---

## URL fetch design

The URL-paste path is a real feature, so it needs to handle X's quirks honestly.

**Pipeline:**

```
URL  ──▶  fetch HTML (with browser UA)  ──▶  parse og:image  ──▶  fetch image  ──▶  buffer
              │ retry x3 with backoff           │ zod-validated      │ retry x3 with backoff
              ▼                                 ▼ string             ▼
         on exhaustion: 502           on missing: 422           on exhaustion: 502
```

**Implementation rules:**

- Server-side `fetch` with a stable browser-like User-Agent (e.g. recent Chrome on macOS). No special cookies — public posts are fetchable without auth in most cases.
- Parse `og:image` with a small regex or `node-html-parser`; do not bring in a full DOM library.
- zod-validate the extracted image URL (must be `https://`, must be one of X's known image hosts: `pbs.twimg.com`, `abs.twimg.com`).
- Retries: 3 attempts per fetch (HTML and image), exponential backoff (300ms, 900ms, 2.7s). Total budget: 10s per stage, 25s end-to-end.
- Timeout: 8s per individual fetch.
- On any non-recoverable failure (404 post, blocked, etc.), return a typed error to the client; the form transparently switches to file-upload mode without the user starting over.

**Failure modes & responses:**

| Failure | Likely cause | Response |
| --- | --- | --- |
| `fetch HTML` returns 401/403 | X blocking the UA | Retry once with an alternate UA; on second failure, surface "X blocked our fetch — please upload manually" |
| `og:image` not found | Post deleted, or X changed meta tags | "Could not find an image in this post — please upload manually" |
| `og:image` URL not on a known X host | Suspicious URL, possible phishing | Refuse — return validation error |
| Image fetch returns 404 | Image expired or removed | Retry once; on second failure, fall back to file upload |
| Total time exceeds 25s | Network congestion | Surface a timeout message; user can retry or fall back |

The form on `/upload` shows progress states distinctly: "Fetching post…" → "Got the image — parsing…" → "Done." On any error, the file upload becomes the primary input with the same form preserving any context the user typed.

This entire URL-fetch path is contained in `lib/fetchPanelFromUrl.ts` so the upload route is a thin orchestration layer.

---

## Optional automation (v1.5, only if v1 sticks)

If you find yourself uploading reliably for 2 weeks and want to remove that step, here are free-tier options worth exploring **after v1 is in your hands:**

| Option | Cost | Reliability | Effort |
| --- | --- | --- | --- |
| **GitHub Actions cron** + a public RSS bridge for X (e.g. RSSHub self-hosted, or rss.app free tier) | $0 | Medium — RSS bridges break when X tweaks the page | ~3 hours setup + ongoing maintenance |
| **cron-job.org** pinging a `/api/cron/ingest` route on a 5-min schedule | $0 | Same fragility as above; only the trigger is different | Same |
| **Vercel Cron (Hobby)** | $0 | Hobby tier limits cron to daily — too coarse for our window | n/a |

None are worth doing in v1. The 10-second manual upload is ~the same friction as opening X to look at the panel directly, and we already do the latter today. Revisit only if v1 proves the product is worth the extra plumbing.

---

## Non-goals

Mirrors PRD non-goals plus the technical cuts:

- No real-time speaker identification (PRD).
- No regional language feeds (PRD).
- No multi-user, accounts, or sharing (PRD).
- No notifications (Telegram, email, push). Open the page when needed.
- No automated ingestion in v1. v1.5 is exploratory at best.
- No paid LLMs or paid hosting tiers.
- No watch-list edit UI in v1.
- No accuracy logging, weekly reports, or feedback round-trip.
- No tests beyond manual checks against 3–5 real panels. (Smoke check is the test plan; a unit test on the favorite-match function is the only piece worth a test.)
- No Sentry or third-party monitoring; Vercel function logs cover the rare error case.
- No CI beyond Vercel's auto-deploy.

---

## Risks

Three real ones:

1. **Gemini misreads cropped or low-resolution panels.** Mitigation: prompt asks the model to omit unclear names. Confidence is surfaced; low-confidence panels show as `unverified` in the UI. If still bad, swap to Gemini 2.5 Pro (one-line model change; lower RPM but better vision — both free).
2. **Supabase free-tier project pause-on-inactivity.** Free Supabase projects pause after ~7 days of zero traffic. Mitigation: a single hit per match-day window keeps it warm; if it does pause, the first request takes ~5 seconds to wake it. Acceptable for a personal tool.
3. **You stop uploading.** Without notifications, the loop is "remember to upload." Mitigation: the upload is faster than the existing X workflow. If after a month you find yourself not bothering, that's the signal to revisit v1.5 (automation) — not a bug in v1.

---

## Decisions made

1. **Watch-list UI:** in code (`lib/favorites.ts`). Edit one line + redeploy to change.
2. **Server-side X URL fetch:** **first-class input alongside file upload.** Built properly with retries, og:image extraction, and a graceful fallback to file upload on failure (see §"URL fetch design").
3. **v1.5 automation (RSS bridge / scheduled scraper):** skipped in v1. Revisit only after v1 has been used for 2+ weeks.

---

## What you need to provide (irreducible)

Most setup is automated. `gh` and `vercel` CLIs are already authenticated on this machine, so I create the repo, link Vercel, and deploy without asking. Defaults like the favorites list (Harsha / Ashwin / Jatin) are taken straight from the PRD.

The two genuinely user-only items, ~7 minutes total:

1. **Google AI Studio API key** — `aistudio.google.com` → "Get API key". Requires your Google login.
2. **Supabase free-tier project** — `supabase.com` → new project. Requires your signup.

Optional later:
- **1–2 sample panel images** for prompt tuning (Step 7 only — the build proceeds without them).

See `docs/PLAN-commentary-compass.md` for the full step-by-step.
