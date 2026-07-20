CREATE TABLE `editions` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`slot` text NOT NULL,
	`generated_at` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `source_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`checked_at` text NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL
);
