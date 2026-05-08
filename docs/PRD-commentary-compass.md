# PRD: Commentary Compass

**Author:** Varun
**Status:** Draft v0.1 — for alignment before TRD
**Last updated:** May 2026

---

## TL;DR

Cricket fans who care which voice they're listening to currently have no way to know which JioHotstar feed has their preferred commentator on a given match night. The broadcaster *publishes* this information, but only as image graphics on social media, and only ~30–90 minutes before toss. Commentary Compass closes the gap: it ingests the broadcaster's panel announcements, checks them against a personal watch-list, and pings me before toss with a one-line answer — "Harsha on English tonight" — so I can tune in to the right feed from ball one.

---

## Problem statement

I have strong, durable preferences for specific commentators — Harsha Bhogle, R Ashwin, Jatin Sapru. During IPL 2026, those three are split across two different Hindi feeds (Star Sports Hindi vs JioHotstar's "Championswaali" Hindi feed), one English feed, and possibly studio-only roles for any given match. The roster rotates; nobody is on every match.

Today, my workflow to find out who's on the mic looks like this:

1. Open X around 6:30 PM.
2. Scroll `@StarSportsIndia` and `@JioHotstar` looking for tonight's panel graphic.
3. Read the graphic, often poorly cropped on mobile, to find the names I care about.
4. Map names to feeds, decide which audio track to pick in the JioHotstar app.
5. Sometimes find out 20 minutes in that I picked wrong — switch mid-match, lose context.

The information exists. It's just unstructured, ephemeral (buried in a social feed within hours), and requires active checking I keep forgetting to do. The cost of getting it wrong is real: I either miss commentators whose insight I genuinely value, or I sit through ones whose style I don't enjoy, for 3+ hours.

This is a small, persistent papercut over a 60+ match season — exactly the shape of problem worth automating once.

## Why now

Three things make this worth solving in 2026 specifically:

- **Panel fragmentation has gotten worse.** IPL 2026 introduced a *second* Hindi feed (JioHotstar's "Championswaali" featuring IPL champions) on top of Star Sports' existing Hindi feed. There are now effectively three feeds an Indian fan needs to triage between, not two. Manual checking scales worse with more options.
- **Ashwin's commentary debut.** He's on the JioHotstar Hindi feed, but only some matches. Existing fans who want to follow him specifically have no reliable way to do so.
- **JioHotstar's audio-track switcher works mid-stream.** The plumbing for "switch feeds without switching apps" is in place. The missing layer is purely informational — knowing *when* to switch.

## Target user

**Primary user — me.** A specific shape: paying JioHotstar subscriber, watches most matches, has named commentator preferences, will tolerate a small amount of setup for a recurring quality-of-life win. I am building for myself first; everything else is consequence.

**Secondary user — the "preference-aware fan".** Cricket fans who already know they prefer some voices over others, who switch feeds occasionally, but who don't put in the work to optimize because the friction is too high. There are more of these than I'd guess; cricket Twitter is full of "why does Sidhu always get the marquee matches" complaints. They're a real audience but not the design target. If v1 works for me, they'll inherit it.

**Explicit non-user — the "ambient watcher".** Someone who has the match on in the background and doesn't differentiate between commentators. This is the modal IPL viewer. Building for them would change the product entirely. Not us.

## User stories

- *As a fan with favorite commentators*, I want to know before each match whether any of them are on tonight's panel, so I can decide which feed to start on.
- *As someone who forgets to check Twitter*, I want to be notified passively when a match I care about has my preferred commentators, so I don't have to remember anything.
- *As someone whose preferences change*, I want to manage my watch-list easily, so I can add Jatin one season and drop him the next.
- *As a user who only watches some matches*, I want to filter notifications by team or marquee status, so I'm not pinged for every fixture.
- *As a user on the JioHotstar app*, I want the answer to be fast and unambiguous — ideally one sentence — so the cost of using this is lower than the cost of checking manually.

## Goals

**v1 ships when:**

- The system reliably knows the announced commentary panel for ≥90% of IPL matches before toss.
- I receive a notification, on a surface I actually check, between 30–90 minutes before toss when a watch-listed commentator is on the panel.
- The notification tells me which feed to use (English / Star Sports Hindi / JioHotstar Hindi).
- I can manage my watch-list without help from an engineer.
- I have not manually checked X for a commentary panel in two consecutive weeks of matches.

## Non-goals (v1)

- **Real-time on-air speaker identification.** "Is Harsha speaking *right now*?" is a fundamentally harder problem and explicitly deferred to v2.
- **Regional language feeds.** Tamil, Telugu, Kannada, Marathi, Bengali, etc. are out of scope; the audience overlap with my watch-list is zero.
- **Multi-user, social, or sharing features.** No accounts, no shared watch-lists, no leaderboards. This is a single-user tool that may grow up later.
- **Historical analytics.** "Who has commentated the most CSK home games?" is interesting but not solving the problem.
- **Non-IPL cricket.** WPL, internationals, T20 leagues outside IPL — all out. The panel announcement patterns differ and the season cadence doesn't justify the cost.
- **Predicting future panels.** If tonight's panel hasn't been announced yet, the system says "unknown" — it does not guess.

## User workflows

### Workflow 1 — Pre-match notification (the core loop)

1. A new IPL match is scheduled for the day.
2. The broadcaster publishes a commentary panel graphic on social media, typically 30–90 minutes before toss.
3. The system ingests the panel, parses commentator names per feed, and checks against my watch-list.
4. **If a match is found:** I get a notification — *"Harsha on English tonight. CSK vs MI, 7:30 PM. Tap to open JioHotstar."*
5. **If no match is found:** silence. (Configurable: optional digest if I want a daily roll-up.)
6. **If the panel hasn't been announced yet by 60 min before toss:** I get an "unknown" notification so I know to check manually. This is a deliberate fallback — silence should mean "no preferred commentators," not "we don't know."

### Workflow 2 — On-demand check

1. I open the dashboard at any time during match day.
2. I see today's matches with the panel breakdown per feed.
3. My watch-listed commentators are visually highlighted.
4. If panels haven't been announced yet, those rows show "pending."

### Workflow 3 — Watch-list management

1. I open settings.
2. I see a searchable list of all known IPL 2026 commentators, grouped by feed.
3. I add or remove commentators from my watch-list.
4. I optionally configure rules: "notify only if multiple are on the panel," "notify only for marquee fixtures," "quiet hours."

### Workflow 4 — Mid-season correction

1. I notice a notification was wrong (panel was announced but a commentator subbed in/out at the last minute).
2. I tap "Report wrong" on the notification or dashboard entry.
3. The system logs the correction so I can review accuracy patterns later. v1 does not auto-learn from this; it's just a log.

## Approaches considered

### A. Status quo — manual checking

Open X 60 min before toss, find the panel, decide.
*Pros:* zero infrastructure, zero cost.
*Cons:* requires me to remember; misses matches when I'm busy; the friction that prompted this entire project.

### B. Crowd-sourced reporting

Build a simple PWA where users tap "I hear Harsha on English" while watching. Aggregate submissions, show consensus.
*Pros:* works even when broadcaster doesn't announce; potentially identifies live changes (sub-ins) that announced panels miss; cheap to build.
*Cons:* requires critical mass of users to be useful; doesn't help the *pre-match* decision (which is when I most need the info); circular bootstrap problem — useless until people use it, no one uses it until it's useful.

### C. Automated panel ingestion (recommended)

Pull commentary panels from official broadcaster channels automatically. Parse, structure, store, notify. Watch-list match against my preferences.
*Pros:* solves the actual problem (pre-match decision), broadcaster-authoritative source, low ongoing maintenance, scales to me-plus-friends without redesign.
*Cons:* fully dependent on the broadcaster's announcement reliability and consistency. If JioHotstar stops posting per-match panels, the product degrades.

### D. Real-time speaker identification

Identify the current speaker from the live audio.
*Pros:* most accurate "right now" answer; works even if no panel was announced; handles last-minute swaps.
*Cons:* substantially more complex; ToS-risky in some implementations; solves the wrong problem for v1 (the user's decision happens *before* the match starts, not during).
*Status:* deferred to v2. Worth building only if v1 ships and the announcement-reliability cons of (C) prove worse than expected.

### Recommendation

**Approach C — Automated panel ingestion.** It targets the actual decision moment (pre-match), uses an authoritative source, and is the lowest-complexity option that meaningfully solves the problem. (B) is interesting as a v3 augmentation if/when there are enough users. (D) is interesting but solves a problem I don't yet have.

## Success metrics

What "working" looks like, in priority order:

1. **Personal NPS — would I miss it if it stopped working tomorrow?** The only metric that ultimately matters for a tool I'm building for myself. If after one month I'd be annoyed if it broke, it's working.
2. **Coverage:** % of IPL matches for which a panel was successfully ingested before toss. Target: ≥90%.
3. **Notification timeliness:** time between panel publication and my notification firing. Target: under 5 minutes.
4. **Notification precision:** of all notifications fired, % where the named commentator actually appeared on the named feed during the match. Target: ≥90%. Measured by spot-checks, not automatically.
5. **Manual fallback rate:** how often I still end up checking X manually. Target: zero, after week 4.
6. **Setup-to-first-value time:** time from "I install this" to "I get my first useful notification." Target: under 10 minutes.

## Risks and assumptions

**Assumptions worth pressure-testing:**

- *The broadcaster will continue announcing panels per match.* Holds for IPL 2026 so far, but they could change format mid-season. Risk if it changes: product silently degrades.
- *Announced panels match who actually commentates.* Mostly true based on prior seasons but not always — names sometimes get swapped at the last minute. Acceptable for v1; corrections workflow in place.
- *Panels are announced consistently 30–90 minutes before toss.* Anecdotal; we'll know the actual distribution after a few weeks of data.
- *I will actually use the watch-list management UI.* Lower friction than current behavior, but not zero. Worth measuring.

**Risks:**

- **Source change.** Broadcaster changes their announcement format, deletes posts, moves to a new platform, or starts gating panels behind login. Mitigation: design ingestion to be source-agnostic; multiple source candidates exist.
- **Ambiguous data.** Panel graphics sometimes list "and others" or batch many matches together; parsing fidelity drops. Mitigation: surface low-confidence panels with a "verify manually" prompt rather than guessing.
- **Notification fatigue.** If watch-list is too broad, I get pinged every match and stop reading them. Mitigation: notification rules + quiet defaults.
- **Over-engineering trap.** The temptation to build (D) before (C) is real. Discipline: ship C first, in its smallest useful form.

## Open questions for alignment

These need answers (or at least informed guesses) before TRD:

1. **Source coverage:** Are panels announced for every match, or only marquee fixtures? Need to observe ~10–15 matches to know.
2. **Source reliability:** Where exactly are panels published most consistently — X, Instagram, the JioHotstar in-app schedule, somewhere else? Need to map sources before committing to one.
3. **Panel fidelity:** When a panel is announced, how often does the actual on-air lineup match? Anecdotal evidence says "mostly," but we should track this from day one.
4. **Notification surface:** What channel do I actually check? Telegram, email, iOS push via PWA, Slack DM to myself? My honest answer matters more than what's elegant.
5. **Watch-list scope:** v1 starts with 3 names (Harsha, Ashwin, Jatin). Should it allow more? Probably yes, but cap at ~10 to prevent the "everyone is interesting" failure mode.
6. **Multiple matches per day:** On double-header days, how should notifications be batched? One per match, or a single morning digest?
7. **Replays and post-match shows:** Do these have separate panels worth surfacing, or only live matches?
8. **Definition of "feed":** For UI purposes, is "JioHotstar Hindi (Championswaali)" one feed or grouped under "Hindi"? They have different commentators, so probably separate. Confirm.

## Out of scope for v1

For clarity and to prevent scope creep:

- Native mobile apps (iOS/Android). Web-only is fine for v1.
- Account systems, login, or any backend that requires user identity.
- Public-facing version — this is single-user until proven.
- Anything that requires capturing, processing, or transcribing live broadcast audio or video.
- Integration with the JioHotstar app itself (deep links to specific feeds are aspirational, not required).
- Any non-IPL cricket coverage.
- Predictive features ("which commentators are likely to be on tomorrow's match").

---

## Appendix A — Research notes

Brief context for reviewers who want background, not part of the spec itself:

- IPL 2026 has 27+ English commentators and 21+ Hindi commentators (split across two Hindi feeds), plus regional panels in 10 additional languages. Total panel: ~150 names.
- The two Hindi feeds are structurally distinct: Star Sports Hindi (TV-led, traditional commentary) and JioHotstar's "Championswaali Commentary" (digital-only, watch-along format with IPL title-winners). Ashwin is on the latter.
- Panel announcements come from JioStar (parent broadcaster) via `@StarSportsIndia` and `@JioHotstar` X handles, also mirrored on Instagram. The pre-season master list was published once on March 27, 2026; per-match panels are published on match days.
- Existing third-party trackers (sportsdunia.com per-match articles, ICDb commentator database) are either prediction-based or rely on volunteer submissions. Neither is reliable enough to depend on.
- Prior IPL seasons (2024, 2025) followed the same announcement cadence, suggesting the pattern is stable.

## Appendix B — Glossary

- **Panel.** The list of commentators assigned to a feed for a specific match.
- **Feed.** A distinct audio commentary stream available within JioHotstar's player. For v1 scope: English, Star Sports Hindi, JioHotstar Hindi.
- **Watch-list.** My set of preferred commentators that drive notifications.
- **Pre-match window.** The 30–90 minute window before toss when panels are typically announced.
- **Marquee fixture.** Matches with high viewership (CSK, MI, RCB headliners, playoffs). The broadcaster sometimes announces panels earlier and more reliably for these.

---

*Next step: review and align on problem statement, target user, and goals. TRD follows after sign-off.*
