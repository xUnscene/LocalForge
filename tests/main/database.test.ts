// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { initDatabase, getDatabase, closeDatabase } from '../../src/main/database'

let tmpDir: string

describe('database', () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'localforge-test-'))
    initDatabase(join(tmpDir, 'test.db'))
  })

  afterEach(() => {
    closeDatabase()
    rmSync(tmpDir, { recursive: true })
  })

  it('creates generations table', () => {
    const db = getDatabase()
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
    const names = (tables as Array<{ name: string }>).map((t) => t.name)
    expect(names).toContain('generations')
  })

  it('inserts and retrieves a generation record', () => {
    const db = getDatabase()
    db.prepare(`
      INSERT INTO generations (id, prompt, seed, model, output_path, thumbnail_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('test-id-1', 'a cat', 42, 'z-image', '/outputs/test.png', '/thumbnails/test.jpg', Date.now())

    const row = db.prepare('SELECT * FROM generations WHERE id = ?').get('test-id-1') as {
      prompt: string; seed: number; model: string
    }
    expect(row.prompt).toBe('a cat')
    expect(row.seed).toBe(42)
    expect(row.model).toBe('z-image')
  })

  it('retrieves all generations ordered by created_at desc', () => {
    const db = getDatabase()
    const insert = db.prepare(`
      INSERT INTO generations (id, prompt, seed, model, output_path, thumbnail_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    insert.run('id-1', 'first', 1, 'z-image', '/out/1.png', '/thumb/1.jpg', 1000)
    insert.run('id-2', 'second', 2, 'z-image', '/out/2.png', '/thumb/2.jpg', 2000)

    const rows = db.prepare('SELECT * FROM generations ORDER BY created_at DESC').all() as Array<{ id: string }>
    expect(rows[0].id).toBe('id-2')
    expect(rows[1].id).toBe('id-1')
  })
})
