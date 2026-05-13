CREATE TABLE `telegram_chats` (
	`id` text PRIMARY KEY NOT NULL,
	`connection_id` text NOT NULL,
	`telegram_chat_id` text NOT NULL,
	`chat_kind` text NOT NULL,
	`chat_title` text,
	`conversation_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `telegram_connections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_chats_conn_chat_unique` ON `telegram_chats` (`connection_id`,`telegram_chat_id`);--> statement-breakpoint
CREATE TABLE `telegram_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`bot_username` text,
	`bot_token_encrypted` text NOT NULL,
	`agent_id` text NOT NULL,
	`model_id` text,
	`workspace_path` text NOT NULL,
	`reasoning_effort` text,
	`status` text DEFAULT 'active' NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `conversations` ADD `origin` text DEFAULT 'chat' NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `archived_at` integer;