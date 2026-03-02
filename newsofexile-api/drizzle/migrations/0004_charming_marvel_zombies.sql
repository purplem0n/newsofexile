ALTER TABLE `news_items` ADD `last_updated_at` text;--> statement-breakpoint
CREATE INDEX `last_updated_at_idx` ON `news_items` (`last_updated_at`);