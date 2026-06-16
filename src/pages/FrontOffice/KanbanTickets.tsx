import { useState, useEffect, useCallback, useRef } from 'react'
import type { FormEvent } from 'react'
import { glpiTicketService } from '@/services/glpiService'
import type { GlpiTicket, TicketDetail as TicketDetailType } from '@/types/glpi'
import { useSettings } from '@/hooks/useKanbanSetting'
import { ItemSuperCostApi } from '@/api/itemSuperCost'
import './KanbanTickets.css'

// ─── Status mapping ────────────────────────────────────────────────────────────

type ColKey = 'new' | 'progress' | 'closed'

const COLUMNS: { key: ColKey; label: string; cls: string }[] = [
  { key: 'new',      label: 'New',         cls: 'kb-col-new'      },
  { key: 'progress', label: 'In Progress', cls: 'kb-col-progress' },
  { key: 'closed',   label: 'Closed',      cls: 'kb-col-closed'   },
]

const NEW_STATUSES      = [1, 'new',     '1']
const PROGRESS_STATUSES = [2, 3, 4, 'open', 'pending', '2', '3', '4']
const CLOSED_STATUSES   = [5, 6, 'solved', 'closed', '5', '6']

const getColKey = (status: string | number): ColKey => {
  if (NEW_STATUSES.includes(status as never))      return 'new'
  if (PROGRESS_STATUSES.includes(status as never)) return 'progress'
  if (CLOSED_STATUSES.includes(status as never))   return 'closed'
  return 'new'
}

const getTargetStatus = (toCol: ColKey, currentStatus: string | number): number => {
  if (toCol === 'new') return 1
  if (toCol === 'closed') return 5
  // In Progress: keep status 2 or 4 if already there, otherwise set to 2
  const n = typeof currentStatus === 'number' ? currentStatus : parseInt(currentStatus as string, 10)
  return n === 2 || n === 4 ? n : 2
}

// ─── Display helpers ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<number, string> = {
  1: 'Nouveau', 2: 'En cours (assigné)', 3: 'Planifié', 4: 'En attente', 5: 'Résolu', 6: 'Clos',
}

const PRIORITY_LABELS: Record<number, string> = {
  1: 'Très basse', 2: 'Basse', 3: 'Moyenne', 4: 'Haute', 5: 'Très haute', 6: 'Majeure',
}

const toNum = (v: string | number | undefined): number =>
  typeof v === 'number' ? v : parseInt(v as string, 10) || 0

const statusLabel  = (s: string | number) => STATUS_LABELS[toNum(s)]   || String(s)
const priorityLabel = (p: string | number) => PRIORITY_LABELS[toNum(p)] || String(p)

const priorityCls = (p: string | number) => {
  const n = toNum(p)
  if (n >= 4) return 'kb-prio-high'
  if (n === 3) return 'kb-prio-medium'
  return 'kb-prio-low'
}

// ─── Asset type ────────────────────────────────────────────────────────────────

interface Asset { id: number; itemtype: string; name: string; serial: string; otherserial: string }

// ─── Component ─────────────────────────────────────────────────────────────────

