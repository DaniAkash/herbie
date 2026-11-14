CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`reason` text,
	`agent_id` text NOT NULL,
	`turn_id` text,
	`collapse_key` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`route` text NOT NULL,
	`updates` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`delivered_at` text,
	`seen_at` text,
	`dismissed_at` text,
	`channels` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_agent` ON `notifications` (`agent_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `notifications_seen` ON `notifications` (`seen_at`);