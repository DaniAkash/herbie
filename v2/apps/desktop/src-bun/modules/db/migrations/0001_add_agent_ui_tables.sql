CREATE TABLE `agent_tools` (
	`agent_id` text NOT NULL,
	`kind` text NOT NULL,
	`ref_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mcp_servers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'stdio' NOT NULL,
	`target` text NOT NULL,
	`args` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'running' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`role` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `routines` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'schedule' NOT NULL,
	`cadence` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`last_run_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE `agents` ADD `color` text DEFAULT 'ops' NOT NULL;--> statement-breakpoint
ALTER TABLE `agents` ADD `brief` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `agents` ADD `state` text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE `agents` ADD `activity` text;--> statement-breakpoint
ALTER TABLE `agents` ADD `model` text;--> statement-breakpoint
ALTER TABLE `agents` ADD `effort` text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE `agents` ADD `telegram_bot` text;