export const KanbanTickets = () => {
  // Tickets data
  const [tickets,  setTickets]  = useState<GlpiTicket[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  // Drag & Drop
  const draggingRef = useRef<number | null>(null)
  const [draggingId,  setDraggingId]  = useState<number | null>(null)
  const [dragOverCol, setDragOverCol] = useState<ColKey | null>(null)

  // Ticket detail modal
  const [detailId,      setDetailId]      = useState<number | null>(null)
  const [detailTicket,  setDetailTicket]  = useState<TicketDetailType | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Create ticket modal
  const [showCreate, setShowCreate] = useState(false)
  const [ctTitle,    setCtTitle]    = useState('')
  const [ctDesc,     setCtDesc]     = useState('')
  const [ctUrgency,  setCtUrgency]  = useState(3)
  const [ctType,     setCtType]     = useState(1)
  const [ctSaving,   setCtSaving]   = useState(false)
  const [ctError,    setCtError]    = useState<string | null>(null)
  const [ctSuccess,  setCtSuccess]  = useState(false)
  const [ctSearchQ,  setCtSearchQ]  = useState('')
  const [ctResults,  setCtResults]  = useState<Asset[]>([])
  const [ctSearching,setCtSearching]= useState(false)
  const [ctAssets,   setCtAssets]   = useState<Asset[]>([])

  // Close dialog
  const [closeDialog, setCloseDialog] = useState<{ ticketId: number } | null>(null)
  const [closeNote,   setCloseNote]   = useState('')
  const [superCost,   setSuperCost]   = useState('')
  const [closeSaving, setCloseSaving] = useState(false)

  // Reopen dialog (closed → in progress)
  const [reopenDialog,  setReopenDialog]  = useState<{ ticketId: number; prevStatus: string | number; previousSuperCost: number } | null>(null)
  const [reopenPct,     setReopenPct]     = useState('')
  const [reopenMode,    setReopenMode]    = useState(1)
  const [reopenSaving,  setReopenSaving]  = useState(false)

  const { settings, loading: settingsLoading } = useSettings()
  const [useMalagasy, setUseMalagasy] = useState(false)
  // ── Load tickets ──────────────────────────────────────────────────────────────
  const loadTickets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await glpiTicketService.listTickets()
      setTickets(data || [])
    } catch (err) {
      console.error('Failed to load tickets:', err)
      setError('Impossible de charger les tickets.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { 
    void loadTickets() 
  }, [loadTickets])

  // ── Ticket detail ─────────────────────────────────────────────────────────────
  const openDetail = async (id: number) => {
    setDetailId(id)
    setDetailTicket(null)
    setDetailLoading(true)
    try {
      const [t, solution] = await Promise.all([
        glpiTicketService.getTicket(id),
        glpiTicketService.getTicketSolution(id),
      ])
      setDetailTicket({ ...t, solution: solution ?? t.solution })
    } catch (err) {
      console.error('Failed to load ticket detail:', err)
      setError('Impossible de charger les détails du ticket.')
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => { 
    setDetailId(null)
    setDetailTicket(null)
  }

  // ── Drag & Drop ───────────────────────────────────────────────────────────────
  const handleDragStart = (id: number) => {
    draggingRef.current = id
    setDraggingId(id)
  }

  const handleDragEnd = () => {
    draggingRef.current = null
    setDraggingId(null)
    setDragOverCol(null)
  }

  const handleDragOver = (e: React.DragEvent, col: ColKey) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverCol !== col) setDragOverCol(col)
  }

  const handleDrop = async (e: React.DragEvent, toCol: ColKey) => {
    e.preventDefault()
    setDragOverCol(null)

    const id = draggingRef.current
    draggingRef.current = null
    setDraggingId(null)
    
    if (!id) return

    const ticket = tickets.find(t => t.id === id)
    if (!ticket) return

    const fromCol = getColKey(ticket.status)
    if (fromCol === toCol) return

    if (toCol === 'closed') {
      setCloseDialog({ ticketId: id })
      return
    }

    if (fromCol === 'closed' && toCol === 'progress') {
      const prevSuperCost = await ItemSuperCostApi.getLastBatchTotal(id).catch(() => 0)
      setReopenDialog({ ticketId: id, prevStatus: ticket.status, previousSuperCost: prevSuperCost })
      return
    }

    const newStatus = getTargetStatus(toCol, ticket.status)
    
    // Optimistic update
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
    
    try {
      await glpiTicketService.updateTicket(id, { status: newStatus })
    } catch (err) {
      console.error('Failed to update ticket:', err)
      // Rollback on error
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status: ticket.status } : t))
      setError('Erreur lors du déplacement du ticket.')
    }
  }

  // ── Confirm close ─────────────────────────────────────────────────────────────
  const handleConfirmClose = async () => {
    if (!closeDialog) return
    
    setCloseSaving(true)
    const { ticketId } = closeDialog

    const originalTicket = tickets.find(t => t.id === ticketId)
    
    // Optimistic update
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 5 } : t))

    try {
      if (closeNote.trim()) {
        // Solution EN PREMIER — GLPI passe le ticket en Résolu automatiquement
        await glpiTicketService.createSolution(ticketId, closeNote.trim())
      } else {
        await glpiTicketService.updateTicket(ticketId, { status: 5 })
      }

      // Sauvegarder le supercost dans les tables dédiées (réparti par item tracké)
      const superCostValue = parseFloat(superCost)
      if (!isNaN(superCostValue) && superCostValue > 0) {
        try {
          const linkedItems = await glpiTicketService.getTicketLinkedItems(ticketId)
          const { saved } = await ItemSuperCostApi.addSuperCost(ticketId, superCostValue, linkedItems)
          if (saved === 0) {
            setError('Attention : aucun équipement suivi (Computer, Monitor, Phone) lié — coût non enregistré.')
          }
        } catch (costErr) {
          console.error('Failed to save super cost:', costErr)
        }
      }

      setCloseDialog(null)
      setCloseNote('')
      setSuperCost('')
    } catch (err) {
      console.error('Failed to close ticket:', err)
      if (originalTicket) {
        setTickets(prev => prev.map(t => t.id === ticketId ? originalTicket : t))
      }
      setError('Erreur lors de la clôture du ticket.')
    } finally {
      setCloseSaving(false)
    }
  }

  const cancelCloseDialog = () => {
    setCloseDialog(null)
    setCloseNote('')
    setSuperCost('')
  }

  const cancelReopenDialog = () => {
    setReopenDialog(null)
    setReopenPct('')
    setReopenMode(1)
  }

  const handleReopenAnnulation = async () => {
    if (!reopenDialog) return
    setReopenSaving(true)
    const { ticketId, prevStatus } = reopenDialog
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 2 } : t))
    try {
      await glpiTicketService.updateTicket(ticketId, { status: 2 })
      // Supprime le dernier batch de supercost (ne touche pas les reopen costs)
      await ItemSuperCostApi.cancelLastBatch(ticketId)
      setReopenDialog(null)
      setReopenPct('')
    } catch (err) {
      console.error('Failed to reopen ticket:', err)
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: prevStatus } : t))
      setError('Erreur lors de la réouverture du ticket.')
    } finally {
      setReopenSaving(false)
    }
  }

  const handleReopenWithPct = async () => {
    if (!reopenDialog) return
    const pct = parseFloat(reopenPct)
    if (isNaN(pct) || pct < 0) return
    setReopenSaving(true)
    const { ticketId, prevStatus } = reopenDialog
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 2 } : t))
    try {
      await glpiTicketService.updateTicket(ticketId, { status: 2 })
      // Le backend calcule pct% de la base Supercost choisie (mode) et stocke dans ticket_reopen_costs
      await ItemSuperCostApi.addReopenCost(ticketId, pct, reopenMode)
      setReopenDialog(null)
      setReopenPct('')
      setReopenMode(1)
    } catch (err) {
      console.error('Failed to reopen ticket with cost:', err)
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: prevStatus } : t))
      setError('Erreur lors de la réouverture du ticket.')
    } finally {
      setReopenSaving(false)
    }
  }

  // ── Create ticket ─────────────────────────────────────────────────────────────
  const handleCtSearch = async () => {
    if (!ctSearchQ.trim()) return
    
    setCtSearching(true)
    setCtError(null)
    try {
      const results = await glpiTicketService.searchAssets(ctSearchQ)
      setCtResults(results)
    } catch (err) {
      console.error('Failed to search assets:', err)
      setCtError('Erreur lors de la recherche d\'équipements.')
      setCtResults([])
    } finally {
      setCtSearching(false)
    }
  }

  const addCtAsset = (a: Asset) => {
    if (!ctAssets.find(x => x.id === a.id && x.itemtype === a.itemtype)) {
      setCtAssets(prev => [...prev, a])
    }
    setCtResults([])
    setCtSearchQ('')
  }

  const removeCtAsset = (a: Asset) => {
    setCtAssets(prev => prev.filter(x => !(x.id === a.id && x.itemtype === a.itemtype)))
  }

  const resetCreateForm = () => {
    setCtTitle('')
    setCtDesc('')
    setCtUrgency(3)
    setCtType(1)
    setCtAssets([])
    setCtResults([])
    setCtSearchQ('')
    setCtError(null)
    setCtSuccess(false)
  }

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    if (!ctTitle.trim()) {
      setCtError('Le titre est requis.')
      return
    }
    if (!ctDesc.trim()) {
      setCtError('La description est requise.')
      return
    }
    
    setCtSaving(true)
    setCtError(null)
    
    try {
      const res = await glpiTicketService.createTicket({ 
        name: ctTitle.trim(), 
        content: ctDesc.trim(), 
        urgency: ctUrgency, 
        type: ctType 
      })
      
      if (res?.id) {
        // Associate assets
        for (const asset of ctAssets) {
          try {
            await glpiTicketService.associateItemToTicket(res.id, asset.itemtype, asset.id)
          } catch (err) {
            console.error(`Failed to associate asset ${asset.id}:`, err)
          }
        }
        
        setCtSuccess(true)
        await loadTickets()
        
        setTimeout(() => { 
          setShowCreate(false)
          resetCreateForm()
        }, 1500)
      } else {
        setCtError('Erreur lors de la création du ticket.')
      }
    } catch (err: unknown) {
      console.error('Failed to create ticket:', err)
      setCtError(err instanceof Error ? err.message : 'Erreur inconnue lors de la création du ticket.')
    } finally {
      setCtSaving(false)
    }
  }

  // Helper to get column configuration
  // Helper to get column configuration with language toggle
