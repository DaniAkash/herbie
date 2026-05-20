ALTER TABLE `telegram_connections` ADD `kind` text DEFAULT 'special_purpose' NOT NULL;--> statement-breakpoint
ALTER TABLE `telegram_connections` ADD `default_conversation_id` text REFERENCES conversations(id) ON DELETE SET NULL;--> statement-breakpoint
-- Backfill: every existing bot was 1:1 with a conversation via the
-- telegram_chats unique index. Point its new default_conversation_id at
-- that conversation so post-upgrade routing keeps working without the
-- user having to re-link anything. New 'special_purpose' kind (the
-- column default) reflects the same fact: existing bots are all dedicated.
UPDATE `telegram_connections`
SET `default_conversation_id` = (
  SELECT `conversation_id` FROM `telegram_chats`
  WHERE `telegram_chats`.`connection_id` = `telegram_connections`.`id`
  LIMIT 1
);
