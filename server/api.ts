import type { Plugin } from 'vite'
import express from 'express'
import Database from 'better-sqlite3'
import path from 'node:path'

const DB_PATH = path.resolve(process.cwd(), 'backend/data/glpi.db')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('busy_timeout = 10000')

db.exec(`
  CREATE TABLE IF NOT EXISTS ticket_supercosts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    batch INTEGER NOT NULL,
    itemtype TEXT NOT NULL,
    items_id INTEGER NOT NULL,
    amount REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ticket_reopen_costs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    batch INTEGER NOT NULL,
    itemtype TEXT NOT NULL,
    items_id INTEGER NOT NULL,
    amount REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT,
    serial_number TEXT,
    location TEXT,
    status TEXT
  );
`)

const settingsCount = (db.prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number }).c
if (settingsCount === 0) {
  const ins = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  const defaults: [string, string][] = [
    ['kanban_color_new', '#FFE5E5'],
    ['kanban_color_in_progress', '#FFF4E5'],
    ['kanban_color_done', '#E5FFE5'],
    ['status_name_new', 'Vaovao'],
    ['status_name_in_progress', 'Efa manao'],
    ['status_name_done', 'Vita'],
    ['kanban_title_new', 'Nouveau'],
    ['kanban_title_in_progress', 'En cours'],
    ['kanban_title_done', 'Terminé'],
  ]
  db.transaction(() => { for (const [k, v] of defaults) ins.run(k, v) })()
}

const TRACKED_TYPES = new Set(['Computer', 'Phone', 'Monitor'])

const app = express()
app.use(express.json({ strict: false }))

// ─────────────────────────────────────────────────────────────
// /api/item-supercosts
// ─────────────────────────────────────────────────────────────

app.get('/api/item-supercosts', (_req, res) => {
  type Row = { itemtype: string; total: number }
  const superRows = db.prepare('SELECT itemtype, SUM(amount) as total FROM ticket_supercosts GROUP BY itemtype').all() as Row[]
  const reopenRows = db.prepare('SELECT itemtype, SUM(amount) as total FROM ticket_reopen_costs GROUP BY itemtype').all() as Row[]

  const superMap = new Map(superRows.map(r => [r.itemtype, r.total]))
  const reopenMap = new Map(reopenRows.map(r => [r.itemtype, r.total]))
  const allTypes = new Set([...superMap.keys(), ...reopenMap.keys()])

  res.json(
    [...allTypes]
      .map(t => ({ itemtype: t, superCost: superMap.get(t) ?? 0, reopenCost: reopenMap.get(t) ?? 0 }))
      .sort((a, b) => a.itemtype.localeCompare(b.itemtype))
  )
})

app.post('/api/item-supercosts', (req, res) => {
  const { ticketId, amount, items } = req.body as {
    ticketId: number; amount: number; items: { itemtype: string; itemsId: number }[]
  }
  const tracked = items.filter(i => TRACKED_TYPES.has(i.itemtype))
  if (tracked.length === 0) { res.json({ saved: 0 }); return }

  const maxBatchRow = db.prepare('SELECT MAX(batch) as m FROM ticket_supercosts WHERE ticket_id = ?').get(ticketId) as { m: number | null }
  const nextBatch = (maxBatchRow.m ?? 0) + 1
  const share = amount / tracked.length

  const ins = db.prepare('INSERT INTO ticket_supercosts (ticket_id, batch, itemtype, items_id, amount) VALUES (?, ?, ?, ?, ?)')
  db.transaction(() => { for (const item of tracked) ins.run(ticketId, nextBatch, item.itemtype, item.itemsId, share) })()

  res.json({ saved: tracked.length })
})

app.post('/api/item-supercosts/reopen', (req, res) => {
  const { ticketId, percent } = req.body as { ticketId: number; percent: number }
  const maxBatchRow = db.prepare('SELECT MAX(batch) as m FROM ticket_supercosts WHERE ticket_id = ?').get(ticketId) as { m: number | null }
  if (maxBatchRow.m === null) { res.status(200).end(); return }

  type ScRow = { ticket_id: number; batch: number; itemtype: string; items_id: number; amount: number }
  const lastBatch = db.prepare('SELECT * FROM ticket_supercosts WHERE ticket_id = ? AND batch = ?').all(ticketId, maxBatchRow.m) as ScRow[]
  const ins = db.prepare('INSERT INTO ticket_reopen_costs (ticket_id, batch, itemtype, items_id, amount) VALUES (?, ?, ?, ?, ?)')
  db.transaction(() => {
    for (const sc of lastBatch) ins.run(sc.ticket_id, sc.batch, sc.itemtype, sc.items_id, sc.amount * (percent / 100))
  })()
  res.status(200).end()
})

app.post('/api/item-supercosts/cancel', (req, res) => {
  const { ticketId } = req.body as { ticketId: number }
  const maxBatchRow = db.prepare('SELECT MAX(batch) as m FROM ticket_supercosts WHERE ticket_id = ?').get(ticketId) as { m: number | null }
  if (maxBatchRow.m === null) { res.json({ removed: 0 }); return }
  const result = db.prepare('DELETE FROM ticket_supercosts WHERE ticket_id = ? AND batch = ?').run(ticketId, maxBatchRow.m)
  res.json({ removed: result.changes })
})

