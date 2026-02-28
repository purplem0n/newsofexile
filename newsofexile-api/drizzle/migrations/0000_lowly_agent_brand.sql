CREATE TABLE `news_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` text NOT NULL,
	`source_type` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`author` text,
	`preview` text,
	`word_count` integer,
	`posted_at` text,
	`scraped_at` text NOT NULL,
	`content_fetched_at` text,
	`is_active` integer DEFAULT true NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_unique_idx` ON `news_items` (`source_id`,`source_type`);--> statement-breakpoint
CREATE INDEX `source_type_idx` ON `news_items` (`source_type`);--> statement-breakpoint
CREATE INDEX `posted_at_idx` ON `news_items` (`posted_at`);--> statement-breakpoint
CREATE INDEX `active_idx` ON `news_items` (`is_active`);--> statement-breakpoint
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
CREATE UNIQUE INDEX `system_state_job_name_unique` ON `system_state` (`job_name`);