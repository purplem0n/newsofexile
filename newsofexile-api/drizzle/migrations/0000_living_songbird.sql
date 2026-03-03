CREATE TABLE `news_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` text NOT NULL,
	`source_type` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`author` text,
	`preview` text,
	`word_count` integer,
	`tags` text,
	`primary_tag` text,
	`posted_at` text,
	`scraped_at` text NOT NULL,
	`content_fetched_at` text,
	`is_active` integer DEFAULT true NOT NULL,
	`updated_at` text NOT NULL,
	`last_updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_unique_idx` ON `news_items` (`source_id`,`source_type`);--> statement-breakpoint
CREATE INDEX `source_type_idx` ON `news_items` (`source_type`);--> statement-breakpoint
CREATE INDEX `primary_tag_idx` ON `news_items` (`primary_tag`);--> statement-breakpoint
CREATE INDEX `posted_at_idx` ON `news_items` (`posted_at`);--> statement-breakpoint
CREATE INDEX `last_updated_at_idx` ON `news_items` (`last_updated_at`);--> statement-breakpoint
CREATE INDEX `active_idx` ON `news_items` (`is_active`);--> statement-breakpoint
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
CREATE INDEX `patch_update_date_idx` ON `patch_note_updates` (`update_date`);--> statement-breakpoint
CREATE TABLE `system_state` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_name` text NOT NULL,
	`is_running` integer DEFAULT false NOT NULL,
	`last_run_started_at` text,
	`last_run_completed_at` text,
	`last_error` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_state_job_name_unique` ON `system_state` (`job_name`);--> statement-breakpoint
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