CREATE TABLE `telegram_topics` (
	`conversation_id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`telegram_chat_id` text NOT NULL,
	`message_thread_id` integer,
	`topic_title` text,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `telegram_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_topics_thread_unique` ON `telegram_topics` (`connection_id`,`telegram_chat_id`,`message_thread_id`);--> statement-breakpoint
CREATE INDEX `telegram_topics_conn_idx` ON `telegram_topics` (`connection_id`);--> statement-breakpoint
ALTER TABLE `telegram_connections` ADD `dm_chat_id` text;--> statement-breakpoint
ALTER TABLE `telegram_connections` ADD `topics_enabled` integer DEFAULT false NOT NULL;