app.get('/api/item-supercosts/:ticketId/last-batch-total', (req, res) => {
  const ticketId = Number(req.params.ticketId)
  const maxBatchRow = db.prepare('SELECT MAX(batch) as m FROM ticket_supercosts WHERE ticket_id = ?').get(ticketId) as { m: number | null }
  if (maxBatchRow.m === null) { res.json(0); return }
  const totalRow = db.prepare('SELECT SUM(amount) as total FROM ticket_supercosts WHERE ticket_id = ? AND batch = ?').get(ticketId, maxBatchRow.m) as { total: number | null }
  res.json(totalRow.total ?? 0)
})

app.get('/api/item-supercosts/details/:itemtype', (req, res) => {
  const { itemtype } = req.params
  type ScRow = { ticket_id: number; batch: number; items_id: number; amount: number }
  const supercosts = db.prepare('SELECT ticket_id, batch, items_id, amount FROM ticket_supercosts WHERE itemtype = ?').all(itemtype) as ScRow[]
  const reopencosts = db.prepare('SELECT ticket_id, batch, items_id, amount FROM ticket_reopen_costs WHERE itemtype = ?').all(itemtype) as ScRow[]
  res.json({ supercosts, reopencosts })
})

app.post('/api/item-supercosts/reset', (_req, res) => {
  db.transaction(() => {
    db.prepare('DELETE FROM ticket_supercosts').run()
    db.prepare('DELETE FROM ticket_reopen_costs').run()
  })()
  res.status(200).end()
})

// ─────────────────────────────────────────────────────────────
// /api/backoffice/settings
// ─────────────────────────────────────────────────────────────

app.get('/api/backoffice/settings', (_req, res) => {
  res.json(db.prepare('SELECT key, value FROM settings').all())
})

app.get('/api/backoffice/settings/:key', (req, res) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(req.params.key) as { value: string } | undefined
  res.json(row?.value ?? '')
})

app.put('/api/backoffice/settings/:key', (req, res) => {
  const { key } = req.params
  let value: string = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
  res.json(db.prepare('SELECT key, value FROM settings WHERE key = ?').get(key))
})

// ─────────────────────────────────────────────────────────────
// /api/assets
// ─────────────────────────────────────────────────────────────

type AssetRow = { id: number; name: string; type: string | null; serial_number: string | null; location: string | null; status: string | null }
const toAssetJson = (row: AssetRow) => ({ id: row.id, name: row.name, type: row.type, serialNumber: row.serial_number, location: row.location, status: row.status })

app.get('/api/assets', (_req, res) => {
  res.json((db.prepare('SELECT * FROM assets').all() as AssetRow[]).map(toAssetJson))
})

app.get('/api/assets/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(Number(req.params.id)) as AssetRow | undefined
  if (!row) { res.status(404).end(); return }
  res.json(toAssetJson(row))
})

app.post('/api/assets', (req, res) => {
  const { name, type, serialNumber, location, status } = req.body as { name: string; type?: string; serialNumber?: string; location?: string; status?: string }
  if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return }
  const result = db.prepare('INSERT INTO assets (name, type, serial_number, location, status) VALUES (?, ?, ?, ?, ?)').run(name, type ?? null, serialNumber ?? null, location ?? null, status ?? null)
  res.json(toAssetJson(db.prepare('SELECT * FROM assets WHERE id = ?').get(result.lastInsertRowid) as AssetRow))
})

app.put('/api/assets/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!db.prepare('SELECT id FROM assets WHERE id = ?').get(id)) { res.status(404).end(); return }
  const { name, type, serialNumber, location, status } = req.body as { name: string; type?: string; serialNumber?: string; location?: string; status?: string }
  if (!name?.trim()) { res.status(400).json({ error: 'name is required' }); return }
  db.prepare('UPDATE assets SET name = ?, type = ?, serial_number = ?, location = ?, status = ? WHERE id = ?').run(name, type ?? null, serialNumber ?? null, location ?? null, status ?? null, id)
  res.json(toAssetJson(db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as AssetRow))
})

app.delete('/api/assets/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!db.prepare('SELECT id FROM assets WHERE id = ?').get(id)) { res.status(404).end(); return }
  db.prepare('DELETE FROM assets WHERE id = ?').run(id)
  res.status(204).end()
})

// ─────────────────────────────────────────────────────────────
// /api/sqlite
// ─────────────────────────────────────────────────────────────

app.get('/api/sqlite/tables', (_req, res) => {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]
  res.json(tables.map(t => ({
    name: t.name,
    rowCount: (db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get() as { c: number }).c,
  })))
})

app.post('/api/sqlite/tables/reset', (req, res) => {
  const { tableNames } = req.body as { tableNames: string[] }
  if (!tableNames?.length) {
    res.status(400).json({ success: false, message: 'tableNames est requis', totalDeleted: 0, resetTables: [] })
    return
  }
  const existingTables = new Set(
    (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]).map(t => t.name)
  )
  const validTables = tableNames.filter(t => existingTables.has(t))
  const resetTables: string[] = []
  let totalDeleted = 0
  db.transaction(() => {
    for (const table of validTables) {
      const r = db.prepare(`DELETE FROM "${table}"`).run()
      totalDeleted += r.changes
      resetTables.push(table)
    }
  })()
  const message = resetTables.length === 0
    ? 'Aucune table valide trouvée parmi les tables demandées.'
    : `${resetTables.length} table(s) réinitialisée(s), ${totalDeleted} ligne(s) supprimée(s).`
  res.json({ success: true, message, totalDeleted, resetTables })
})

// ─────────────────────────────────────────────────────────────
export function apiPlugin(): Plugin {
  return {
    name: 'api',
    configureServer(server) {
      server.middlewares.use(app)
    },
  }
}
