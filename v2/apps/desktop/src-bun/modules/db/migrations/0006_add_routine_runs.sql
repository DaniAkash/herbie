CREATE TABLE `routine_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`routine_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`source` text DEFAULT 'routine' NOT NULL,
	`state` text DEFAULT 'queued' NOT NULL,
	`due_at` text NOT NULL,
	`claimed_at` text,
	`lease_until` text,
	`turn_id` text,
	`attempt` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `routine_runs_slot` ON `routine_runs` (`routine_id`,`due_at`);