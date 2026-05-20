CREATE TABLE `telegram_active_chat` (
	`connection_id` text NOT NULL,
	`telegram_chat_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`connection_id`, `telegram_chat_id`),
	FOREIGN KEY (`connection_id`) REFERENCES `telegram_connections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
