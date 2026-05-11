CREATE TABLE `inbox_items` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`task_name` text NOT NULL,
	`task_run_id` text NOT NULL,
	`body` text NOT NULL,
	`agent_id` text NOT NULL,
	`model_id` text,
	`workspace_path` text,
	`reasoning_effort` text,
	`prompt_snapshot` text NOT NULL,
	`status` text DEFAULT 'unread' NOT NULL,
	`starred` integer DEFAULT false NOT NULL,
	`error_message` text,
	`error_code` text,
	`error_details` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_run_id`) REFERENCES `task_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `task_run_events` (
	`run_id` text NOT NULL,
	`seq` integer NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`run_id`, `seq`),
	FOREIGN KEY (`run_id`) REFERENCES `task_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `task_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`prompt_snapshot` text NOT NULL,
	`agent_id` text NOT NULL,
	`model_id` text,
	`workspace_path` text,
	`reasoning_effort` text,
	`trigger` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`result_text` text,
	`error_message` text,
	`error_code` text,
	`error_details` text,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`prompt` text NOT NULL,
	`agent_id` text NOT NULL,
	`model_id` text,
	`workspace_path` text,
	`reasoning_effort` text,
	`schedule_json` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`outputs_json` text DEFAULT '[]' NOT NULL,
	`last_run_at` integer,
	`next_run_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
