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
  totalGlpi: number
}

const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

type DetailData = {
  supercosts: { ticket_id: number; batch: number; items_id: number; amount: number }[]
  reopencosts: { ticket_id: number; batch: number; items_id: number; amount: number }[]
}

export const ItemsCostList = () => {
  const [rows, setRows] = useState<ItemTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [itemtypeOuvert, setItemtypeOuvert] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<DetailData | null>(null)
  const [chargementDetail, setChargementDetail] = useState(false)

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
                totalGlpi: 0
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
              totalGlpi: 0
            })
          }
          const row = byItemtype.get(s.itemtype)!
          row.nouveauPrix = s.superCost
          row.fraisReouverture = s.reopenCost
        }

        // Calculer les totaux après fusion
        for (const row of byItemtype.values()) {
          row.total = row.coutFixed + row.coutHoraire + row.nouveauPrix + row.fraisReouverture
          row.totalGlpi = row.coutFixed + row.coutHoraire
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

  async function ouvrirDetail(itemtype: string) {
    if (itemtypeOuvert === itemtype) {
      setItemtypeOuvert(null)
      setDetailData(null)
      return
    }
    setItemtypeOuvert(itemtype)
    setDetailData(null)
    setChargementDetail(true)
    try {
      const data = await ItemSuperCostApi.getDetailsByItemtype(itemtype)
      setDetailData(data)
    } catch {
      setDetailData(null)
    }
    setChargementDetail(false)
  }

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0)

  // const grandTotalSansHoraire = rows.reduce((sum, r) => sum + r.totalSansHoraire, 0)
  // const totalGlpi = rows.reduce((sum, r) => sum + r.totalSansHoraire, 0)
  const ticketName= new Map<number, string>()
    for(const row of rows){
      for(const t of row.tickets){
        ticketName.set(t.ticketId, t.ticketName)
      }
    }


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

                <th style={{ textAlign: 'right' }}>Coût GlpiTicket</th>
                <th style={{ textAlign: 'right' }}>Super Cost</th>
                <th style={{ textAlign: 'right' }}>Frais de réouverture</th>
                <th style={{ textAlign: 'right' }}>Total</th>

              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="items-cost-itemtype" style={{ cursor: 'pointer' }} onClick={() => ouvrirDetail(row.itemtype)}>
                    {row.itemtype} {itemtypeOuvert === row.itemtype ? '▲' : '▼'}
                  </td>
                  <td>
                    {row.tickets.map((t, j) => (
                      <div key={j} className="items-cost-ticket-line">
                        #{t.ticketId} — {t.ticketName} (item #{t.items_id})
                      </div>
                    ))}
                  </td>

                  <td className="items-cost-amount">{fmt(row.totalGlpi) }</td>
                  <td className="items-cost-amount">{fmt(row.nouveauPrix)}</td>
                  <td className="items-cost-amount">{fmt(row.fraisReouverture)}</td>
                  <td className="items-cost-amount total">{fmt(row.total)}</td>

                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ textAlign: 'right' }}></td>
                <td className="items-cost-amount total">{fmt(grandTotal)}</td>

              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {itemtypeOuvert && (
        <div style={{ marginTop: 24 }}>
          <h3>Détails : {itemtypeOuvert}</h3>
          {chargementDetail && <p>Chargement...</p>}
          {!chargementDetail && detailData && (
            <div>
              <div className="detail-section">
                <h4>Supercosts ({detailData.supercosts.length})</h4>
                {detailData.supercosts.length === 0 ? <p style={{ padding: '8px 14px', margin: 0, color: '#94a3b8', fontSize: 13 }}>Aucun</p> : (
                  <table className="detail-table">
                    <thead>
                      <tr><th>ticket</th><th>type</th><th>items_id</th><th>batch</th><th>montant</th></tr>
                    </thead>
                    <tbody>
                      {detailData.supercosts.map((sc, i) => (
                        <tr key={i}>
                          <td>#{sc.ticket_id} — {ticketName.get(sc.ticket_id) ?? '?'}</td>
                          <td>Supercost</td>
                          <td>{sc.items_id}</td>
                          <td>{sc.batch}</td>
                          <td>{fmt(sc.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="detail-section">
                <h4>Frais réouverture ({detailData.reopencosts.length})</h4>
                {detailData.reopencosts.length === 0 ? <p style={{ padding: '8px 14px', margin: 0, color: '#94a3b8', fontSize: 13 }}>Aucun</p> : (
                  <table className="detail-table">
                    <thead>
                      <tr><th>ticket</th><th>type</th><th>items_id</th><th>batch</th><th>montant</th></tr>
                    </thead>
                    <tbody>
                      {detailData.reopencosts.map((rc, i) => (
                        <tr key={i}>
                          <td>#{rc.ticket_id} — {ticketName.get(rc.ticket_id) ?? '?'}</td>
                          <td>Réouverture</td>
                          <td>{rc.items_id}</td>
                          <td>{rc.batch}</td>
                          <td>{fmt(rc.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
