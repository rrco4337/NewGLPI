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
    amount REAL NOT NULL,
    mode INTEGER NOT NULL DEFAULT 1,
    percent REAL NOT NULL DEFAULT 0,
    closed INTEGER NOT NULL DEFAULT 0,
    reopen_group INTEGER
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

// Migration : colonnes ajoutées au fil du temps sur ticket_reopen_costs pour les bases existantes
const reopenCols = db.prepare("PRAGMA table_info(ticket_reopen_costs)").all() as { name: string }[]
const hasReopenCol = (name: string) => reopenCols.some(c => c.name === name)
if (!hasReopenCol('mode')) db.exec('ALTER TABLE ticket_reopen_costs ADD COLUMN mode INTEGER NOT NULL DEFAULT 1')
if (!hasReopenCol('percent')) db.exec('ALTER TABLE ticket_reopen_costs ADD COLUMN percent REAL NOT NULL DEFAULT 0')
if (!hasReopenCol('closed')) db.exec('ALTER TABLE ticket_reopen_costs ADD COLUMN closed INTEGER NOT NULL DEFAULT 0')
if (!hasReopenCol('reopen_group')) {
  db.exec('ALTER TABLE ticket_reopen_costs ADD COLUMN reopen_group INTEGER')
  // Backfill : on regroupe les lignes existantes par ticket (cas usuel = 1 réouverture par ticket),
  // dans l'ordre d'apparition, pour leur attribuer un numéro de réouverture stable.
  const legacy = db.prepare('SELECT ticket_id, MIN(id) as mid FROM ticket_reopen_costs GROUP BY ticket_id ORDER BY mid').all() as { ticket_id: number }[]
  const updGroup = db.prepare('UPDATE ticket_reopen_costs SET reopen_group = ? WHERE ticket_id = ? AND reopen_group IS NULL')
  let g = 0
  db.transaction(() => { for (const t of legacy) { g++; updGroup.run(g, t.ticket_id) } })()
}

