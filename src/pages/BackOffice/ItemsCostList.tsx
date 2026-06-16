import { useState, useEffect } from 'react'
import { glpiTicketService } from '@/services/glpiService'
import { ItemSuperCostApi } from '@/api/itemSuperCost'
import type { GlpiTicket } from '@/types/glpi'
import './ItemsCostList.css'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ItemTypeRow {
  itemtype: string
  tickets: { ticketId: number; ticketName: string; items_id: number }[]
  coutFixed: number
  coutHoraire: number
  nouveauPrix: number
  fraisReouverture: number
  total: number
}

interface TicketItemCost {
  itemtype: string
  items_id: number
  glpi: number
}

interface Level2Item {
  ticketId: number
  ticketName: string
  items_id: number
  glpi: number
  supercost: number
  reopenCost: number
}

interface BatchEntry { batch: number; amount: number }

interface Movement {
  id: number
  ticket_id: number
  mvt: string
  valeur: string | null
  statut: string
  message: string | null
  created_at: string
}

interface Level3State {
  ticketId: number
  ticketName: string
  items_id: number
  glpi: number
  supercostBatches: BatchEntry[]
  reopenBatches: BatchEntry[]
  movements: Movement[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })

const MVT_COLORS: Record<string, { bg: string; color: string }> = {
  close:  { bg: '#dbeafe', color: '#1e40af' },
  open:   { bg: '#fef9c3', color: '#854d0e' },
  cancel: { bg: '#fce7f3', color: '#9d174d' },
}

// ── Component ──────────────────────────────────────────────────────────────────

