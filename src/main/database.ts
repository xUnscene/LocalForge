import Database from 'better-sqlite3'
import type { Database as DB } from 'better-sqlite3'

let db: DB | undefined

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

export interface GenerationRecord {
  id: string
  prompt: string
  seed: number
  model: string
  output_path: string
  thumbnail_path: string
  created_at: number
}

export function insertGeneration(record: GenerationRecord): void {
  const db = getDatabase()
  db.prepare(`
    INSERT INTO generations (id, prompt, seed, model, output_path, thumbnail_path, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.prompt,
    record.seed,
    record.model,
    record.output_path,
    record.thumbnail_path,
    record.created_at,
  )
}

export function closeDatabase(): void {
  db?.close()
  db = undefined
}
