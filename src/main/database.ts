import Database from 'better-sqlite3'
import type { Database as DB } from 'better-sqlite3'

let db: DB

export function initDatabase(dbPath: string): void {
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS generations (
      id            TEXT PRIMARY KEY,
      prompt        TEXT NOT NULL,
      seed          INTEGER NOT NULL,
      model         TEXT NOT NULL,
      output_path   TEXT NOT NULL,
      thumbnail_path TEXT NOT NULL,
      created_at    INTEGER NOT NULL
    )
  `)
}

export function getDatabase(): DB {
  if (!db) throw new Error('Database not initialized — call initDatabase() first')
  return db
}
