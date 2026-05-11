ALTER TABLE `inbox_items` ADD `body_source` text DEFAULT 'text' NOT NULL;--> statement-breakpoint
ALTER TABLE `task_runs` ADD `result_markdown` text;--> statement-breakpoint
ALTER TABLE `task_runs` ADD `output_source` text DEFAULT 'text' NOT NULL;