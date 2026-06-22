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
  CREATE TABLE IF NOT EXISTS ticket_reopen_ceilings (
    ticket_id INTEGER PRIMARY KEY,
    percent REAL NOT NULL
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

// Migration : colonnes ajoutées au fil du temps
const superCols = db.prepare("PRAGMA table_info(ticket_supercosts)").all() as { name: string }[]
if (!superCols.some(c => c.name === 'cancelled'))
  db.exec('ALTER TABLE ticket_supercosts ADD COLUMN cancelled INTEGER NOT NULL DEFAULT 0')

const reopenCols = db.prepare("PRAGMA table_info(ticket_reopen_costs)").all() as { name: string }[]
const hasReopenCol = (name: string) => reopenCols.some(c => c.name === name)
if (!hasReopenCol('mode')) db.exec('ALTER TABLE ticket_reopen_costs ADD COLUMN mode INTEGER NOT NULL DEFAULT 1')
if (!hasReopenCol('percent')) db.exec('ALTER TABLE ticket_reopen_costs ADD COLUMN percent REAL NOT NULL DEFAULT 0')
if (!hasReopenCol('closed')) db.exec('ALTER TABLE ticket_reopen_costs ADD COLUMN closed INTEGER NOT NULL DEFAULT 0')
if (!hasReopenCol('reopen_group')) {
  db.exec('ALTER TABLE ticket_reopen_costs ADD COLUMN reopen_group INTEGER')
  const legacy = db.prepare('SELECT ticket_id, MIN(id) as mid FROM ticket_reopen_costs GROUP BY ticket_id ORDER BY mid').all() as { ticket_id: number }[]
  const updGroup = db.prepare('UPDATE ticket_reopen_costs SET reopen_group = ? WHERE ticket_id = ? AND reopen_group IS NULL')
  let g = 0
  db.transaction(() => { for (const t of legacy) { g++; updGroup.run(g, t.ticket_id) } })()
}

// ─── Calcul de la base selon le mode, en filtrant par batch < maxBatch ───
type AmountRow = { batch: number; amount: number }
const computeBaseAmount = (sorted: AmountRow[], mode: number, maxBatch: number): number => {
  const filtered = sorted.filter(s => s.batch < maxBatch)
  if (filtered.length === 0) return 0
  switch (mode) {
    case 2: return filtered[0].amount                           // premier
    case 3: return filtered.reduce((s, r) => s + r.amount, 0) / filtered.length // moyenne
    case 4: return filtered.reduce((s, r) => s + r.amount, 0)   // somme
    case 1:
    default: return filtered[filtered.length - 1].amount        // dernier
  }
}

// Initialisation des paramètres par défaut
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

// ─── Construction de l'index des SuperCosts par (ticket,itemtype,items_id) ───
type ScIndexRow = { ticket_id: number; itemtype: string; items_id: number; batch: number; amount: number }
const buildScIndex = (): Map<string, AmountRow[]> => {
  const rows = db.prepare('SELECT ticket_id, itemtype, items_id, batch, amount FROM ticket_supercosts WHERE cancelled = 0').all() as ScIndexRow[]
  const index = new Map<string, AmountRow[]>()
  for (const sc of rows) {
    const key = `${sc.ticket_id}|${sc.itemtype}|${sc.items_id}`
    if (!index.has(key)) index.set(key, [])
    index.get(key)!.push({ batch: sc.batch, amount: sc.amount })
  }
  return index
}

// ─── Plafond de réouverture (Aléa 2) ───
// Plafond défini PAR TICKET (un seul par ticket, table ticket_reopen_ceilings).
//   plafondMax(ticket) = (somme des Super Cost actifs du ticket) × (pourcentage du ticket).
const getCeilingPercent = (ticketId: number): number => {
  const row = db.prepare('SELECT percent FROM ticket_reopen_ceilings WHERE ticket_id = ?').get(ticketId) as { percent: number } | undefined
  return row && !isNaN(row.percent) ? row.percent : 0
}

// Base du plafond d'un ticket = somme de SES Super Cost actifs. Le mode "négligeable"
// n'existe pas dans le modèle actuel, il n'y a donc aucune ligne à exclure ici.
const sumActiveSuperCost = (ticketId: number): number =>
  (db.prepare('SELECT COALESCE(SUM(amount), 0) as s FROM ticket_supercosts WHERE cancelled = 0 AND ticket_id = ?').get(ticketId) as { s: number }).s

// Total dynamique des frais de réouverture non fermés d'un ticket (même calcul que GET /reopens).
const sumReopenCosts = (ticketId: number): number => {
  const scIndex = buildScIndex()
  const rows = db.prepare('SELECT ticket_id, itemtype, items_id, batch, mode, percent FROM ticket_reopen_costs WHERE closed = 0 AND ticket_id = ?').all(ticketId) as
    { ticket_id: number; itemtype: string; items_id: number; batch: number; mode: number; percent: number }[]
  let total = 0
  for (const r of rows) {
    const sorted = [...(scIndex.get(`${r.ticket_id}|${r.itemtype}|${r.items_id}`) ?? [])].sort((a, b) => a.batch - b.batch)
    total += computeBaseAmount(sorted, r.mode, r.batch) * (r.percent / 100)
  }
  return total
}

// ─────────────────────────────────────────────────────────────
// /api/item-supercosts  (résumé par type)
// ─────────────────────────────────────────────────────────────
app.get('/api/item-supercosts', (_req, res) => {
  // SuperCosts totaux par type
  type SuperRow = { itemtype: string; total: number }
  const superRows = db.prepare('SELECT itemtype, SUM(amount) as total FROM ticket_supercosts WHERE cancelled = 0 GROUP BY itemtype').all() as SuperRow[]

  // Frais de réouverture : calculés dynamiquement en filtrant par batch < batch_reopen
  const scIndex = buildScIndex()
  type RcRow = { ticket_id: number; itemtype: string; items_id: number; batch: number; mode: number; percent: number }
  const rcRows = db.prepare('SELECT ticket_id, itemtype, items_id, batch, mode, percent FROM ticket_reopen_costs WHERE closed = 0').all() as RcRow[]
  const reopenMap = new Map<string, number>()
  for (const r of rcRows) {
    const sorted = [...(scIndex.get(`${r.ticket_id}|${r.itemtype}|${r.items_id}`) ?? [])].sort((a, b) => a.batch - b.batch)
    const base = computeBaseAmount(sorted, r.mode, r.batch) // ✅ filtration par batch < r.batch
    const amount = base * (r.percent / 100)
    reopenMap.set(r.itemtype, (reopenMap.get(r.itemtype) ?? 0) + amount)
  }

  const superMap = new Map(superRows.map(r => [r.itemtype, r.total]))
  const allTypes = new Set([...superMap.keys(), ...reopenMap.keys()])

  res.json(
    [...allTypes]
      .map(t => ({ itemtype: t, superCost: superMap.get(t) ?? 0, reopenCost: reopenMap.get(t) ?? 0 }))
      .sort((a, b) => a.itemtype.localeCompare(b.itemtype))
  )
})

// ─── Création d'un SuperCost ───
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

// ─── Création d'une réouverture ───
app.post('/api/item-supercosts/reopen', (req, res) => {
  const { ticketId, percent, mode = 1 } = req.body as { ticketId: number; percent: number; mode?: number }

  // Récupérer les SuperCosts existants pour ce ticket
  type ScRow = { batch: number; itemtype: string; items_id: number; amount: number }
  const scRows = db.prepare('SELECT batch, itemtype, items_id, amount FROM ticket_supercosts WHERE ticket_id = ? AND cancelled = 0').all(ticketId) as ScRow[]
  if (scRows.length === 0) { res.status(200).end(); return }

  // Regrouper par item
  const groups = new Map<string, ScRow[]>()
  for (const r of scRows) {
    const key = `${r.itemtype}|${r.items_id}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }

  // Attribuer un nouveau batch (max des deux tables + 1)
  const maxBatchAll = db.prepare(`
    SELECT MAX(batch) as m FROM (
      SELECT batch FROM ticket_supercosts
      UNION
      SELECT batch FROM ticket_reopen_costs
    )
  `).get() as { m: number | null }
  const nextBatch = (maxBatchAll.m ?? 0) + 1

  // Numéro de groupe de réouverture
  const maxGroupRow = db.prepare('SELECT MAX(reopen_group) as m FROM ticket_reopen_costs').get() as { m: number | null }
  const nextGroup = (maxGroupRow.m ?? 0) + 1


  let effectivePercent = percent
  const ceilingPercent = getCeilingPercent(ticketId)
  if (ceilingPercent > 0) {
    const ceilingMax = sumActiveSuperCost(ticketId) * (ceilingPercent / 100)
    const allowed = Math.max(0, ceilingMax - sumReopenCosts(ticketId)) // disponible du ticket avant cette opération
    let intended = 0
    for (const list of groups.values()) {
      const sorted = [...list].sort((a, b) => a.batch - b.batch)
      intended += computeBaseAmount(sorted, mode, nextBatch) * (percent / 100)
    }
    if (intended > allowed) effectivePercent = intended > 0 ? percent * (allowed / intended) : 0
  }

  const ins = db.prepare(`
    INSERT INTO ticket_reopen_costs
      (ticket_id, batch, itemtype, items_id, amount, mode, percent, closed, reopen_group)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
  `)

  db.transaction(() => {
    for (const list of groups.values()) {
      const sorted = [...list].sort((a, b) => a.batch - b.batch)
      // ✅ On calcule la base avec le nouveau batch comme seuil
      const base = computeBaseAmount(sorted, mode, nextBatch)
      const amount = base * (effectivePercent / 100)
      ins.run(ticketId, nextBatch, sorted[0].itemtype, sorted[0].items_id, amount, mode, effectivePercent, nextGroup)
    }
  })()

  res.status(200).end()
})

// ─── Liste des réouvertures (groupées) ───
type ReopenRow = {
  id: number; ticket_id: number; batch: number; itemtype: string; items_id: number
  amount: number; mode: number; percent: number; closed: number; reopen_group: number | null
}

app.get('/api/item-supercosts/reopens', (_req, res) => {
  const scIndex = buildScIndex()
  const rows = db.prepare(`
    SELECT id, ticket_id, batch, itemtype, items_id, amount, mode, percent, closed, reopen_group
    FROM ticket_reopen_costs
    ORDER BY reopen_group, id
  `).all() as ReopenRow[]

  const groups = new Map<number, {
    reopenGroup: number; ticketId: number; percent: number; mode: number; closed: boolean; total: number
    items: { itemtype: string; items_id: number; amount: number }[]
  }>()

  for (const r of rows) {
    const g = r.reopen_group ?? r.id
    let calculatedAmount = 0
    if (!r.closed) {
      const sorted = [...(scIndex.get(`${r.ticket_id}|${r.itemtype}|${r.items_id}`) ?? [])].sort((a, b) => a.batch - b.batch)
      // ✅ filtration par batch < r.batch
      const base = computeBaseAmount(sorted, r.mode, r.batch)
      calculatedAmount = base * (r.percent / 100)
    }

    if (!groups.has(g)) {
      groups.set(g, {
        reopenGroup: g,
        ticketId: r.ticket_id,
        percent: r.percent,
        mode: r.mode,
        closed: r.closed === 1,
        total: 0,
        items: []
      })
    }
    const entry = groups.get(g)!
    entry.total += calculatedAmount
    entry.items.push({ itemtype: r.itemtype, items_id: r.items_id, amount: calculatedAmount })
  }

  res.json([...groups.values()])
})

// ─── Modification d'une réouverture (mode et pourcentage) ───
app.put('/api/item-supercosts/reopens/:group', (req, res) => {
  const group = Number(req.params.group)
  const { percent, mode } = req.body as { percent: number; mode: number }

  // Récupérer les lignes de cette réouverture avec leur batch
  const rows = db.prepare(`
    SELECT id, ticket_id, itemtype, items_id, batch, closed
    FROM ticket_reopen_costs
    WHERE reopen_group = ?
  `).all(group) as Pick<ReopenRow, 'id' | 'ticket_id' | 'itemtype' | 'items_id' | 'batch' | 'closed'>[]

  if (rows.length === 0) { res.status(404).json({ error: 'Réouverture introuvable' }); return }
  if (rows[0].closed === 1) { res.status(409).json({ error: 'Réouverture fermée' }); return }

  const upd = db.prepare('UPDATE ticket_reopen_costs SET amount = ?, mode = ?, percent = ? WHERE id = ?')
  db.transaction(() => {
    for (const r of rows) {
      const scRows = db.prepare(`
        SELECT batch, amount FROM ticket_supercosts
        WHERE ticket_id = ? AND itemtype = ? AND items_id = ? AND cancelled = 0
      `).all(r.ticket_id, r.itemtype, r.items_id) as AmountRow[]
      const sorted = [...scRows].sort((a, b) => a.batch - b.batch)
      // ✅ filtration par batch < r.batch
      const base = computeBaseAmount(sorted, mode, r.batch)
      upd.run(base * (percent / 100), mode, percent, r.id)
    }
  })()

  res.status(200).end()
})

// ─── Fermeture (suppression) d'une réouverture ───
app.delete('/api/item-supercosts/reopens/:group', (req, res) => {
  const group = Number(req.params.group)
  const result = db.prepare('UPDATE ticket_reopen_costs SET closed = 1, amount = 0 WHERE reopen_group = ?').run(group)
  if (result.changes === 0) { res.status(404).json({ error: 'Réouverture introuvable' }); return }
  res.status(200).end()
})

// ─── Liste des SuperCosts (par batch) ───
type SuperRow = { id: number; ticket_id: number; batch: number; itemtype: string; items_id: number; amount: number }

app.get('/api/item-supercosts/supercosts', (_req, res) => {
  const rows = db.prepare('SELECT id, ticket_id, batch, itemtype, items_id, amount FROM ticket_supercosts WHERE cancelled = 0 ORDER BY ticket_id, batch, id').all() as SuperRow[]
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

// ─── Liste des SuperCosts annulés (cancelled = 1) ───
app.get('/api/item-supercosts/supercosts/cancelled', (_req, res) => {
  const rows = db.prepare('SELECT id, ticket_id, batch, itemtype, items_id, amount FROM ticket_supercosts WHERE cancelled = 1 ORDER BY ticket_id, batch, id').all() as SuperRow[]
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

// ─── Rétablissement d'un SuperCost annulé (regagne sa place via son batch) ───
app.post('/api/item-supercosts/supercosts/:ticketId/:batch/restore', (req, res) => {
  const ticketId = Number(req.params.ticketId)
  const batch = Number(req.params.batch)
  const result = db.prepare('UPDATE ticket_supercosts SET cancelled = 0 WHERE ticket_id = ? AND batch = ? AND cancelled = 1').run(ticketId, batch)
  if (result.changes === 0) { res.status(404).json({ error: 'Super Cost annulé introuvable' }); return }
  res.json({ restored: result.changes })
})

// ─── Plafonds de réouverture par ticket (Aléa 2) ───
app.get('/api/item-supercosts/ceilings', (_req, res) => {
  res.json(db.prepare('SELECT ticket_id as ticketId, percent FROM ticket_reopen_ceilings ORDER BY ticket_id').all())
})

// Définir / mettre à jour / supprimer le plafond d'un ticket (un seul par ticket).
app.put('/api/item-supercosts/ceilings/:ticketId', (req, res) => {
  const ticketId = Number(req.params.ticketId)
  const { percent } = req.body as { percent: number | null }
  if (percent === null || percent === undefined || isNaN(Number(percent))) {
    db.prepare('DELETE FROM ticket_reopen_ceilings WHERE ticket_id = ?').run(ticketId)
    res.json({ ticketId, percent: null }); return
  }
  db.prepare('INSERT INTO ticket_reopen_ceilings (ticket_id, percent) VALUES (?, ?) ON CONFLICT(ticket_id) DO UPDATE SET percent = excluded.percent').run(ticketId, Number(percent))
  res.json({ ticketId, percent: Number(percent) })
})

// ─── Modification d'un SuperCost (recalcule automatiquement les réouvertures) ───
app.put('/api/item-supercosts/supercosts/:ticketId/:batch', (req, res) => {
  const ticketId = Number(req.params.ticketId)
  const batch = Number(req.params.batch)
  const { amount } = req.body as { amount: number }

  const rows = db.prepare('SELECT id FROM ticket_supercosts WHERE ticket_id = ? AND batch = ?').all(ticketId, batch) as { id: number }[]
  if (rows.length === 0) { res.status(404).json({ error: 'Super Cost introuvable' }); return }

  const share = amount / rows.length
  const upd = db.prepare('UPDATE ticket_supercosts SET amount = ? WHERE id = ?')

  // Récupérer les réouvertures non fermées de ce ticket (avec leur batch)
  const reopenRows = db.prepare(`
    SELECT id, itemtype, items_id, mode, percent, batch
    FROM ticket_reopen_costs
    WHERE ticket_id = ? AND closed = 0
  `).all(ticketId) as Pick<ReopenRow, 'id' | 'itemtype' | 'items_id' | 'mode' | 'percent' | 'batch'>[]

  const updReopen = db.prepare('UPDATE ticket_reopen_costs SET amount = ? WHERE id = ?')

  db.transaction(() => {
    // Mettre à jour le SuperCost
    for (const r of rows) upd.run(share, r.id)

    // Recalculer chaque réouverture
    for (const r of reopenRows) {
      const scRows = db.prepare(`
        SELECT batch, amount FROM ticket_supercosts
        WHERE ticket_id = ? AND itemtype = ? AND items_id = ? AND cancelled = 0
      `).all(ticketId, r.itemtype, r.items_id) as AmountRow[]
      const sorted = [...scRows].sort((a, b) => a.batch - b.batch)
      // ✅ filtration par batch < r.batch
      const base = computeBaseAmount(sorted, r.mode, r.batch)
      updReopen.run(base * (r.percent / 100), r.id)
    }
  })()

  res.status(200).end()
})

// ─── Annulation du dernier SuperCost (cancel) ───
app.post('/api/item-supercosts/cancel', (req, res) => {
  const { ticketId } = req.body as { ticketId: number }
  // Soft-delete : on conserve la ligne (et son batch = sa place) pour pouvoir la rétablir.
  const maxBatchRow = db.prepare('SELECT MAX(batch) as m FROM ticket_supercosts WHERE ticket_id = ? AND cancelled = 0').get(ticketId) as { m: number | null }
  if (maxBatchRow.m === null) { res.json({ removed: 0 }); return }
  const result = db.prepare('UPDATE ticket_supercosts SET cancelled = 1 WHERE ticket_id = ? AND batch = ?').run(ticketId, maxBatchRow.m)
  res.json({ removed: result.changes })
})

// ─── Montant total du dernier batch SuperCost ───
app.get('/api/item-supercosts/:ticketId/last-batch-total', (req, res) => {
  const ticketId = Number(req.params.ticketId)
  const maxBatchRow = db.prepare('SELECT MAX(batch) as m FROM ticket_supercosts WHERE ticket_id = ? AND cancelled = 0').get(ticketId) as { m: number | null }
  if (maxBatchRow.m === null) { res.json(0); return }
  const totalRow = db.prepare('SELECT SUM(amount) as total FROM ticket_supercosts WHERE ticket_id = ? AND batch = ? AND cancelled = 0').get(ticketId, maxBatchRow.m) as { total: number | null }
  res.json(totalRow.total ?? 0)
})

// ─── Détails par itemtype ───
app.get('/api/item-supercosts/details/:itemtype', (req, res) => {
  const { itemtype } = req.params
  type ScRow = { ticket_id: number; batch: number; items_id: number; amount: number }
  type RcRow = ScRow & { mode: number }
  const supercosts = db.prepare('SELECT ticket_id, batch, items_id, amount FROM ticket_supercosts WHERE itemtype = ?').all(itemtype) as ScRow[]
  const reopencosts = db.prepare('SELECT ticket_id, batch, items_id, amount, mode FROM ticket_reopen_costs WHERE itemtype = ?').all(itemtype) as RcRow[]
  res.json({ supercosts, reopencosts })
})

// ─── Reset complet ───
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