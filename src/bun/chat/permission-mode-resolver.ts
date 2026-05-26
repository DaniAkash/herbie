import type { Conversation } from '../../db/schema/conversations.sql'
import {
  PERMISSION_MODES,
  type PermissionMode,
  readSettings,
} from '../routes/settings'

// Reads the effective permission mode for a conversation:
//   1. conv.permission_mode column (set at create-time or via the
//      composer picker's eager PATCH).
//   2. settings.general.defaultPermissionMode — fallback for legacy
//      rows whose column is NULL (every conversation predating the
//      0018_known_maestro migration).
//   3. hard-coded 'auto-approve-reads' — final fallback if a future
//      schema migration corrupts the settings row. Belt + braces.
//
// Returns one of the four valid PermissionMode strings, never null.
// Tolerates unknown column values (e.g. forward-compat from a future
// build that introduces a new mode) by falling through to the
// settings default.
export async function resolvePermissionMode(
  conv: Conversation,
): Promise<PermissionMode> {
  if (conv.permissionMode && isValidMode(conv.permissionMode)) {
    return conv.permissionMode
  }
  const settings = await readSettings()
  return settings.general.defaultPermissionMode
}

function isValidMode(value: string): value is PermissionMode {
  return (PERMISSION_MODES as readonly string[]).includes(value)
}
