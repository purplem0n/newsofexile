CREATE TABLE `teaser_updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`news_item_id` integer NOT NULL,
	`content_hash` text NOT NULL,
	`word_count` integer NOT NULL,
	`content_text` text NOT NULL,
	`scraped_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`news_item_id`) REFERENCES `news_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teaser_update_unique_idx` ON `teaser_updates` (`news_item_id`,`content_hash`);--> statement-breakpoint
CREATE INDEX `teaser_update_news_item_idx` ON `teaser_updates` (`news_item_id`);--> statement-breakpoint
CREATE INDEX `teaser_update_date_idx` ON `teaser_updates` (`scraped_at`);