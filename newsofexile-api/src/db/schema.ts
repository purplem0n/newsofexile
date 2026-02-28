import { pgTable, text, integer, timestamp, boolean, index } from "drizzle-orm/pg-core";

/**
 * News items scraped from Path of Exile websites
 * Combines POE1/POE2 news and patch notes
 */
export const newsItems = pgTable(
  "news_items",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
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
    // When the item was posted (from source)
    postedAt: timestamp("posted_at", { withTimezone: true }),
    // When we scraped this item
    scrapedAt: timestamp("scraped_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // When we last fetched the preview/content
    contentFetchedAt: timestamp("content_fetched_at", { withTimezone: true }),
    // Whether this item is currently visible
    isActive: boolean("is_active").notNull().default(true),
    // When this record was last updated
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Ensure unique combination of source ID and type
    index("source_unique_idx").on(table.sourceId, table.sourceType),
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
export const systemState = pgTable("system_state", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  // Job name: "index-scraper", "content-fetcher"
  jobName: text("job_name").notNull().unique(),
  // Whether the job is currently running
  isRunning: boolean("is_running").notNull().default(false),
  // When the job last started
  lastRunStartedAt: timestamp("last_run_started_at", { withTimezone: true }),
  // When the job last completed successfully
  lastRunCompletedAt: timestamp("last_run_completed_at", { withTimezone: true }),
  // Error message if last run failed
  lastError: text("last_error"),
  // Updated at timestamp
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Type exports for TypeScript
export type NewsItem = typeof newsItems.$inferSelect;
export type NewNewsItem = typeof newsItems.$inferInsert;
export type SystemState = typeof systemState.$inferSelect;
export type NewSystemState = typeof systemState.$inferInsert;
