import type { DB } from '../db'

let _db: DB | null = null

export function setDb(db: DB) {
  _db = db
}

export function getDb(): DB {
  if (!_db) throw new Error('db not initialised')
  return _db
}
