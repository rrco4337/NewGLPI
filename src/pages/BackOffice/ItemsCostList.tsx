import { useState, useEffect } from 'react'
import { glpiTicketService } from '@/services/glpiService'
import { KanbanSettingApi } from '@/api/kanbanSetting'
import type { GlpiTicket } from '@/types/glpi'

interface ItemRow {
  ticketId: number
  ticketName: string
  itemtype: string
  items_id: number
  nbItems: number
  coutFixed: number
  coutHoraire: number
  nouveauPrix: number
  total: number
}

const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

export const ItemsCostList = () => {
  const [rows, setRows] = useState<ItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [bulk, settingsMap] = await Promise.all([
          glpiTicketService.listItemsCosts(),
          KanbanSettingApi.getSettingsMap(),
        ])

        const { tickets, costs, items } = bulk

        // Lookup: ticketId → total cost_fixed + cost_time (somme de toutes les entrées TicketCost)
        const costByTicket = new Map<number, { cost_fixed: number; cost_time: number }>()
        for (const c of costs) {
          const existing = costByTicket.get(c.tickets_id) ?? { cost_fixed: 0, cost_time: 0 }
          existing.cost_fixed += c.cost_fixed
          existing.cost_time += c.cost_time
          costByTicket.set(c.tickets_id, existing)
        }

        // Lookup: ticketId → nouveau prix (SQLite)
        const sqlitePriceByTicket = new Map<number, number>()
        for (const [key, value] of Object.entries(settingsMap)) {
          const match = key.match(/^ticket_super_cost_(\d+)$/)
          if (match) {
            sqlitePriceByTicket.set(Number(match[1]), parseFloat(value) || 0)
          }
        }

        // Lookup: ticketId → liste des items liés
        const itemsByTicket = new Map<number, typeof items>()
        for (const item of items) {
          if (!itemsByTicket.has(item.tickets_id)) itemsByTicket.set(item.tickets_id, [])
          itemsByTicket.get(item.tickets_id)!.push(item)
        }

        // Lookup: ticketId → ticket
        const ticketById = new Map<number, GlpiTicket>()
        for (const t of tickets) ticketById.set(t.id, t)

        // Construire les lignes : une ligne par item lié à un ticket
        const result: ItemRow[] = []
        for (const [ticketId, ticketItems] of itemsByTicket.entries()) {
          const ticket = ticketById.get(ticketId)
          const glpiCost = costByTicket.get(ticketId) ?? { cost_fixed: 0, cost_time: 0 }
          const nouveauPrixTotal = sqlitePriceByTicket.get(ticketId) ?? 0
          const nbItems = ticketItems.length

          for (const item of ticketItems) {
            const coutFixed = nbItems > 0 ? glpiCost.cost_fixed / nbItems : 0
            const coutHoraire = nbItems > 0 ? glpiCost.cost_time / nbItems : 0
            const nouveauPrix = nbItems > 0 ? nouveauPrixTotal / nbItems : 0
            const total = coutFixed + coutHoraire + nouveauPrix

            result.push({
              ticketId,
              ticketName: ticket?.name || `Ticket #${ticketId}`,
              itemtype: item.itemtype,
              items_id: item.items_id,
              nbItems,
              coutFixed,
              coutHoraire,
              nouveauPrix,
              total,
            })
          }
        }

        result.sort((a, b) => b.ticketId - a.ticketId)
        setRows(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  if (loading) return <div style={{ padding: 24 }}>Chargement...</div>
  if (error) return <div style={{ padding: 24, color: 'red' }}>Erreur : {error}</div>

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0)

  return (
    <div style={{ padding: 24 }}>
      <h2>Coûts par items</h2>

      {rows.length === 0 ? (
        <p>Aucun item avec coût trouvé.</p>
      ) : (
        <>
          <p>Total général : <strong>{fmt(grandTotal)}</strong> — {rows.length} item(s)</p>
          <table
            border={1}
            cellPadding={6}
            cellSpacing={0}
            style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}
          >
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                <th>Ticket</th>
                <th>Type item</th>
                <th>ID item</th>
                <th>Nb items liés</th>
                <th>Coût fixe / item</th>
                <th>Coût horaire / item</th>
                <th>Nouveau prix / item</th>
                <th>Total / item</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>#{row.ticketId} — {row.ticketName}</td>
                  <td>{row.itemtype}</td>
                  <td>#{row.items_id}</td>
                  <td style={{ textAlign: 'center' }}>{row.nbItems}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(row.coutFixed)}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(row.coutHoraire)}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(row.nouveauPrix)}</td>
                  <td style={{ textAlign: 'right' }}><strong>{fmt(row.total)}</strong></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f0f0f0', fontWeight: 'bold' }}>
                <td colSpan={7} style={{ textAlign: 'right' }}>Total général</td>
                <td style={{ textAlign: 'right' }}>{fmt(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
    </div>
  )
}
