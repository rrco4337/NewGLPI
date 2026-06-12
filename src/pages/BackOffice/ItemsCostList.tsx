import { useState, useEffect } from 'react'
import { glpiTicketService } from '@/services/glpiService'
import { KanbanSettingApi } from '@/api/kanbanSetting'
import type { GlpiTicket } from '@/types/glpi'

interface ItemRow {
  ticketId: number
  ticketName: string
  items: { itemtype: string; items_id: number }[]
  nbItems: number
  coutFixed: number
  coutHoraire: number
  nouveauPrix: number
  total: number
  totalSansHoraire: number
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

        // Lookup: ticketId → coût fixe total + coût horaire total (taux × heures par entrée)
        const costByTicket = new Map<number, { cost_fixed: number; cost_time: number }>()
        for (const c of costs) {
          const existing = costByTicket.get(c.tickets_id) ?? { cost_fixed: 0, cost_time: 0 }
          existing.cost_fixed += c.cost_fixed
          existing.cost_time += c.cost_time * (c.actiontime / 3600)
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

        // Construire les lignes : une ligne par ticket
        const result: ItemRow[] = []
        for (const [ticketId, ticketItems] of itemsByTicket.entries()) {
          const ticket = ticketById.get(ticketId)
          const glpiCost = costByTicket.get(ticketId) ?? { cost_fixed: 0, cost_time: 0 }
          const nouveauPrix = sqlitePriceByTicket.get(ticketId) ?? 0
          const total = glpiCost.cost_fixed + glpiCost.cost_time + nouveauPrix
          const totalSansHoraire = glpiCost.cost_fixed + nouveauPrix

          result.push({
            ticketId,
            ticketName: ticket?.name || `Ticket #${ticketId}`,
            items: ticketItems.map(i => ({ itemtype: i.itemtype, items_id: i.items_id })),
            nbItems: ticketItems.length,
            coutFixed: glpiCost.cost_fixed,
            coutHoraire: glpiCost.cost_time,
            nouveauPrix,
            total,
            totalSansHoraire,
          })
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
  const grandTotalSansHoraire = rows.reduce((sum, r) => sum + r.totalSansHoraire, 0)

  return (
    <div style={{ padding: 24 }}>
      <h2>Coûts par items</h2>

      {rows.length === 0 ? (
        <p>Aucun item avec coût trouvé.</p>
      ) : (
        <>
          <p>Total général : <strong>{fmt(grandTotal)}</strong> — {rows.length} ticket(s)</p>
          <table
            border={1}
            cellPadding={6}
            cellSpacing={0}
            style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}
          >
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                <th>Ticket</th>
                <th>Items liés</th>
                <th>Nb items</th>
                <th>Coût fixe</th>
                <th>Coût horaire</th>
                <th>Nouveau prix</th>
                <th>Total</th>
                <th>Total sans horaire</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>#{row.ticketId} — {row.ticketName}</td>
                  <td style={{ fontSize: 11 }}>
                    {row.items.map(it => `${it.itemtype} #${it.items_id}`).join(', ')}
                  </td>
                  <td style={{ textAlign: 'center' }}>{row.nbItems}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(row.coutFixed)}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(row.coutHoraire)}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(row.nouveauPrix)}</td>
                  <td style={{ textAlign: 'right' }}><strong>{fmt(row.total)}</strong></td>
                  <td style={{ textAlign: 'right' }}><strong>{fmt(row.totalSansHoraire)}</strong></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f0f0f0', fontWeight: 'bold' }}>
                <td colSpan={6} style={{ textAlign: 'right' }}>Total général</td>
                <td style={{ textAlign: 'right' }}>{fmt(grandTotal)}</td>
                <td style={{ textAlign: 'right' }}>{fmt(grandTotalSansHoraire)}</td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
    </div>
  )
}
