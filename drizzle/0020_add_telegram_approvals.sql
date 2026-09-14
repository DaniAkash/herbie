CREATE TABLE `telegram_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`permission_request_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`resolved_at` integer,
	`outcome` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `telegram_approvals_conv_idx` ON `telegram_approvals` (`conversation_id`);