// Base de calcul du % de réouverture selon le mode (1=dernier, 2=premier, 3=moyenne, 4=somme)
type AmountRow = { batch: number; amount: number }
const computeBaseAmount = (sorted: AmountRow[], mode: number): number => {
  switch (mode) {
    case 2: return sorted[0].amount                                           // premier
    case 3: return sorted.reduce((s, r) => s + r.amount, 0) / sorted.length   // moyenne
    case 4: return sorted.reduce((s, r) => s + r.amount, 0)                   // somme
    case 1:
    default: return sorted[sorted.length - 1].amount                          // dernier
  }
}

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
  // mode = base de calcul du % : 1=dernier Supercost, 2=premier, 3=moyenne, 4=somme
  const { ticketId, percent, mode = 1 } = req.body as { ticketId: number; percent: number; mode?: number }

  type ScRow = { batch: number; itemtype: string; items_id: number; amount: number }
  const rows = db.prepare('SELECT batch, itemtype, items_id, amount FROM ticket_supercosts WHERE ticket_id = ?').all(ticketId) as ScRow[]
  if (rows.length === 0) { res.status(200).end(); return }

  // Regrouper par item (itemtype + items_id) car les Supercost sont stockés répartis par item
  const groups = new Map<string, ScRow[]>()
  for (const r of rows) {
    const key = `${r.itemtype}|${r.items_id}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }

  // Numéro de réouverture : toutes les lignes d'un même appel partagent le même reopen_group.
  const maxGroupRow = db.prepare('SELECT MAX(reopen_group) as m FROM ticket_reopen_costs').get() as { m: number | null }
  const nextGroup = (maxGroupRow.m ?? 0) + 1

  const ins = db.prepare('INSERT INTO ticket_reopen_costs (ticket_id, batch, itemtype, items_id, amount, mode, percent, closed, reopen_group) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)')
  db.transaction(() => {
    for (const list of groups.values()) {
      const sorted = [...list].sort((a, b) => a.batch - b.batch)
      const lastBatch = sorted[sorted.length - 1].batch
      ins.run(ticketId, lastBatch, sorted[0].itemtype, sorted[0].items_id, computeBaseAmount(sorted, mode) * (percent / 100), mode, percent, nextGroup)
    }
  })()
  res.status(200).end()
})

// ─────────────────────────────────────────────────────────────
// /api/item-supercosts/reopens — liste / édition / fermeture des réouvertures
// ─────────────────────────────────────────────────────────────

type ReopenRow = { id: number; ticket_id: number; batch: number; itemtype: string; items_id: number; amount: number; mode: number; percent: number; closed: number; reopen_group: number | null }

// Liste toutes les réouvertures, regroupées par reopen_group, dans l'ordre de création.
app.get('/api/item-supercosts/reopens', (_req, res) => {
  const rows = db.prepare('SELECT id, ticket_id, batch, itemtype, items_id, amount, mode, percent, closed, reopen_group FROM ticket_reopen_costs ORDER BY reopen_group, id').all() as ReopenRow[]
  const groups = new Map<number, {
    reopenGroup: number; ticketId: number; percent: number; mode: number; closed: boolean; total: number
    items: { itemtype: string; items_id: number; amount: number }[]
  }>()
  for (const r of rows) {
    const g = r.reopen_group ?? r.id
    if (!groups.has(g)) {
      groups.set(g, { reopenGroup: g, ticketId: r.ticket_id, percent: r.percent, mode: r.mode, closed: r.closed === 1, total: 0, items: [] })
    }
    const entry = groups.get(g)!
    entry.total += r.amount
    entry.items.push({ itemtype: r.itemtype, items_id: r.items_id, amount: r.amount })
  }
  res.json([...groups.values()])
})

// Modifie une réouverture : seuls le pourcentage et le mode changent, puis on recalcule les montants.
app.put('/api/item-supercosts/reopens/:group', (req, res) => {
  const group = Number(req.params.group)
  const { percent, mode } = req.body as { percent: number; mode: number }
  const rows = db.prepare('SELECT id, ticket_id, itemtype, items_id, closed FROM ticket_reopen_costs WHERE reopen_group = ?').all(group) as Pick<ReopenRow, 'id' | 'ticket_id' | 'itemtype' | 'items_id' | 'closed'>[]
  if (rows.length === 0) { res.status(404).json({ error: 'Réouverture introuvable' }); return }
  if (rows[0].closed === 1) { res.status(409).json({ error: 'Réouverture fermée : modification impossible' }); return }

  const upd = db.prepare('UPDATE ticket_reopen_costs SET amount = ?, mode = ?, percent = ? WHERE id = ?')
  db.transaction(() => {
    for (const r of rows) {
      const scRows = db.prepare('SELECT batch, amount FROM ticket_supercosts WHERE ticket_id = ? AND itemtype = ? AND items_id = ?').all(r.ticket_id, r.itemtype, r.items_id) as AmountRow[]
      const sorted = [...scRows].sort((a, b) => a.batch - b.batch)
      const base = sorted.length > 0 ? computeBaseAmount(sorted, mode) : 0
      upd.run(base * (percent / 100), mode, percent, r.id)
    }
  })()
  res.status(200).end()
})

// Supprime une réouverture = la ferme (close), comme si elle avait été mal créée :
// montant remis à 0 mais la ligne reste à sa place dans la liste.
app.delete('/api/item-supercosts/reopens/:group', (req, res) => {
  const group = Number(req.params.group)
  const result = db.prepare('UPDATE ticket_reopen_costs SET closed = 1, amount = 0 WHERE reopen_group = ?').run(group)
  if (result.changes === 0) { res.status(404).json({ error: 'Réouverture introuvable' }); return }
  res.status(200).end()
})

// ─────────────────────────────────────────────────────────────
// /api/item-supercosts/supercosts — liste / édition des Super Cost
// (un Super Cost = un batch pour un ticket, son montant est réparti entre ses items)
// ─────────────────────────────────────────────────────────────

type SuperRow = { id: number; ticket_id: number; batch: number; itemtype: string; items_id: number; amount: number }

app.get('/api/item-supercosts/supercosts', (_req, res) => {
  const rows = db.prepare('SELECT id, ticket_id, batch, itemtype, items_id, amount FROM ticket_supercosts ORDER BY ticket_id, batch, id').all() as SuperRow[]
  const groups = new Map<string, { ticketId: number; batch: number; total: number; items: { itemtype: string; items_id: number; amount: number }[] }>()
  for (const r of rows) {
    const key = `${r.ticket_id}|${r.batch}`
    if (!groups.has(key)) groups.set(key, { ticketId: r.ticket_id, batch: r.batch, total: 0, items: [] })
    const entry = groups.get(key)!
    entry.total += r.amount
    entry.items.push({ itemtype: r.itemtype, items_id: r.items_id, amount: r.amount })
  }
  res.json([...groups.values()])
})

// Modifie le montant d'un Super Cost : le nouveau montant est réparti à parts égales entre ses items
// (même logique que la création). On recalcule ensuite les réouvertures non fermées du même ticket,
// à partir des Super Cost mis à jour (même calcul que PUT /reopens/:group), en gardant leur mode et percent.
app.put('/api/item-supercosts/supercosts/:ticketId/:batch', (req, res) => {
  const ticketId = Number(req.params.ticketId)
  const batch = Number(req.params.batch)
  const { amount } = req.body as { amount: number }
  const rows = db.prepare('SELECT id FROM ticket_supercosts WHERE ticket_id = ? AND batch = ?').all(ticketId, batch) as { id: number }[]
  if (rows.length === 0) { res.status(404).json({ error: 'Super Cost introuvable' }); return }
  const share = amount / rows.length
  const upd = db.prepare('UPDATE ticket_supercosts SET amount = ? WHERE id = ?')
  const reopenRows = db.prepare('SELECT id, itemtype, items_id, mode, percent FROM ticket_reopen_costs WHERE ticket_id = ? AND closed = 0').all(ticketId) as Pick<ReopenRow, 'id' | 'itemtype' | 'items_id' | 'mode' | 'percent'>[]
  const updReopen = db.prepare('UPDATE ticket_reopen_costs SET amount = ? WHERE id = ?')
  db.transaction(() => {
    for (const r of rows) upd.run(share, r.id)
    for (const r of reopenRows) {
      const scRows = db.prepare('SELECT batch, amount FROM ticket_supercosts WHERE ticket_id = ? AND itemtype = ? AND items_id = ?').all(ticketId, r.itemtype, r.items_id) as AmountRow[]
      const sorted = [...scRows].sort((a, b) => a.batch - b.batch)
      const base = sorted.length > 0 ? computeBaseAmount(sorted, r.mode) : 0
      updReopen.run(base * (r.percent / 100), r.id)
    }
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
  type RcRow = ScRow & { mode: number }
  const supercosts = db.prepare('SELECT ticket_id, batch, items_id, amount FROM ticket_supercosts WHERE itemtype = ?').all(itemtype) as ScRow[]
  const reopencosts = db.prepare('SELECT ticket_id, batch, items_id, amount, mode FROM ticket_reopen_costs WHERE itemtype = ?').all(itemtype) as RcRow[]
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