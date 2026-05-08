import {
  pgTable,
  text,
  timestamp,
  date,
  boolean,
  integer,
  doublePrecision,
  jsonb,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const feedIdEnum = pgEnum('feed_id', [
  'english',
  'star-sports-hindi',
  'jiohotstar-hindi-championswaali',
]);

export const panelStatusEnum = pgEnum('panel_status', [
  'confirmed',
  'unverified',
]);

export const panelSourceEnum = pgEnum('panel_source', [
  'manual-upload',
  'manual-url-paste',
]);

export const match = pgTable(
  'match',
  {
    id: text('id').primaryKey(),
    date: date('date').notNull(),
    tossAt: timestamp('toss_at', { withTimezone: true }),
    homeTeam: text('home_team').notNull(),
    awayTeam: text('away_team').notNull(),
    marquee: boolean('marquee'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex('match_date_teams_uniq').on(t.date, t.homeTeam, t.awayTeam),
  ]
);

export const feed = pgTable('feed', {
  id: feedIdEnum('id').primaryKey(),
  displayName: text('display_name').notNull(),
  language: text('language').notNull(),
  broadcaster: text('broadcaster').notNull(),
});

export const panelAnnouncement = pgTable(
  'panel_announcement',
  {
    id: text('id').primaryKey(),
    matchId: text('match_id')
      .notNull()
      .references(() => match.id, { onDelete: 'cascade' }),
    feedId: feedIdEnum('feed_id').notNull(),
    source: panelSourceEnum('source').notNull(),
    sourceUrl: text('source_url'),
    rawBlobPath: text('raw_blob_path').notNull(),
    parsedAt: timestamp('parsed_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    confidence: doublePrecision('confidence').notNull(),
    status: panelStatusEnum('status').notNull(),
    rawParseJson: jsonb('raw_parse_json'),
  },
  (t) => [
    uniqueIndex('panel_match_feed_uniq').on(t.matchId, t.feedId),
  ]
);

export const panelEntry = pgTable('panel_entry', {
  id: text('id').primaryKey(),
  panelAnnouncementId: text('panel_announcement_id')
    .notNull()
    .references(() => panelAnnouncement.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  nameAsShown: text('name_as_shown').notNull(),
});

export const matchRelations = relations(match, ({ many }) => ({
  panels: many(panelAnnouncement),
}));

export const panelAnnouncementRelations = relations(
  panelAnnouncement,
  ({ one, many }) => ({
    match: one(match, {
      fields: [panelAnnouncement.matchId],
      references: [match.id],
    }),
    feed: one(feed, {
      fields: [panelAnnouncement.feedId],
      references: [feed.id],
    }),
    entries: many(panelEntry),
  })
);

export const panelEntryRelations = relations(panelEntry, ({ one }) => ({
  panel: one(panelAnnouncement, {
    fields: [panelEntry.panelAnnouncementId],
    references: [panelAnnouncement.id],
  }),
}));

export type Match = typeof match.$inferSelect;
export type NewMatch = typeof match.$inferInsert;
export type Feed = typeof feed.$inferSelect;
export type PanelAnnouncement = typeof panelAnnouncement.$inferSelect;
export type NewPanelAnnouncement = typeof panelAnnouncement.$inferInsert;
export type PanelEntry = typeof panelEntry.$inferSelect;
export type NewPanelEntry = typeof panelEntry.$inferInsert;
