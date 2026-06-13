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

const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

export const ItemsCostList = () => {
  const [rows, setRows] = useState<ItemTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        // Données GLPI (coûts horaires/fixes) + données SQLite (supercost/reopen) en parallèle
        const [bulk, summaries] = await Promise.all([
          glpiTicketService.listItemsCosts(),
          ItemSuperCostApi.getItemCostSummaries(),
        ])

        const { tickets, costs, items } = bulk

        // Coûts GLPI par ticket
        const costByTicket = new Map<number, { cost_fixed: number; cost_time: number }>()
        for (const c of costs) {
          const existing = costByTicket.get(c.tickets_id) ?? { cost_fixed: 0, cost_time: 0 }
          existing.cost_fixed += c.cost_fixed
          existing.cost_time += c.cost_time * (c.actiontime / 3600)
          costByTicket.set(c.tickets_id, existing)
        }

        // Items GLPI par ticket
        const itemsByTicket = new Map<number, typeof items>()
        for (const item of items) {
          if (!itemsByTicket.has(item.tickets_id)) itemsByTicket.set(item.tickets_id, [])
          itemsByTicket.get(item.tickets_id)!.push(item)
        }

        const ticketById = new Map<number, GlpiTicket>()
        for (const t of tickets) ticketById.set(t.id, t)

        // Construire les lignes groupées par itemtype (coûts GLPI uniquement ici)
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

        // Fusionner avec les supercosts/reopen de la base SQLite
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

        // Calculer les totaux après fusion
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

  if (loading) return <div className="items-cost-loading">Chargement...</div>
  if (error) return <div className="items-cost-error">Erreur : {error}</div>

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0)
  const grandTotalSansHoraire = rows.reduce((sum, r) => sum + r.totalSansHoraire, 0)

  return (
    <div className="items-cost-page">
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
                <th style={{ textAlign: 'right' }}>Coût fixe</th>
                <th style={{ textAlign: 'right' }}>Coût horaire</th>
                <th style={{ textAlign: 'right' }}>Nouveau prix</th>
                <th style={{ textAlign: 'right' }}>Frais de réouverture</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'right' }}>Total sans horaire</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="items-cost-itemtype">{row.itemtype}</td>
                  <td>
                    {row.tickets.map((t, j) => (
                      <div key={j} className="items-cost-ticket-line">
                        #{t.ticketId} — {t.ticketName} (item #{t.items_id})
                      </div>
                    ))}
                  </td>
                  <td className="items-cost-amount">{fmt(row.coutFixed)}</td>
                  <td className="items-cost-amount">{fmt(row.coutHoraire)}</td>
                  <td className="items-cost-amount">{fmt(row.nouveauPrix)}</td>
                  <td className="items-cost-amount">{fmt(row.fraisReouverture)}</td>
                  <td className="items-cost-amount total">{fmt(row.total)}</td>
                  <td className="items-cost-amount total">{fmt(row.totalSansHoraire)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} style={{ textAlign: 'right' }}>Total général</td>
                <td className="items-cost-amount total">{fmt(grandTotal)}</td>
                <td className="items-cost-amount total">{fmt(grandTotalSansHoraire)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
