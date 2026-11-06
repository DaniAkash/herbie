import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * The agent registry.
 *
 * An agent is the assistant you create and talk to. `acpAgent` names which
 * coding agent backs it, which is the only part the sidecar hands to acpx,
 * and it is per agent: one can run on claude while another runs on codex.
 *
 * Each agent gets its own workspace directory, so two agents editing the same
 * repository cannot fight over a working tree.
 */
export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  acpAgent: text('acp_agent').notNull(),
  workspaceDir: text('workspace_dir').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),

  /** One of the six face colours. Identity only, never an accent. */
  color: text('color').notNull().default('ops'),
  shape: text('shape').notNull().default('squircle'),
  /** The standing brief, prepended to every turn. */
  brief: text('brief').notNull().default(''),
  /** idle | working | stuck | off. Owned by the loop, read by the rail. */
  state: text('state').notNull().default('idle'),
  /** What the agent is doing right now, when it is working. */
  activity: text('activity'),
  model: text('model'),
  effort: text('effort').notNull().default('medium'),
  /** Its own Telegram bot, not one shared with every other agent. */
  telegramBot: text('telegram_bot'),

  /**
   * ask | auto. Whether it may act without waiting for you.
   *
   * Defaults to ask, so an agent that has just been created cannot do
   * anything on its own before you have looked at what it can reach.
   */
  autonomy: text('autonomy').notNull().default('ask'),
  /** Message you from its own bot when it is unsure, rather than waiting. */
  askOnTelegram: integer('ask_on_telegram', { mode: 'boolean' })
    .notNull()
    .default(false),
  /** Send routine results to Telegram as well as the conversation. */
  telegramResults: integer('telegram_results', { mode: 'boolean' })
    .notNull()
    .default(false),

  /**
   * Bumped when the runtime refuses to resume this agent's session.
   *
   * It is part of the session key, so raising it retires the key the runtime
   * cannot load and the next turn creates a session instead of resuming a
   * dead one. Persisted rather than held in memory because a refusal
   * survives a restart and would otherwise be met once per launch, forever.
   */
  sessionGeneration: integer('session_generation').notNull().default(0),
})
