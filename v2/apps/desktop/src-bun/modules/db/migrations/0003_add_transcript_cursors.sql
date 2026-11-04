CREATE TABLE `transcript_cursors` (
	`agent_id` text PRIMARY KEY NOT NULL,
	`last_seq` integer DEFAULT 0 NOT NULL,
	`last_at` text DEFAULT (current_timestamp) NOT NULL,
	`unread_from` integer,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade
);