const getColumnConfig = () => {
  if (!settings) {
    return [
      { key: 'new', label: 'New', cls: 'kb-col-new', color: '#4caf50' },
      { key: 'progress', label: 'In Progress', cls: 'kb-col-progress', color: '#2196f3' },
      { key: 'closed', label: 'Closed', cls: 'kb-col-closed', color: '#9e9e9e' }
    ]
  }
  
  // Choix des libellés selon la langue
  const labels = {
    // Si useMalagasy = true → utilise les valeurs de la base (malgache)
    // Si useMalagasy = false → utilise les valeurs originales (anglais)
    new: useMalagasy ? (settings.status_name_new || 'Vaovao') : 'New',
    progress: useMalagasy ? (settings.status_name_in_progress || 'Efa manao') : 'In Progress',
    closed: useMalagasy ? (settings.status_name_done || 'Vita') : 'Closed'
  }
  
  return [
    { key: 'new', label: labels.new, cls: 'kb-col-new', color: settings.kanban_color_new || '#4caf50' },
    { key: 'progress', label: labels.progress, cls: 'kb-col-progress', color: settings.kanban_color_in_progress || '#2196f3' },
    { key: 'closed', label: labels.closed, cls: 'kb-col-closed', color: settings.kanban_color_done || '#9e9e9e' }
  ]
}
  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="kb-page">

      {/* Header */}
      <div className="kb-header">
        <h2 className="kb-title">Tickets — Vue Kanban</h2>
            <button 
      className={`kb-lang-btn ${useMalagasy ? 'active' : ''}`}
      onClick={() => setUseMalagasy(!useMalagasy)}
      title={useMalagasy ? "Afficher en français" : "Afficher en malgache"}
    >
      <i className="bi bi-translate"></i>
      {useMalagasy ? '🇲🇬 Malagasy' : 'Original'}
    </button>
        <button 
          className="kb-refresh-btn" 
          onClick={() => void loadTickets()} 
          disabled={loading} 
          title="Rafraîchir"
        >
          <i className={`bi bi-arrow-clockwise${loading ? ' kb-spin' : ''}`} />
          Rafraîchir
        </button>
      </div>

      {error && (
        <div className="kb-error">
          <i className="bi bi-exclamation-triangle" /> 
          {error}
          <button onClick={() => setError(null)} className="kb-error-close">×</button>
        </div>
      )}

      {(loading || settingsLoading) ? (
        <div className="kb-loading">
          <div className="kb-ring" /> 
          Chargement des tickets...
        </div>
      ) : (
        <div className="kb-board">
          {getColumnConfig().map(col => {
            const colTickets = tickets.filter(t => getColKey(t.status) === col.key as ColKey)
            const isOver = dragOverCol === col.key && draggingId !== null

            return (
              <div
                key={col.key}
                className={`kb-col ${col.cls}${isOver ? ' kb-col-over' : ''}`}
                style={{ backgroundColor: col.color + '20' }}
                onDragOver={e => handleDragOver(e, col.key as ColKey)}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={e => void handleDrop(e, col.key as ColKey)}
              >
                {/* Column header */}
                <div className="kb-col-header">
                  <span className="kb-col-title" style={{ color: col.color }}>
                    {col.label}
                  </span>
                  <span className="kb-col-count" style={{ backgroundColor: col.color + '40' }}>
                    {colTickets.length}
                  </span>
                </div>

                {/* Drop zone hint */}
                {isOver && (
                  <div className="kb-drop-hint">
                    Déposer ici
                  </div>
                )}

                {/* Empty state */}
                {colTickets.length === 0 && !isOver && (
                  <div className="kb-empty">
                    <i className="bi bi-inbox" />
                    <span>Aucun ticket</span>
                  </div>
                )}

                {/* Cards */}
                {colTickets.map(ticket => (
                  <div
                    key={ticket.id}
                    className={`kb-card${draggingId === ticket.id ? ' kb-card-dragging' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(ticket.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => void openDetail(ticket.id)}
                  >
                    <div className="kb-card-name">
                      {ticket.name || `Ticket #${ticket.id}`}
                    </div>
                    <div className="kb-card-meta">
                      <span className="kb-card-id">#{ticket.id}</span>
                      {ticket.priority !== undefined && (
                        <span className={`kb-prio ${priorityCls(ticket.priority)}`}>
                          {priorityLabel(ticket.priority)}
                        </span>
                      )}
                    </div>
                    {ticket.requester_name && (
                      <div className="kb-card-info">
                        <i className="bi bi-person" />
                        {ticket.requester_name}
                      </div>
                    )}
                    {ticket.date && (
                      <div className="kb-card-info">
                        <i className="bi bi-calendar3" />
                        {String(ticket.date).split(' ')[0]}
                      </div>
                    )}
                    {ticket.category && (
                      <div className="kb-card-info">
                        <i className="bi bi-tag" />
                        {ticket.category}
                      </div>
                    )}
                    <div className="kb-card-drag-handle" title="Glisser pour déplacer">
                      <i className="bi bi-grip-vertical" />
                    </div>
                  </div>
                ))}

                {/* Add button — only on New column */}
                {col.key === 'new' && (
                 
                  <a href="/create-ticket" className="kb-add-btn">
                    <i className="bi bi-plus-circle" /> Ajouter un ticket
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Close Dialog ─────────────────────────────────────────────────────── */}
      {closeDialog && (
        <div className="kb-overlay" onClick={() => { if (!closeSaving) cancelCloseDialog() }}>
          <div className="kb-dialog" onClick={e => e.stopPropagation()}>
            <div className="kb-dialog-header">
              <i className="bi bi-check-circle" />
              <h3>Clôturer le ticket #{closeDialog.ticketId}</h3>
            </div>
            <p className="kb-dialog-desc">
              Ce ticket sera marqué comme <strong>Résolu</strong> dans GLPI.
              Vous pouvez saisir une note de résolution et le coût associé (facultatifs).
            </p>
            <div className="kb-field">
              <label>Note de résolution</label>
              <textarea
                value={closeNote}
                onChange={e => setCloseNote(e.target.value)}
                placeholder="Décrivez la solution apportée…"
                rows={4}
                disabled={closeSaving}
              />
            </div>
            <div className="kb-field">
              <label>Super Cost (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={superCost}
                onChange={e => setSuperCost(e.target.value)}
                placeholder="Ex : 150.00"
                disabled={closeSaving}
              />
            </div>
            <div className="kb-dialog-actions">
              <button
                className="kb-btn-secondary"
                onClick={cancelCloseDialog}
                disabled={closeSaving}
              >
                Annuler
              </button>
              <button
                className="kb-btn-primary"
                onClick={() => void handleConfirmClose()}
                disabled={closeSaving}
              >
                {closeSaving ? (
                  <><i className="bi bi-arrow-repeat kb-spin" /> Enregistrement…</>
                ) : (
                  'Confirmer la clôture'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reopen Dialog (closed → in progress) ────────────────────────────── */}
      {reopenDialog && (
        <div className="kb-overlay" onClick={() => { if (!reopenSaving) cancelReopenDialog() }}>
          <div className="kb-dialog" onClick={e => e.stopPropagation()}>
            <div className="kb-dialog-header">
              <i className="bi bi-arrow-counterclockwise" style={{ color: '#f59e0b' }} />
              <h3>Réouverture du ticket #{reopenDialog.ticketId}</h3>
            </div>
            <p className="kb-dialog-desc">
              Ce ticket était <strong>Clôturé</strong>. Il va revenir en <strong>In Progress</strong>.
              Choisissez comment gérer le Super Cost associé.
            </p>
            {reopenDialog.previousSuperCost > 0 && (
              <p className="kb-dialog-desc">
                Super Cost précédent :{' '}
                <strong style={{ color: '#1e293b' }}>
                  {reopenDialog.previousSuperCost.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </strong>
              </p>
            )}
            <div className="kb-field">
              <label>Mode de calcul de la base Super Cost</label>
              <select
                value={reopenMode}
                onChange={e => setReopenMode(Number(e.target.value))}
                disabled={reopenSaving}
              >
                <option value={1}>1 — Dernier Super Cost</option>
                <option value={2}>2 — Premier Super Cost</option>
                <option value={3}>3 — Moyenne des Super Cost</option>
                <option value={4}>4 — Somme des Super Cost</option>
              </select>
            </div>
            <div className="kb-field">
              <label>% Réouverture (calcul sur la base Super Cost choisie)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={reopenPct}
                onChange={e => setReopenPct(e.target.value)}
                placeholder="Ex : 50 → 50% de la base choisie"
                disabled={reopenSaving}
              />
              {reopenMode === 1 && reopenPct !== '' && !isNaN(parseFloat(reopenPct)) && (
                <small style={{ color: '#64748b', marginTop: 4, display: 'block' }}>
                  Frais de réouverture :{' '}
                  <strong>
                    {(reopenDialog.previousSuperCost * parseFloat(reopenPct) / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                  </strong>
                  {' '}(le Super Cost de base reste inchangé)
                </small>
              )}
              {reopenMode !== 1 && (
                <small style={{ color: '#64748b', marginTop: 4, display: 'block' }}>
                  Le montant exact est calculé côté serveur selon le mode {reopenMode}.
                </small>
              )}
            </div>
            <div className="kb-dialog-actions">
              <button
                className="kb-btn-secondary"
                onClick={cancelReopenDialog}
                disabled={reopenSaving}
              >
                Fermer
              </button>
              <button
                className="kb-btn-warning"
                onClick={() => void handleReopenAnnulation()}
                disabled={reopenSaving}
                title="Remet le ticket en cours et efface le Super Cost"
              >
                {reopenSaving
                  ? <><i className="bi bi-arrow-repeat kb-spin" /> Traitement…</>
                  : 'Annulation (effacer le coût)'}
              </button>
              <button
                className="kb-btn-primary"
                onClick={() => void handleReopenWithPct()}
                disabled={reopenSaving || reopenPct.trim() === '' || isNaN(parseFloat(reopenPct))}
              >
                {reopenSaving
                  ? <><i className="bi bi-arrow-repeat kb-spin" /> Traitement…</>
                  : 'Réouvrir avec ce %'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Ticket Modal ───────────────────────────────────────────────── */}
      {showCreate && (
        <div className="kb-overlay" onClick={() => { 
          if (!ctSaving) { 
            setShowCreate(false)
            resetCreateForm()
          } 
        }}>
          <div className="kb-modal" onClick={e => e.stopPropagation()}>
            <div className="kb-modal-header">
              <h3><i className="bi bi-plus-circle" /> Nouveau ticket</h3>
              <button 
                className="kb-modal-close" 
                onClick={() => { 
                  setShowCreate(false)
                  resetCreateForm()
                }}
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            {ctSuccess ? (
              <div className="kb-success">
                <i className="bi bi-check-circle-fill" />
                Ticket créé avec succès !
              </div>
            ) : (
              <form onSubmit={handleCreateSubmit} className="kb-form">
                {ctError && (
                  <div className="kb-form-error">
                    <i className="bi bi-exclamation-circle" /> {ctError}
                  </div>
                )}

                <div className="kb-field">
                  <label>Titre *</label>
                  <input
                    type="text"
                    value={ctTitle}
                    onChange={e => setCtTitle(e.target.value)}
                    placeholder="Ex : Connexion réseau impossible"
                    disabled={ctSaving}
                    required
                  />
                </div>

                <div className="kb-field">
                  <label>Description *</label>
                  <textarea
                    value={ctDesc}
                    onChange={e => setCtDesc(e.target.value)}
                    placeholder="Décrivez le problème en détail…"
                    rows={4}
                    disabled={ctSaving}
                    required
                  />
                </div>

                <div className="kb-field-row">
                  <div className="kb-field">
                    <label>Type</label>
                    <select 
                      value={ctType} 
                      onChange={e => setCtType(Number(e.target.value))}
                      disabled={ctSaving}
                    >
                      <option value={1}>Incident</option>
                      <option value={2}>Demande</option>
                    </select>
                  </div>
                  <div className="kb-field">
                    <label>Urgence</label>
                    <select 
                      value={ctUrgency} 
                      onChange={e => setCtUrgency(Number(e.target.value))}
                      disabled={ctSaving}
                    >
                      <option value={5}>Très haute</option>
                      <option value={4}>Haute</option>
                      <option value={3}>Moyenne</option>
                      <option value={2}>Basse</option>
                      <option value={1}>Très basse</option>
                    </select>
                  </div>
                </div>

                <div className="kb-field">
                  <label>Équipements associés</label>
                  <div className="kb-asset-row">
                    <input
                      type="text"
                      value={ctSearchQ}
                      onChange={e => setCtSearchQ(e.target.value)}
                      onKeyDown={e => { 
                        if (e.key === 'Enter') { 
                          e.preventDefault()
                          void handleCtSearch()
                        } 
                      }}
                      placeholder="Nom ou numéro de série…"
                      disabled={ctSaving}
                    />
                    <button 
                      type="button" 
                      className="kb-btn-search" 
                      onClick={() => void handleCtSearch()} 
                      disabled={ctSearching || !ctSearchQ.trim() || ctSaving}
                    >
                      {ctSearching ? <i className="bi bi-arrow-repeat kb-spin" /> : <i className="bi bi-search" />}
                    </button>
                  </div>
                  
                  {ctResults.length > 0 && (
                    <ul className="kb-search-results">
                      {ctResults.map(a => (
                        <li key={`${a.itemtype}-${a.id}`} onClick={() => addCtAsset(a)}>
                          <span className="kb-asset-type">{a.itemtype}</span>
                          <span>{a.name}</span>
                          {a.serial && <span className="kb-asset-serial">SN: {a.serial}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  
                  {ctAssets.length > 0 && (
                    <div className="kb-asset-tags">
                      {ctAssets.map(a => (
                        <span key={`${a.itemtype}-${a.id}`} className="kb-asset-tag">
                          {a.name}
                          <button type="button" onClick={() => removeCtAsset(a)} disabled={ctSaving}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="kb-form-actions">
                  <button 
                    type="button" 
                    className="kb-btn-secondary" 
                    onClick={() => { 
                      setShowCreate(false)
                      resetCreateForm()
                    }}
                    disabled={ctSaving}
                  >
                    Annuler
                  </button>
                  <button 
                    type="submit" 
                    className="kb-btn-primary" 
                    disabled={ctSaving}
                  >
                    {ctSaving ? (
                      <><i className="bi bi-arrow-repeat kb-spin" /> Création…</>
                    ) : (
                      'Créer le ticket'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Ticket Detail Modal ───────────────────────────────────────────────── */}
      {detailId !== null && (
        <div className="kb-overlay" onClick={closeDetail}>
          <div className="kb-detail" onClick={e => e.stopPropagation()}>
            <div className="kb-modal-header">
              <h3>Ticket #{detailId}</h3>
              <button className="kb-modal-close" onClick={closeDetail}>
                <i className="bi bi-x-lg" />
              </button>
            </div>

            {detailLoading && (
              <div className="kb-loading">
                <div className="kb-ring" /> Chargement…
              </div>
            )}

            {!detailLoading && detailTicket && (
              <div className="kb-detail-body">
                {/* Badges */}
                <div className="kb-detail-badges">
                  <span className="kb-badge kb-badge-status">
                    {statusLabel(detailTicket.status)}
                  </span>
                  {detailTicket.priority !== undefined && (
                    <span className={`kb-badge ${priorityCls(detailTicket.priority)}`}>
                      {priorityLabel(detailTicket.priority)}
                    </span>
                  )}
                  {detailTicket.type !== undefined && (
                    <span className="kb-badge kb-badge-type">
                      {toNum(detailTicket.type as string | number) === 2 ? 'Demande' : 'Incident'}
                    </span>
                  )}
                </div>

                {/* Title */}
                <h2 className="kb-detail-title">
                  {detailTicket.name || `Ticket #${detailTicket.id}`}
                </h2>

                {/* Description */}
                {(detailTicket.content || detailTicket.description) && (
                  <div className="kb-detail-section">
                    <div className="kb-section-label">
                      <i className="bi bi-file-text" /> Description
                    </div>
                    <div
                      className="kb-detail-content"
                      dangerouslySetInnerHTML={{ __html: detailTicket.content || detailTicket.description || '' }}
                    />
                  </div>
                )}

                {detailTicket.solution && (
                  <div className="kb-detail-section">
                    <div className="kb-section-label kb-section-label-solution">
                      <i className="bi bi-check2-circle" /> Solution apportée
                    </div>
                    <div
                      className="kb-solution-content"
                      dangerouslySetInnerHTML={{ __html: detailTicket.solution }}
                    />
                  </div>
                )}

                {/* Meta grid */}
                <div className="kb-meta-grid">
                  <div className="kb-meta-item">
                    <span className="kb-meta-label">Identifiant</span>
                    <span className="kb-meta-value">#{detailTicket.id}</span>
                  </div>
                  <div className="kb-meta-item">
                    <span className="kb-meta-label">Demandeur</span>
                    <span className="kb-meta-value">
                      {detailTicket.requester_name ?? detailTicket.requester?.name ?? '—'}
                    </span>
                  </div>
                  <div className="kb-meta-item">
                    <span className="kb-meta-label">Technicien assigné</span>
                    <span className="kb-meta-value">
                      {detailTicket.technician_name ?? detailTicket.technician?.name ?? '—'}
                    </span>
                  </div>
                  <div className="kb-meta-item">
                    <span className="kb-meta-label">Catégorie</span>
                    <span className="kb-meta-value">{detailTicket.category || '—'}</span>
                  </div>
                  <div className="kb-meta-item">
                    <span className="kb-meta-label">Date création</span>
                    <span className="kb-meta-value">
                      {String(detailTicket.date || '').split(' ')[0] || '—'}
                    </span>
                  </div>
                  <div className="kb-meta-item">
                    <span className="kb-meta-label">Date clôture</span>
                    <span className="kb-meta-value">{detailTicket.closedate || '—'}</span>
                  </div>
                </div>

                {/* Comments */}
                {(detailTicket.comments ?? []).length > 0 && (
                  <div className="kb-detail-section">
                    <div className="kb-section-label">
                      <i className="bi bi-chat-left-text" /> Commentaires ({detailTicket.comments!.length})
                    </div>
                    {detailTicket.comments!.map(c => (
                      <div key={c.id} className="kb-comment">
                        <p className="kb-comment-text">{c.content}</p>
                        <span className="kb-comment-meta">
                          {c.date}{c.author ? ` · ${c.author}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* History */}
                {(detailTicket.history ?? []).length > 0 && (
                  <div className="kb-detail-section">
                    <div className="kb-section-label">
                      <i className="bi bi-clock-history" /> Historique
                    </div>
                    {detailTicket.history!.map(h => (
                      <div key={h.id} className="kb-history-item">
                        <span>{h.action}</span>
                        <span className="kb-history-meta">
                          {h.date}{h.author ? ` · ${h.author}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Documents */}
                {(detailTicket.documents ?? []).length > 0 && (
                  <div className="kb-detail-section">
                    <div className="kb-section-label">
                      <i className="bi bi-paperclip" /> Documents
                    </div>
                    {detailTicket.documents!.map(d => (
                      <div key={d.id} className="kb-doc-item">
                        <i className="bi bi-file-earmark" /> {d.filename}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}