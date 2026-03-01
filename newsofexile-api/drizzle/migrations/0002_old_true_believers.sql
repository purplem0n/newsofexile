CREATE TABLE `twitch_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`refreshed_at` text NOT NULL,
	`updated_at` text NOT NULL
);
