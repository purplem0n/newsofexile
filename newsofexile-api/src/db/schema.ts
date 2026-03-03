import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

/**
 * Helper to convert Date to ISO string for storage
 */
const dateToIsoString = (date: Date | string | null | undefined): string | null => {
  if (date === null || date === undefined) return null;
  if (typeof date === "string") return date;
  return date.toISOString();
};

/**
 * Content tags for news items (stored as JSON array)
 */
export const ContentTags = [
  "teaser",
  "twitch-drops",
  "launch",
  "competition",
  "sale",
  "concept-art",
  "interview",
  "build-showcase",
  "faq",
  "patch-update",
  "event",
  "merchandise",
  "community",
  "development",
  "announcement",
  "maintenance",
  "content-update",
  "rewards",
  "soundtrack",
  "recap",
  "livestream",
  "other",
] as const;

export type ContentTag = (typeof ContentTags)[number];

/**
 * News items scraped from Path of Exile websites
 * Combines POE1/POE2 news and patch notes
 */
export const newsItems = sqliteTable(
  "news_items",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    // Unique identifier from the source (e.g., post ID from forum)
    sourceId: text("source_id").notNull(),
    // Source type: "poe1-news", "poe1-patch", "poe2-news", "poe2-patch"
    sourceType: text("source_type").notNull(),
    // Display title
    title: text("title").notNull(),
    // Original URL on pathofexile.com
    url: text("url").notNull(),
    // Author name (if available)
    author: text("author"),
    // Preview text (first ~100 words of content)
    preview: text("preview"),
    // Total word count of the full article
    wordCount: integer("word_count"),
    // Content tags (JSON array of tags like ["teaser", "twitch-drops"])
    tags: text("tags").$default(() => "[]"),
    // Primary tag (highest priority tag for filtering)
    primaryTag: text("primary_tag"),
    // When the item was posted (from source) - stored as ISO string
    postedAt: text("posted_at").$type<Date | string | null>(),
    // When we scraped this item - stored as ISO string
    scrapedAt: text("scraped_at")
      .notNull()
      .$default(() => new Date().toISOString()),
    // When we last fetched the preview/content - stored as ISO string
    contentFetchedAt: text("content_fetched_at").$type<Date | string | null>(),
    // Whether this item is currently visible (1 = true, 0 = false in SQLite)
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    // When this record was last updated - stored as ISO string
    updatedAt: text("updated_at")
      .notNull()
      .$default(() => new Date().toISOString()),
    // When this item was last updated (new content detected) - stored as ISO string
    // This is used to surface updated items (teaser updates, patch note updates)
    lastUpdatedAt: text("last_updated_at")
      .$default(() => new Date().toISOString()),
  },
  (table) => [
    // Ensure unique combination of source ID and type
    uniqueIndex("source_unique_idx").on(table.sourceId, table.sourceType),
    // Index for filtering by source type
    index("source_type_idx").on(table.sourceType),
    // Index for filtering by primary tag
    index("primary_tag_idx").on(table.primaryTag),
    // Index for sorting by posted date
    index("posted_at_idx").on(table.postedAt),
    // Index for sorting by last update (for surfacing updated items)
    index("last_updated_at_idx").on(table.lastUpdatedAt),
    // Index for active items
    index("active_idx").on(table.isActive),
  ]
);

/**
 * System state for tracking cron job runs
 * Prevents duplicate runs when a previous run is still in progress
 */
export const systemState = sqliteTable("system_state", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  // Job name: "news-scraper"
  jobName: text("job_name").notNull().unique(),
  // Whether the job is currently running (1 = true, 0 = false in SQLite)
  isRunning: integer("is_running", { mode: "boolean" }).notNull().default(false),
  // When the job last started - stored as ISO string
  lastRunStartedAt: text("last_run_started_at").$type<Date | string | null>(),
  // When the job last completed successfully - stored as ISO string
  lastRunCompletedAt: text("last_run_completed_at").$type<Date | string | null>(),
  // Error message if last run failed
  lastError: text("last_error"),
  // Updated at timestamp - stored as ISO string
  updatedAt: text("updated_at")
    .notNull()
    .$default(() => new Date().toISOString()),
});

