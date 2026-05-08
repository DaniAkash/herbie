CREATE TABLE `app_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`launch_at_login` integer DEFAULT false NOT NULL,
	`minimize_to_menubar_on_close` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL
);
