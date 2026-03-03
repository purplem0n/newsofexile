ALTER TABLE `news_items` ADD `tags` text;--> statement-breakpoint
ALTER TABLE `news_items` ADD `primary_tag` text;--> statement-breakpoint
CREATE INDEX `primary_tag_idx` ON `news_items` (`primary_tag`);