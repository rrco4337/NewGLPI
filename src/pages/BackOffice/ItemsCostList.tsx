import { useState, useEffect } from 'react'
import { glpiTicketService } from '@/services/glpiService'
import { ItemSuperCostApi } from '@/api/itemSuperCost'
import type { GlpiTicket } from '@/types/glpi'
import './ItemsCostList.css'

interface ItemTypeRow {
  itemtype: string
  tickets: { ticketId: number; ticketName: string; items_id: number }[]
  coutFixed: number
  coutHoraire: number
  nouveauPrix: number
  fraisReouverture: number
  total: number
  totalSansHoraire: number
}

interface Movement {
  id: number
  ticket_id: number
  mvt: string
  valeur: string | null
  statut: string
  message: string | null
  created_at: string
}

const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })

const MVT_COLORS: Record<string, { bg: string; color: string }> = {
  close:  { bg: '#dbeafe', color: '#1e40af' },
  open:   { bg: '#fef9c3', color: '#854d0e' },
  cancel: { bg: '#fce7f3', color: '#9d174d' },
}

export const ItemsCostList = () => {
  const [rows, setRows] = useState<ItemTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedTicket, setSelectedTicket] = useState<{ id: number; name: string } | null>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [loadingMvt, setLoadingMvt] = useState(false)

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
          const nbItems = ticketItems.length

          for (const item of ticketItems) {
            const coutFixed = nbItems > 0 ? glpiCost.cost_fixed / nbItems : 0
            const coutHoraire = nbItems > 0 ? glpiCost.cost_time / nbItems : 0

            if (!byItemtype.has(item.itemtype)) {
              byItemtype.set(item.itemtype, {
                itemtype: item.itemtype,
                tickets: [],
                coutFixed: 0,
                coutHoraire: 0,
                nouveauPrix: 0,
                fraisReouverture: 0,
                total: 0,
                totalSansHoraire: 0,
              })
            }
            const row = byItemtype.get(item.itemtype)!
            row.tickets.push({
              ticketId,
              ticketName: ticket?.name || `Ticket #${ticketId}`,
              items_id: item.items_id,
            })
            row.coutFixed += coutFixed
            row.coutHoraire += coutHoraire
          }
        }

        for (const s of summaries) {
          if (!byItemtype.has(s.itemtype)) {
            byItemtype.set(s.itemtype, {
              itemtype: s.itemtype,
              tickets: [],
              coutFixed: 0,
              coutHoraire: 0,
              nouveauPrix: 0,
              fraisReouverture: 0,
              total: 0,
              totalSansHoraire: 0,
            })
          }
          const row = byItemtype.get(s.itemtype)!
          row.nouveauPrix = s.superCost
          row.fraisReouverture = s.reopenCost
        }

        for (const row of byItemtype.values()) {
          row.total = row.coutFixed + row.coutHoraire + row.nouveauPrix + row.fraisReouverture
          row.totalSansHoraire = row.coutFixed + row.nouveauPrix + row.fraisReouverture
        }

        const result = Array.from(byItemtype.values()).sort((a, b) =>
          a.itemtype.localeCompare(b.itemtype)
        )
        setRows(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const handleTicketClick = async (ticketId: number, ticketName: string) => {
    setSelectedTicket({ id: ticketId, name: ticketName })
    setLoadingMvt(true)
    setMovements([])
    try {
      const res = await fetch(`/api/ticket-movements/${ticketId}`)
      if (res.ok) setMovements(await res.json())
    } catch { /* ignore */ }
    setLoadingMvt(false)
  }

  if (loading) return <div className="items-cost-loading">Chargement...</div>
  if (error) return <div className="items-cost-error">Erreur : {error}</div>

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0)
  const grandTotalSansHoraire = rows.reduce((sum, r) => sum + r.totalSansHoraire, 0)

  return (
    <div className="items-cost-page" style={{ position: 'relative' }}>
      <div className="items-cost-header">
        <h2>Coûts par type d'item</h2>
        {rows.length > 0 && (
          <p>Total général : <strong>{fmt(grandTotal)}</strong> — {rows.length} type(s) d'item</p>
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
                <th>Tickets concernés</th>
                <th style={{ textAlign: 'right' }}>GLPI</th>
                <th style={{ textAlign: 'right' }}>Réouverture</th>
                <th style={{ textAlign: 'right' }}>Supercost</th>
                <th style={{ textAlign: 'right' }}>Total général</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="items-cost-itemtype">{row.itemtype}</td>
                  <td>
                    {row.tickets.map((t, j) => (
                      <div
                        key={j}
                        className="items-cost-ticket-line"
                        onClick={() => handleTicketClick(t.ticketId, t.ticketName)}
                        style={{
                          cursor: 'pointer',
                          borderRadius: 6,
                          padding: '3px 6px',
                          transition: 'background .15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#eef2ff' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                        title="Voir le détail des mouvements"
                      >
                        <span style={{ color: '#4f46e5', fontWeight: 600 }}>#{t.ticketId}</span>
                        {' — '}
                        {t.ticketName}
                        {' '}
                        <span style={{ color: '#94a3b8' }}>(item #{t.items_id})</span>
                        {' '}
                        <i className="bi bi-box-arrow-up-right" style={{ fontSize: 10, color: '#94a3b8' }} />
                      </div>
                    ))}
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
                <td colSpan={2} style={{ textAlign: 'right', fontWeight: 700 }}>Total général</td>
                <td className="items-cost-amount total">{fmt(rows.reduce((s, r) => s + r.coutFixed + r.coutHoraire, 0))}</td>
                <td className="items-cost-amount total">{fmt(rows.reduce((s, r) => s + r.fraisReouverture, 0))}</td>
                <td className="items-cost-amount total">{fmt(rows.reduce((s, r) => s + r.nouveauPrix, 0))}</td>
                <td className="items-cost-amount total">{fmt(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Detail drawer */}
      {selectedTicket && (
        <>
          {/* Overlay */}
          <div
            onClick={() => setSelectedTicket(null)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(15,23,42,.3)',
              zIndex: 40,
            }}
          />

          {/* Panel */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: 420,
            background: '#fff',
            boxShadow: '-4px 0 24px rgba(0,0,0,.12)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'system-ui, sans-serif',
          }}>
            {/* Header */}
            <div style={{
              padding: '18px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>Détail ticket</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#1e293b' }}>
                  #{selectedTicket.id}
                </div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2, maxWidth: 330, wordBreak: 'break-word' }}>
                  {selectedTicket.name}
                </div>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94a3b8', lineHeight: 1, padding: 4 }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
                Historique des mouvements
              </div>

              {loadingMvt && (
                <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Chargement...</div>
              )}

              {!loadingMvt && movements.length === 0 && (
                <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '20px 0', fontStyle: 'italic' }}>
                  Aucun mouvement enregistré pour ce ticket.
                </div>
              )}

              {!loadingMvt && movements.map(m => {
                const colors = MVT_COLORS[m.mvt] ?? { bg: '#e2e8f0', color: '#1e293b' }
                const date = new Date(m.created_at).toLocaleString('fr-FR', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })
                return (
                  <div key={m.id} style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    padding: '12px 14px',
                    marginBottom: 10,
                    background: m.statut === 'error' ? '#fef2f2' : '#fafafa',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{
                        background: colors.bg,
                        color: colors.color,
                        padding: '2px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                      }}>
                        {m.mvt}
                      </span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{date}</span>
                    </div>
                    {m.valeur && (
                      <div style={{ fontSize: 13, color: '#475569', marginBottom: 4 }}>
                        <span style={{ color: '#94a3b8' }}>Valeur :</span> {m.valeur}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: m.statut === 'error' ? '#dc2626' : '#64748b' }}>
                      <span style={{
                        background: m.statut === 'ok' ? '#dcfce7' : '#fee2e2',
                        color: m.statut === 'ok' ? '#166534' : '#991b1b',
                        padding: '1px 7px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        marginRight: 6,
                      }}>
                        {m.statut === 'ok' ? '✓' : '✗'}
                      </span>
                      {m.message}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', fontSize: 12, color: '#94a3b8' }}>
              {movements.length > 0 && `${movements.length} mouvement(s) au total`}
            </div>
          </div>
        </>
      )}

      {/* Hidden but needed for tfoot reference */}
      <div style={{ display: 'none' }}>{grandTotalSansHoraire}</div>
    </div>
  )
}
