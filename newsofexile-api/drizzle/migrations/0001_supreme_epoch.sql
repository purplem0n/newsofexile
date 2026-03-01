CREATE TABLE `patch_note_updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`news_item_id` integer NOT NULL,
	`update_date` text NOT NULL,
	`content_html` text NOT NULL,
	`content_text` text NOT NULL,
	`is_poe1_format` integer DEFAULT true NOT NULL,
	`scraped_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`news_item_id`) REFERENCES `news_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patch_update_unique_idx` ON `patch_note_updates` (`news_item_id`,`update_date`);--> statement-breakpoint
CREATE INDEX `patch_update_news_item_idx` ON `patch_note_updates` (`news_item_id`);--> statement-breakpoint
CREATE INDEX `patch_update_date_idx` ON `patch_note_updates` (`update_date`);