export const ItemsCostList = () => {
  const [rows, setRows] = useState<ItemTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ticketItemsMap, setTicketItemsMap] = useState<Map<number, TicketItemCost[]>>(new Map())

  // Level 2 – item type selected
  const [selectedItemtype, setSelectedItemtype] = useState<string | null>(null)
  const [level2Items, setLevel2Items] = useState<Level2Item[]>([])
  const [level2Loading, setLevel2Loading] = useState(false)

  // Level 3 – specific item selected
  const [level3, setLevel3] = useState<Level3State | null>(null)
  const [level3Loading, setLevel3Loading] = useState(false)

  // ── Load ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [bulk, summaries] = await Promise.all([
          glpiTicketService.listItemsCosts(),
          ItemSuperCostApi.getItemCostSummaries(),
        ])

        const { tickets, costs, items } = bulk

        const costByTicket = new Map<number, { cost_fixed: number; cost_time: number }>()
        for (const c of costs) {
          const existing = costByTicket.get(c.tickets_id) ?? { cost_fixed: 0, cost_time: 0 }
          existing.cost_fixed += c.cost_fixed
          existing.cost_time += c.cost_time * (c.actiontime / 3600)
          costByTicket.set(c.tickets_id, existing)
        }

        const itemsByTicket = new Map<number, typeof items>()
        for (const item of items) {
          if (!itemsByTicket.has(item.tickets_id)) itemsByTicket.set(item.tickets_id, [])
          itemsByTicket.get(item.tickets_id)!.push(item)
        }

        const ticketById = new Map<number, GlpiTicket>()
        for (const t of tickets) ticketById.set(t.id, t)

        const byItemtype = new Map<string, ItemTypeRow>()
        for (const [ticketId, ticketItems] of itemsByTicket.entries()) {
          const ticket = ticketById.get(ticketId)
          const glpiCost = costByTicket.get(ticketId) ?? { cost_fixed: 0, cost_time: 0 }
          const nb = ticketItems.length

          for (const item of ticketItems) {
            if (!byItemtype.has(item.itemtype)) {
              byItemtype.set(item.itemtype, {
                itemtype: item.itemtype, tickets: [],
                coutFixed: 0, coutHoraire: 0, nouveauPrix: 0, fraisReouverture: 0, total: 0,
              })
            }
            const row = byItemtype.get(item.itemtype)!
            row.tickets.push({ ticketId, ticketName: ticket?.name || `Ticket #${ticketId}`, items_id: item.items_id })
            row.coutFixed   += nb > 0 ? glpiCost.cost_fixed / nb : 0
            row.coutHoraire += nb > 0 ? glpiCost.cost_time  / nb : 0
          }
        }

        for (const s of summaries) {
          if (!byItemtype.has(s.itemtype)) {
            byItemtype.set(s.itemtype, {
              itemtype: s.itemtype, tickets: [],
              coutFixed: 0, coutHoraire: 0, nouveauPrix: 0, fraisReouverture: 0, total: 0,
            })
          }
          const row = byItemtype.get(s.itemtype)!
          row.nouveauPrix     = s.superCost
          row.fraisReouverture = s.reopenCost
        }

        for (const row of byItemtype.values()) {
          row.total = row.coutFixed + row.coutHoraire + row.nouveauPrix + row.fraisReouverture
        }

        // GLPI cost per (ticketId, itemtype, items_id)
        const tMap = new Map<number, TicketItemCost[]>()
        for (const [ticketId, ticketItems] of itemsByTicket.entries()) {
          const glpiCost = costByTicket.get(ticketId) ?? { cost_fixed: 0, cost_time: 0 }
          const nb = ticketItems.length
          tMap.set(ticketId, ticketItems.map(item => ({
            itemtype: item.itemtype,
            items_id: item.items_id,
            glpi: nb > 0 ? (glpiCost.cost_fixed + glpiCost.cost_time) / nb : 0,
          })))
        }
        setTicketItemsMap(tMap)
        setRows(Array.from(byItemtype.values()).sort((a, b) => a.itemtype.localeCompare(b.itemtype)))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handleItemtypeClick = async (itemtype: string) => {
    setSelectedItemtype(itemtype)
    setLevel3(null)
    setLevel2Loading(true)
    setLevel2Items([])
    try {
      const res = await fetch(`/api/item-supercosts/by-type/${encodeURIComponent(itemtype)}`)
      const { supercosts, reopenCosts } = await res.json() as {
        supercosts: { ticket_id: number; items_id: number; total: number }[]
        reopenCosts: { ticket_id: number; items_id: number; total: number }[]
      }
      const scMap = new Map(supercosts.map(s => [`${s.ticket_id}::${s.items_id}`, s.total]))
      const rcMap = new Map(reopenCosts.map(r => [`${r.ticket_id}::${r.items_id}`, r.total]))

      const typeRow = rows.find(r => r.itemtype === itemtype)
      if (typeRow) {
        setLevel2Items(typeRow.tickets.map(t => {
          const glpiItem = (ticketItemsMap.get(t.ticketId) ?? [])
            .find(g => g.itemtype === itemtype && g.items_id === t.items_id)
          return {
            ticketId:   t.ticketId,
            ticketName: t.ticketName,
            items_id:   t.items_id,
            glpi:       glpiItem?.glpi ?? 0,
            supercost:  scMap.get(`${t.ticketId}::${t.items_id}`) ?? 0,
            reopenCost: rcMap.get(`${t.ticketId}::${t.items_id}`) ?? 0,
          }
        }))
      }
    } catch { /* ignore */ }
    setLevel2Loading(false)
  }

  const handleItemClick = async (item: Level2Item) => {
    setLevel3Loading(true)
    setLevel3(null)
    try {
      const [batchRes, mvtRes] = await Promise.all([
        fetch(`/api/item-supercosts/${item.ticketId}/item-batches/${item.items_id}`),
        fetch(`/api/ticket-movements/${item.ticketId}`),
      ])
      const { supercostBatches, reopenBatches } = await batchRes.json() as { supercostBatches: BatchEntry[]; reopenBatches: BatchEntry[] }
      const movements = await mvtRes.json() as Movement[]
      setLevel3({ ticketId: item.ticketId, ticketName: item.ticketName, items_id: item.items_id, glpi: item.glpi, supercostBatches, reopenBatches, movements })
    } catch { /* ignore */ }
    setLevel3Loading(false)
  }

  const closePanel = () => { setSelectedItemtype(null); setLevel3(null); setLevel2Items([]) }

  // ── Render ─────────────────────────────────────────────────────────────────────

  if (loading) return <div className="items-cost-loading">Chargement...</div>
  if (error)   return <div className="items-cost-error">Erreur : {error}</div>

  const grandTotal = rows.reduce((s, r) => s + r.total, 0)

  return (
    <div className="items-cost-page" style={{ position: 'relative' }}>
      <div className="items-cost-header">
        <h2>Coûts par type d'item</h2>
        {rows.length > 0 && (
          <p>Total général : <strong>{fmt(grandTotal)}</strong> — {rows.length} type(s) · cliquez un type pour voir le détail</p>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="items-cost-empty">Aucun item avec coût trouvé.</p>
      ) : (
        <div className="items-cost-table-container">
          <table className="items-cost-table">
            <thead>
              <tr>
                <th>Type item</th>
                <th style={{ textAlign: 'right' }}>GLPI</th>
                <th style={{ textAlign: 'right' }}>Réouverture</th>
                <th style={{ textAlign: 'right' }}>Supercost</th>
                <th style={{ textAlign: 'right' }}>Total général</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  onClick={() => handleItemtypeClick(row.itemtype)}
                  style={{
                    cursor: 'pointer',
                    background: selectedItemtype === row.itemtype ? '#eef2ff' : undefined,
                    outline: selectedItemtype === row.itemtype ? '2px solid #6366f1' : undefined,
                    outlineOffset: '-2px',
                  }}
                >
                  <td className="items-cost-itemtype">
                    {row.itemtype}
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>
                      ({row.tickets.length} item{row.tickets.length > 1 ? 's' : ''})
                    </span>
                    <i className="bi bi-chevron-right" style={{ marginLeft: 6, fontSize: 10, color: '#a5b4fc' }} />
                  </td>
                  <td className="items-cost-amount">{fmt(row.coutFixed + row.coutHoraire)}</td>
                  <td className="items-cost-amount">{fmt(row.fraisReouverture)}</td>
                  <td className="items-cost-amount">{fmt(row.nouveauPrix)}</td>
                  <td className="items-cost-amount total">{fmt(row.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>Total général</td>
                <td className="items-cost-amount total">{fmt(rows.reduce((s, r) => s + r.coutFixed + r.coutHoraire, 0))}</td>
                <td className="items-cost-amount total">{fmt(rows.reduce((s, r) => s + r.fraisReouverture, 0))}</td>
                <td className="items-cost-amount total">{fmt(rows.reduce((s, r) => s + r.nouveauPrix, 0))}</td>
                <td className="items-cost-amount total">{fmt(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Detail Panel ──────────────────────────────────────────────────────── */}
      {selectedItemtype && (
        <>
          {/* Overlay */}
          <div onClick={closePanel} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.3)', zIndex: 40 }} />

          {/* Drawer */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 520,
            background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,.12)',
            zIndex: 50, display: 'flex', flexDirection: 'column',
            fontFamily: 'system-ui, sans-serif',
          }}>
            {/* Header */}
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                {level3 ? (
                  <>
                    <button
                      onClick={() => setLevel3(null)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#4f46e5', padding: 0, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <i className="bi bi-arrow-left" /> {selectedItemtype}
                    </button>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Détail de l'item</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
                      #{level3.ticketId} — item #{level3.items_id}
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 2, wordBreak: 'break-word' }}>{level3.ticketName}</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Type d'item</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#1e293b' }}>{selectedItemtype}</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                      {level2Loading ? 'Chargement...' : `${level2Items.length} item(s) — cliquez une ligne pour le détail`}
                    </div>
                  </>
                )}
              </div>
              <button onClick={closePanel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#94a3b8', lineHeight: 1, padding: '0 4px', marginLeft: 8 }}>×</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

              {/* ── Level 3: batch breakdown ──────────────────────────────── */}
              {level3 && (() => {
                const scTotal = level3.supercostBatches.reduce((s, b) => s + b.amount, 0)
                const rcTotal = level3.reopenBatches.reduce((s, b)    => s + b.amount, 0)
                const grandTotalItem = level3.glpi + scTotal + rcTotal
                return (
                  <>
                    {/* Summary card */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Résumé</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, textAlign: 'center' }}>
                        {([
                          ['GLPI',        level3.glpi,  '#0369a1'],
                          ['Réouverture', rcTotal,      '#854d0e'],
                          ['Supercost',   scTotal,      '#1e40af'],
                          ['Total',       grandTotalItem, '#b45309'],
                        ] as [string, number, string][]).map(([label, val, color]) => (
                          <div key={label}>
                            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>{label}</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color }}>{fmt(val)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Batch detail table */}
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                      Comment {fmt(grandTotalItem)} a été obtenu
                    </div>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={thStyle}>Type de coût</th>
                            <th style={{ ...thStyle, textAlign: 'center' }}>Batch</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Montant</th>
                          </tr>
                        </thead>
                        <tbody>
                          {level3.glpi > 0 && (
                            <tr style={{ borderTop: '1px solid #f1f5f9' }}>
                              <td style={tdStyle}><span style={badge('#e0f2fe', '#0369a1')}>GLPI</span></td>
                              <td style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8' }}>—</td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(level3.glpi)}</td>
                            </tr>
                          )}
                          {level3.supercostBatches.map((b, i) => (
                            <tr key={`sc-${i}`} style={{ borderTop: '1px solid #f1f5f9' }}>
                              <td style={tdStyle}><span style={badge('#dbeafe', '#1e40af')}>close</span></td>
                              <td style={{ ...tdStyle, textAlign: 'center', color: '#64748b' }}>#{b.batch}</td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#1e40af' }}>{fmt(b.amount)}</td>
                            </tr>
                          ))}
                          {level3.reopenBatches.map((b, i) => (
                            <tr key={`rc-${i}`} style={{ borderTop: '1px solid #f1f5f9' }}>
                              <td style={tdStyle}><span style={badge('#fef9c3', '#854d0e')}>réouverture</span></td>
                              <td style={{ ...tdStyle, textAlign: 'center', color: '#64748b' }}>#{b.batch}</td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#854d0e' }}>{fmt(b.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                            <td colSpan={2} style={{ ...tdStyle, fontWeight: 700, color: '#64748b' }}>Total</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#b45309', fontSize: 15 }}>{fmt(grandTotalItem)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Movement history */}
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                      Historique mouvements — ticket #{level3.ticketId}
                    </div>
                    {level3.movements.length === 0 ? (
                      <div style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>Aucun mouvement enregistré</div>
                    ) : level3.movements.map(m => {
                      const c = MVT_COLORS[m.mvt] ?? { bg: '#e2e8f0', color: '#1e293b' }
                      const date = new Date(m.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      return (
                        <div key={m.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', marginBottom: 8, background: m.statut === 'error' ? '#fef2f2' : '#fafafa' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ background: c.bg, color: c.color, padding: '1px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{m.mvt}</span>
                            <span style={{ fontSize: 10, color: '#94a3b8' }}>{date}</span>
                          </div>
                          {m.valeur && <div style={{ fontSize: 12, color: '#475569', marginBottom: 3 }}><span style={{ color: '#94a3b8' }}>Valeur :</span> {m.valeur}</div>}
                          <div style={{ fontSize: 11, color: m.statut === 'error' ? '#dc2626' : '#64748b' }}>
                            <span style={{ background: m.statut === 'ok' ? '#dcfce7' : '#fee2e2', color: m.statut === 'ok' ? '#166534' : '#991b1b', padding: '0 5px', borderRadius: 999, fontSize: 10, fontWeight: 600, marginRight: 5 }}>
                              {m.statut === 'ok' ? '✓' : '✗'}
                            </span>
                            {m.message}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )
              })()}

              {/* ── Level 2: per-ticket/item list ─────────────────────────── */}
              {!level3 && (
                <>
                  {level2Loading && <div style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>Chargement...</div>}

                  {!level2Loading && level2Items.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontStyle: 'italic' }}>Aucun item trouvé</div>
                  )}

                  {!level2Loading && level2Items.length > 0 && (
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={thStyle}>Ticket / Item</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>GLPI</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Réouv.</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Supercost</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {level2Items.map((item, i) => {
                            const total = item.glpi + item.supercost + item.reopenCost
                            return (
                              <tr
                                key={i}
                                onClick={() => void handleItemClick(item)}
                                style={{ borderTop: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background .12s' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#eef2ff' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                                title="Voir le détail de ce coût"
                              >
                                <td style={tdStyle}>
                                  <div style={{ fontWeight: 600, color: '#4f46e5', fontSize: 12 }}>#{item.ticketId}</div>
                                  <div style={{ color: '#374151', fontSize: 12, marginTop: 1 }}>{item.ticketName}</div>
                                  <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 1 }}>item #{item.items_id}</div>
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'right', color: item.glpi      ? '#1e293b' : '#cbd5e1' }}>{fmt(item.glpi)}</td>
                                <td style={{ ...tdStyle, textAlign: 'right', color: item.reopenCost ? '#854d0e' : '#cbd5e1' }}>{fmt(item.reopenCost)}</td>
                                <td style={{ ...tdStyle, textAlign: 'right', color: item.supercost ? '#1e40af' : '#cbd5e1' }}>{fmt(item.supercost)}</td>
                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#b45309' }}>{fmt(total)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        {level2Items.length > 1 && (
                          <tfoot>
                            <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                              <td style={{ ...tdStyle, fontWeight: 700, color: '#64748b' }}>Total</td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{fmt(level2Items.reduce((s, i) => s + i.glpi,      0))}</td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{fmt(level2Items.reduce((s, i) => s + i.reopenCost, 0))}</td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{fmt(level2Items.reduce((s, i) => s + i.supercost,  0))}</td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#b45309' }}>
                                {fmt(level2Items.reduce((s, i) => s + i.glpi + i.supercost + i.reopenCost, 0))}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  )}

                  {level3Loading && (
                    <div style={{ textAlign: 'center', padding: '12px', color: '#64748b', fontSize: 12 }}>Chargement du détail...</div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '10px 20px', borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#94a3b8' }}>
              {level3
                ? `${level3.supercostBatches.length} batch(es) close · ${level3.reopenBatches.length} réouverture(s) · ${level3.movements.length} mouvement(s)`
                : `${level2Items.length} item(s) — ${selectedItemtype}`
              }
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Style helpers ──────────────────────────────────────────────────────────────

const badge = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-block',
  background: bg, color,
  padding: '1px 8px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
})

const thStyle: React.CSSProperties = {
  padding: '7px 10px',
  textAlign: 'left',
  fontWeight: 700,
  color: '#64748b',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  borderBottom: '1px solid #e2e8f0',
}

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 12,
  verticalAlign: 'middle',
}
