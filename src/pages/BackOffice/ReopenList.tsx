import { useState, useEffect, useCallback } from 'react'
import { glpiTicketService } from '@/services/glpiService'
import { ItemSuperCostApi } from '@/api/itemSuperCost'
import type { ReopenGroup, SuperCostBatch, TicketCeiling } from '@/api/itemSuperCost'
import './ItemsCostList.css'


const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

// Libellé court du mode de calcul de la base Super Cost (1-4)
const MODE_LABEL: Record<number, string> = { 1: 'dernier', 2: 'premier', 3: 'moyenne', 4: 'somme' }
const MODE_OPTIONS = [1, 2, 3, 4]

type EditState = { group: number; percent: string; mode: number; saving: boolean }
type SuperEditState = { ticketId: number; batch: number; amount: string; saving: boolean }

export const ReopenList = () => {
  const [reopens, setReopens] = useState<ReopenGroup[]>([])
  const [supercosts, setSupercosts] = useState<SuperCostBatch[]>([])
  const [cancelledSupercosts, setCancelledSupercosts] = useState<SuperCostBatch[]>([])
  const [ticketNames, setTicketNames] = useState<Map<number, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [superEdit, setSuperEdit] = useState<SuperEditState | null>(null)
  const [ceilings, setCeilings] = useState<Map<number, number>>(new Map())
  const [ceilingForm, setCeilingForm] = useState<{ ticketId: string; percent: string; saving: boolean }>({ ticketId: '', percent: '', saving: false })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, scList, cancelledList, tickets, ceilingList] = await Promise.all([
        ItemSuperCostApi.listReopens(),
        ItemSuperCostApi.listSuperCosts(),
        ItemSuperCostApi.listCancelledSuperCosts(),
        glpiTicketService.listTickets(),
        ItemSuperCostApi.listCeilings(),
      ])
      const names = new Map<number, string>()
      if (Array.isArray(tickets)) {
        for (const t of tickets) names.set(t.id, t.name || `Ticket #${t.id}`)
      }
      setReopens(list)
      setSupercosts(scList)
      setCancelledSupercosts(cancelledList)
      setTicketNames(names)
      setCeilings(new Map(ceilingList.map((c: TicketCeiling) => [c.ticketId, c.percent])))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const openEdit = (r: ReopenGroup) => {
    setEdit({ group: r.reopenGroup, percent: String(r.percent), mode: r.mode, saving: false })
  }

  const saveEdit = async () => {
    if (!edit) return
    const pct = parseFloat(edit.percent)
    if (isNaN(pct)) return
    setEdit({ ...edit, saving: true })
    try {
      await ItemSuperCostApi.updateReopen(edit.group, pct, edit.mode)
      setEdit(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la modification')
      setEdit(prev => (prev ? { ...prev, saving: false } : prev))
    }
  }

  const closeReopen = async (r: ReopenGroup) => {
    const label = ticketNames.get(r.ticketId) ?? `Ticket #${r.ticketId}`
    if (!window.confirm(`Supprimer (fermer) la réouverture #${r.reopenGroup} du ticket « ${label} » ?\nLes frais seront remis à 0 mais la ligne restera affichée à sa place.`)) return
    try {
      await ItemSuperCostApi.closeReopen(r.reopenGroup)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression')
    }
  }

  const openSuperEdit = (s: SuperCostBatch) => {
    setSuperEdit({ ticketId: s.ticketId, batch: s.batch, amount: String(s.total), saving: false })
  }

  const saveSuperEdit = async () => {
    if (!superEdit) return
    const amount = parseFloat(superEdit.amount)
    if (isNaN(amount)) return
    setSuperEdit({ ...superEdit, saving: true })
    try {
      await ItemSuperCostApi.updateSuperCost(superEdit.ticketId, superEdit.batch, amount)
      setSuperEdit(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la modification')
      setSuperEdit(prev => (prev ? { ...prev, saving: false } : prev))
    }
  }

  const restoreSuperCost = async (s: SuperCostBatch) => {
    const label = ticketNames.get(s.ticketId) ?? `Ticket #${s.ticketId}`
    if (!window.confirm(`Rétablir le Super Cost (ticket « ${label} », batch ${s.batch}) ?\nIl regagnera sa place d'origine dans la liste.`)) return
    try {
      await ItemSuperCostApi.restoreSuperCost(s.ticketId, s.batch)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du rétablissement')
    }
  }

  const saveCeiling = async () => {
    const ticketId = Number(ceilingForm.ticketId)
    if (!ticketId) return
    const pct = ceilingForm.percent.trim() === '' ? null : parseFloat(ceilingForm.percent)
    if (pct !== null && isNaN(pct)) return
    setCeilingForm(f => ({ ...f, saving: true }))
    try {
      await ItemSuperCostApi.setCeiling(ticketId, pct)
      setCeilingForm({ ticketId: '', percent: '', saving: false })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement du plafond')
      setCeilingForm(f => ({ ...f, saving: false }))
    }
  }

  if (loading) return <div className="items-cost-loading">Chargement...</div>
  if (error) return <div className="items-cost-error">Erreur : {error}</div>

  const grandTotal = reopens.reduce((sum, r) => sum + r.total, 0)
  const grandTotalSuper = supercosts.reduce((sum, s) => sum + s.total, 0)
  const hasCeiling = ceilings.size > 0

  // Plafond défini PAR TICKET : somme des Super Cost du ticket × pourcentage du ticket.
  const sumByTicket = (rows: { ticketId: number; total: number }[]) => {
    const m = new Map<number, number>()
    for (const r of rows) m.set(r.ticketId, (m.get(r.ticketId) ?? 0) + r.total)
    return m
  }
  const superByTicket = sumByTicket(supercosts)
  const reopenByTicket = sumByTicket(reopens)
  const ticketCeilingMax = (ticketId: number) =>
    (superByTicket.get(ticketId) ?? 0) * ((ceilings.get(ticketId) ?? 0) / 100)
  const ticketCeilingAvail = (ticketId: number) =>
    Math.max(0, ticketCeilingMax(ticketId) - (reopenByTicket.get(ticketId) ?? 0))

  // Tickets éligibles à un plafond = ceux qui ont au moins un Super Cost.
  const ceilingTickets = [...superByTicket.keys()].sort((a, b) => a - b)

  return (
    <div className="items-cost-page">
      <div className="items-cost-header">
        <h2>Réouvertures &amp; Super Cost</h2>
        {reopens.length > 0 && (
          <p>Total des frais de réouverture : <strong>{fmt(grandTotal)}</strong> — {reopens.length} réouverture(s)</p>
        )}

        <label className="reopen-field">
          <span>Plafond de réouverture — ticket</span>
          <select
            value={ceilingForm.ticketId}
            onChange={e => setCeilingForm(f => ({ ...f, ticketId: e.target.value, percent: String(ceilings.get(Number(e.target.value)) ?? '') }))}
            disabled={ceilingForm.saving}
          >
            <option value="">— Choisir un ticket —</option>
            {ceilingTickets.map(id => (
              <option key={id} value={id}>
                #{id} — {ticketNames.get(id) ?? `Ticket #${id}`}{ceilings.has(id) ? ` (${ceilings.get(id)} %)` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="reopen-field">
          <span>Plafond (%)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={ceilingForm.percent}
            onChange={e => setCeilingForm(f => ({ ...f, percent: e.target.value }))}
            disabled={ceilingForm.saving || !ceilingForm.ticketId}
            placeholder="Vide = aucun plafond"
          />
        </label>
        <button
          className="reopen-btn reopen-btn-edit"
          onClick={() => void saveCeiling()}
          disabled={ceilingForm.saving || !ceilingForm.ticketId}
        >
          {ceilingForm.saving ? 'Enregistrement...' : 'Enregistrer le plafond'}
        </button>
        {hasCeiling && (
          <p>
            Plafonds définis :{' '}
            {ceilingTickets.filter(id => ceilings.has(id)).map(id => `#${id} : ${ceilings.get(id)} %`).join(' · ')}
          </p>
        )}
      </div>

      <h3 className="reopen-section-title">Liste des réouvertures</h3>

      {reopens.length === 0 ? (
        <p className="items-cost-empty">Aucune réouverture enregistrée.</p>
      ) : (
        <div className="items-cost-table-container">
          <table className="items-cost-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Ticket</th>
                <th>Items concernés</th>
                <th style={{ textAlign: 'center' }}>Mode</th>
                <th style={{ textAlign: 'right' }}>Pourcentage</th>
                <th style={{ textAlign: 'right' }}>Frais</th>
                {hasCeiling && <th style={{ textAlign: 'right' }}>Plafond (ticket)</th>}
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reopens.map(r => (
                <tr key={r.reopenGroup} className={r.closed ? 'reopen-row-closed' : undefined}>
                  <td>{r.reopenGroup}</td>
                  <td className="items-cost-itemtype">
                    #{r.ticketId} — {ticketNames.get(r.ticketId) ?? `Ticket #${r.ticketId}`}
                  </td>
                  <td>
                    {r.items.map((it, j) => (
                      <div key={j} className="items-cost-ticket-line">
                        {it.itemtype} (item #{it.items_id}) — {fmt(it.amount)}
                      </div>
                    ))}
                  </td>
                  <td style={{ textAlign: 'center' }}>{r.mode} — {MODE_LABEL[r.mode] ?? '?'}</td>
                  <td className="items-cost-amount">{r.percent} %</td>
                  <td className="items-cost-amount total">{fmt(r.total)}</td>
                  {hasCeiling && (
                    <td className="items-cost-amount">
                      {ceilings.has(r.ticketId)
                        ? `${ceilings.get(r.ticketId)} % · max ${fmt(ticketCeilingMax(r.ticketId))} · dispo ${fmt(ticketCeilingAvail(r.ticketId))}`
                        : '—'}
                    </td>
                  )}
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button
                      className="reopen-btn reopen-btn-edit"
                      onClick={() => openEdit(r)}
                      disabled={r.closed}
                      title={r.closed ? 'Réouverture fermée' : 'Modifier la valeur et le mode'}
                    >
                      <i className="bi bi-pencil" /> Modifier
                    </button>
                    
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ textAlign: 'right' }}>Total</td>
                <td className="items-cost-amount total">{fmt(grandTotal)}</td>
                <td colSpan={hasCeiling ? 2 : 1} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <h3 className="reopen-section-title">Liste des Super Cost</h3>

      {supercosts.length === 0 ? (
        <p className="items-cost-empty">Aucun Super Cost enregistré.</p>
      ) : (
        <div className="items-cost-table-container">
          <table className="items-cost-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th style={{ textAlign: 'center' }}>Batch</th>
                <th>Items concernés</th>
                <th style={{ textAlign: 'right' }}>Montant</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {supercosts.map(s => (
                <tr key={`${s.ticketId}-${s.batch}`}>
                  <td className="items-cost-itemtype">
                    #{s.ticketId} — {ticketNames.get(s.ticketId) ?? `Ticket #${s.ticketId}`}
                  </td>
                  <td style={{ textAlign: 'center' }}>{s.batch}</td>
                  <td>
                    {s.items.map((it, j) => (
                      <div key={j} className="items-cost-ticket-line">
                        {it.itemtype} (item #{it.items_id}) — {fmt(it.amount)}
                      </div>
                    ))}
                  </td>
                  <td className="items-cost-amount total">{fmt(s.total)}</td>
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button
                      className="reopen-btn reopen-btn-edit"
                      onClick={() => openSuperEdit(s)}
                      title="Modifier le montant du Super Cost"
                    >
                      <i className="bi bi-pencil" /> Modifier
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ textAlign: 'right' }}>Total</td>
                <td className="items-cost-amount total">{fmt(grandTotalSuper)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <h3 className="reopen-section-title">Liste des Super Cost annulés</h3>

      {cancelledSupercosts.length === 0 ? (
        <p className="items-cost-empty">Aucun Super Cost annulé.</p>
      ) : (
        <div className="items-cost-table-container">
          <table className="items-cost-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th style={{ textAlign: 'center' }}>Batch (place)</th>
                <th>Items concernés</th>
                <th style={{ textAlign: 'right' }}>Montant</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cancelledSupercosts.map(s => (
                <tr key={`cancelled-${s.ticketId}-${s.batch}`}>
                  <td className="items-cost-itemtype">
                    #{s.ticketId} — {ticketNames.get(s.ticketId) ?? `Ticket #${s.ticketId}`}
                  </td>
                  <td style={{ textAlign: 'center' }}>{s.batch}</td>
                  <td>
                    {s.items.map((it, j) => (
                      <div key={j} className="items-cost-ticket-line">
                        {it.itemtype} (item #{it.items_id}) — {fmt(it.amount)}
                      </div>
                    ))}
                  </td>
                  <td className="items-cost-amount total">{fmt(s.total)}</td>
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button
                      className="reopen-btn reopen-btn-edit"
                      onClick={() => void restoreSuperCost(s)}
                      title="Rétablir ce Super Cost à sa place d'origine"
                    >
                      <i className="bi bi-arrow-counterclockwise" /> Rétablir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {edit && (
        <div className="reopen-overlay" onClick={() => { if (!edit.saving) setEdit(null) }}>
          <div className="reopen-modal" onClick={e => e.stopPropagation()}>
            <h3>Modifier la réouverture #{edit.group}</h3>
            <p className="reopen-modal-hint">Seuls le pourcentage et le mode peuvent être modifiés. Les frais sont recalculés après validation.</p>

            <label className="reopen-field">
              <span>Mode de calcul (base Super Cost)</span>
              <select
                value={edit.mode}
                onChange={e => setEdit({ ...edit, mode: Number(e.target.value) })}
                disabled={edit.saving}
              >
                {MODE_OPTIONS.map(m => (
                  <option key={m} value={m}>{m} — {MODE_LABEL[m]}</option>
                ))}
              </select>
            </label>

            <label className="reopen-field">
              <span>Pourcentage (%)</span>
              <input
                type="number"
                step="0.01"
                value={edit.percent}
                onChange={e => setEdit({ ...edit, percent: e.target.value })}
                disabled={edit.saving}
                autoFocus
              />
            </label>

            <div className="reopen-modal-actions">
              <button className="reopen-btn" onClick={() => setEdit(null)} disabled={edit.saving}>
                Annuler
              </button>
              <button
                className="reopen-btn reopen-btn-edit"
                onClick={() => void saveEdit()}
                disabled={edit.saving || edit.percent.trim() === '' || isNaN(parseFloat(edit.percent))}
              >
                {edit.saving ? 'Enregistrement...' : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}

      {superEdit && (
        <div className="reopen-overlay" onClick={() => { if (!superEdit.saving) setSuperEdit(null) }}>
          <div className="reopen-modal" onClick={e => e.stopPropagation()}>
            <h3>Modifier le Super Cost (ticket #{superEdit.ticketId}, batch {superEdit.batch})</h3>
            <p className="reopen-modal-hint">Le montant saisi sera réparti à parts égales entre les items du Super Cost.</p>

            <label className="reopen-field">
              <span>Montant (€)</span>
              <input
                type="number"
                step="0.01"
                value={superEdit.amount}
                onChange={e => setSuperEdit({ ...superEdit, amount: e.target.value })}
                disabled={superEdit.saving}
                autoFocus
              />
            </label>

            <div className="reopen-modal-actions">
              <button className="reopen-btn" onClick={() => setSuperEdit(null)} disabled={superEdit.saving}>
                Annuler
              </button>
              <button
                className="reopen-btn reopen-btn-edit"
                onClick={() => void saveSuperEdit()}
                disabled={superEdit.saving || superEdit.amount.trim() === '' || isNaN(parseFloat(superEdit.amount))}
              >
                {superEdit.saving ? 'Enregistrement...' : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