/**
 * Patch note updates detected from Content Update patch notes
 * Tracks when GGG adds updates to existing patch notes
 */
export const patchNoteUpdates = sqliteTable(
  "patch_note_updates",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    // Foreign key to the parent news item (Content Update patch note)
    newsItemId: integer("news_item_id", { mode: "number" })
      .notNull()
      .references(() => newsItems.id, { onDelete: "cascade" }),
    // The date string found in the update header (e.g., "2026-03-01" or "8-12-2025")
    updateDate: text("update_date").notNull(),
    // The raw HTML content of the update (inside the spoiler)
    contentHtml: text("content_html").notNull(),
    // Text content extracted from the HTML for searching/display
    contentText: text("content_text").notNull(),
    // Whether this is a POE1-style update (true) or POE2-style (false)
    isPoe1Format: integer("is_poe1_format", { mode: "boolean" }).notNull().default(true),
    // When this update was first detected/scraped - stored as ISO string
    scrapedAt: text("scraped_at")
      .notNull()
      .$default(() => new Date().toISOString()),
    // When this record was last updated - stored as ISO string
    updatedAt: text("updated_at")
      .notNull()
      .$default(() => new Date().toISOString()),
  },
  (table) => [
    // Ensure unique combination of news item and update date
    uniqueIndex("patch_update_unique_idx").on(table.newsItemId, table.updateDate),
    // Index for finding updates by news item
    index("patch_update_news_item_idx").on(table.newsItemId),
    // Index for sorting by date
    index("patch_update_date_idx").on(table.updateDate),
  ]
);

/**
 * Teaser updates detected from news posts with "teasers" in the title
 * Tracks when GGG adds new teaser content to existing teaser posts
 */
export const teaserUpdates = sqliteTable(
  "teaser_updates",
  {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    // Foreign key to the parent news item (teaser post)
    newsItemId: integer("news_item_id", { mode: "number" })
      .notNull()
      .references(() => newsItems.id, { onDelete: "cascade" }),
    // Content hash of the teaser post at time of detection (for comparing changes)
    contentHash: text("content_hash").notNull(),
    // Word count at time of detection
    wordCount: integer("word_count", { mode: "number" }).notNull(),
    // The actual content text at this update
    contentText: text("content_text").notNull(),
    // When this update was first detected/scraped - stored as ISO string
    scrapedAt: text("scraped_at")
      .notNull()
      .$default(() => new Date().toISOString()),
    // When this record was last updated - stored as ISO string
    updatedAt: text("updated_at")
      .notNull()
      .$default(() => new Date().toISOString()),
  },
  (table) => [
    // Ensure unique combination of news item and content hash
    uniqueIndex("teaser_update_unique_idx").on(table.newsItemId, table.contentHash),
    // Index for finding updates by news item
    index("teaser_update_news_item_idx").on(table.newsItemId),
    // Index for sorting by date
    index("teaser_update_date_idx").on(table.scrapedAt),
  ]
);

/**
 * Define relations between tables
 */
export const newsItemsRelations = relations(newsItems, ({ many }) => ({
  patchUpdates: many(patchNoteUpdates),
  teaserUpdates: many(teaserUpdates),
}));

export const patchNoteUpdatesRelations = relations(patchNoteUpdates, ({ one }) => ({
  newsItem: one(newsItems, {
    fields: [patchNoteUpdates.newsItemId],
    references: [newsItems.id],
  }),
}));

export const teaserUpdatesRelations = relations(teaserUpdates, ({ one }) => ({
  newsItem: one(newsItems, {
    fields: [teaserUpdates.newsItemId],
    references: [newsItems.id],
  }),
}));

// Type exports for TypeScript
export type NewsItem = typeof newsItems.$inferSelect;
export type NewNewsItem = typeof newsItems.$inferInsert;
export type SystemState = typeof systemState.$inferSelect;
export type NewSystemState = typeof systemState.$inferInsert;
export type PatchNoteUpdate = typeof patchNoteUpdates.$inferSelect;
export type NewPatchNoteUpdate = typeof patchNoteUpdates.$inferInsert;
export type TeaserUpdate = typeof teaserUpdates.$inferSelect;
export type NewTeaserUpdate = typeof teaserUpdates.$inferInsert;
