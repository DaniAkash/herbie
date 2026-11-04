CREATE TABLE `agent_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`kind` text NOT NULL,
	`phrase` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `runtimes` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`install_state` text NOT NULL,
	`version` text,
	`install_url` text DEFAULT '' NOT NULL,
	`signed_in` integer DEFAULT false NOT NULL,
	`supports_config_option` integer DEFAULT false NOT NULL,
	`models` text DEFAULT '[]' NOT NULL,
	`model_values` text DEFAULT '[]' NOT NULL,
	`efforts` text DEFAULT '[]' NOT NULL,
	`probed_at` text,
	`probe_error` text
);
--> statement-breakpoint
ALTER TABLE `agents` ADD `autonomy` text DEFAULT 'ask' NOT NULL;--> statement-breakpoint
ALTER TABLE `agents` ADD `ask_on_telegram` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `agents` ADD `telegram_results` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `routines` ADD `cron` text;--> statement-breakpoint
ALTER TABLE `routines` ADD `prompt` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `routines` ADD `deliver_telegram` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `agent_tools_agent_kind_ref` ON `agent_tools` (`agent_id`,`kind`,`ref_id`);