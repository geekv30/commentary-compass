import 'server-only';
import { eq, desc, asc, inArray } from 'drizzle-orm';
import {
  db,
  match,
  panelAnnouncement,
  panelEntry,
  feed,
  type Match,
  type PanelAnnouncement,
  type PanelEntry,
  type Feed,
} from '@/db';

export type PanelWithEntries = PanelAnnouncement & {
  entries: PanelEntry[];
  feedDisplay: Feed;
};

export type MatchWithPanels = Match & {
  panels: PanelWithEntries[];
};

const FEED_ORDER: Record<string, number> = {
  english: 0,
  'star-sports-hindi': 1,
  'jiohotstar-hindi-championswaali': 2,
};

function attachPanels(
  matches: Match[],
  panels: PanelAnnouncement[],
  entries: PanelEntry[],
  feeds: Feed[]
): MatchWithPanels[] {
  const feedById = new Map(feeds.map((f) => [f.id, f]));
  const entriesByPanelId = new Map<string, PanelEntry[]>();
  for (const entry of entries) {
    const list = entriesByPanelId.get(entry.panelAnnouncementId) ?? [];
    list.push(entry);
    entriesByPanelId.set(entry.panelAnnouncementId, list);
  }

  const panelsByMatchId = new Map<string, PanelWithEntries[]>();
  for (const panel of panels) {
    const feedRow = feedById.get(panel.feedId);
    if (!feedRow) continue;
    const list = panelsByMatchId.get(panel.matchId) ?? [];
    const panelEntries = (entriesByPanelId.get(panel.id) ?? []).sort(
      (a, b) => a.position - b.position
    );
    list.push({ ...panel, entries: panelEntries, feedDisplay: feedRow });
    panelsByMatchId.set(panel.matchId, list);
  }

  return matches.map((m) => {
    const list = panelsByMatchId.get(m.id) ?? [];
    list.sort(
      (a, b) =>
        (FEED_ORDER[a.feedId] ?? 99) - (FEED_ORDER[b.feedId] ?? 99)
    );
    return { ...m, panels: list };
  });
}

export async function getMatchesForDate(
  isoDate: string
): Promise<MatchWithPanels[]> {
  const matches = await db
    .select()
    .from(match)
    .where(eq(match.date, isoDate))
    .orderBy(asc(match.tossAt));

  if (matches.length === 0) return [];
  const matchIds = matches.map((m) => m.id);

  const panels = await db
    .select()
    .from(panelAnnouncement)
    .where(inArray(panelAnnouncement.matchId, matchIds));

  const panelIds = panels.map((p) => p.id);
  const entries =
    panelIds.length > 0
      ? await db
          .select()
          .from(panelEntry)
          .where(inArray(panelEntry.panelAnnouncementId, panelIds))
      : [];

  const feeds = await db.select().from(feed);

  return attachPanels(matches, panels, entries, feeds);
}

export async function getMatchById(id: string): Promise<MatchWithPanels | null> {
  const matches = await db.select().from(match).where(eq(match.id, id)).limit(1);
  if (matches.length === 0) return null;
  const panels = await db
    .select()
    .from(panelAnnouncement)
    .where(eq(panelAnnouncement.matchId, id));
  const panelIds = panels.map((p) => p.id);
  const entries =
    panelIds.length > 0
      ? await db
          .select()
          .from(panelEntry)
          .where(inArray(panelEntry.panelAnnouncementId, panelIds))
      : [];
  const feeds = await db.select().from(feed);
  const [withPanels] = attachPanels(matches, panels, entries, feeds);
  return withPanels;
}

export async function getRecentMatches(
  limit = 30
): Promise<MatchWithPanels[]> {
  const matches = await db
    .select()
    .from(match)
    .orderBy(desc(match.date), desc(match.tossAt))
    .limit(limit);
  if (matches.length === 0) return [];
  const matchIds = matches.map((m) => m.id);
  const panels = await db
    .select()
    .from(panelAnnouncement)
    .where(inArray(panelAnnouncement.matchId, matchIds));
  const panelIds = panels.map((p) => p.id);
  const entries =
    panelIds.length > 0
      ? await db
          .select()
          .from(panelEntry)
          .where(inArray(panelEntry.panelAnnouncementId, panelIds))
      : [];
  const feeds = await db.select().from(feed);
  return attachPanels(matches, panels, entries, feeds);
}

export function todayInIstISO(): string {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffsetMs);
  return ist.toISOString().slice(0, 10);
}
