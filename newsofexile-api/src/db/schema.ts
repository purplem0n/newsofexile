import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Helper to convert Date to ISO string for storage
 */
const dateToIsoString = (date: Date | string | null | undefined): string | null => {
  if (date === null || date === undefined) return null;
  if (typeof date === "string") return date;
  return date.toISOString();
};

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
  },
  (table) => [
    // Ensure unique combination of source ID and type
    uniqueIndex("source_unique_idx").on(table.sourceId, table.sourceType),
    // Index for filtering by source type
    index("source_type_idx").on(table.sourceType),
    // Index for sorting by posted date
    index("posted_at_idx").on(table.postedAt),
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

// Type exports for TypeScript
export type NewsItem = typeof newsItems.$inferSelect;
export type NewNewsItem = typeof newsItems.$inferInsert;
export type SystemState = typeof systemState.$inferSelect;
export type NewSystemState = typeof systemState.$inferInsert;
