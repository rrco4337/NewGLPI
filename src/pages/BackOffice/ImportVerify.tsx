import { useState, useEffect, useCallback, useRef } from 'react'
import { GLPI_BASE_URL, GLPI_APP_TOKEN } from '@/api/glpi'
import './ImportVerify.css'

const API = `${GLPI_BASE_URL}/apirest.php`
const RANGE = '0-9999'

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = 'assets' | 'tickets' | 'costs' | 'images'

interface GlpiAsset {
  id: number
  name: string
  otherserial?: string
  states_id: string | number
  locations_id: string | number
  manufacturers_id: string | number
  computermodels_id?: string | number
  monitormodels_id?: string | number
  users_id?: string | number
  itemType: 'Computer' | 'Monitor'
}

interface GlpiTicket {
  id: number
  name: string
  content: string
  type: number
  status: number
  priority: number
  date: string
}

interface GlpiTicketCost {
  id: number
  name: string
  tickets_id: string | number
  actiontime: number
  cost: number
}

interface GlpiDocument {
  id: number
  name: string
  filename: string
  mime: string
  date_creation: string
  blobUrl?: string
  blobError?: boolean
}

interface FetchState {
  computers: GlpiAsset[]
  monitors: GlpiAsset[]
  tickets: GlpiTicket[]
  costs: GlpiTicketCost[]
  documents: GlpiDocument[]
  loading: boolean
  error: string | null
  lastFetch: Date | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const TICKET_TYPE: Record<number, string>   = { 1: 'Incident', 2: 'Demande' }
const TICKET_STATUS: Record<number, string> = { 1: 'Nouveau', 2: 'En cours (assigné)', 3: 'En cours (planifié)', 4: 'En attente', 5: 'Résolu', 6: 'Clos' }
const TICKET_PRIORITY: Record<number, string> = { 1: 'Très bas', 2: 'Bas', 3: 'Moyen', 4: 'Haut', 5: 'Très haut', 6: 'Critique' }

function fmtDuration(seconds: number): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`
}

function fmtCost(n: number): string {
  if (!n) return '—'
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

async function glpiFetch<T>(endpoint: string, token: string, label: string): Promise<T[]> {
  const url = `${API}/${endpoint}?range=${RANGE}&expand_dropdowns=true`
  console.log(`[ImportVerify] ▶ GET ${label}`, url)
  try {
    const res = await fetch(url, {
      headers: {
        'App-Token': GLPI_APP_TOKEN,
        'Session-Token': token,
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      const text = await res.text()
      console.error(`[ImportVerify] ✗ ${label} → HTTP ${res.status}:`, text)
      return []
    }
    const data = await res.json()
    console.log(`[ImportVerify] ✓ ${label} → ${Array.isArray(data) ? data.length : 0} items`, data)
    return Array.isArray(data) ? data : []
  } catch (e) {
    console.error(`[ImportVerify] ✗ ${label} → exception:`, e)
    return []
  }
}

async function fetchDocumentBlob(docId: number, token: string): Promise<string | null> {
  const url = `${API}/Document/${docId}?alt=media`
  console.log(`[ImportVerify] ▶ download doc ${docId}`, url)
  try {
    const res = await fetch(url, {
      headers: {
        'App-Token': GLPI_APP_TOKEN,
        'Session-Token': token,
      },
    })
    if (!res.ok) {
      console.warn(`[ImportVerify] ✗ doc ${docId} → HTTP ${res.status}`)
      return null
    }
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    console.log(`[ImportVerify] ✓ doc ${docId} blob URL:`, blobUrl, 'mime:', blob.type)
    return blobUrl
  } catch (e) {
    console.error(`[ImportVerify] ✗ doc ${docId} → exception:`, e)
    return null
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

const INITIAL: FetchState = {
  computers: [], monitors: [], tickets: [], costs: [], documents: [],
  loading: false, error: null, lastFetch: null,
}

export const ImportVerify = () => {
  const [state, setState]     = useState<FetchState>(INITIAL)
  const [tab, setTab]         = useState<Tab>('assets')
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const blobsRef = useRef<string[]>([])

  const getToken = () => localStorage.getItem('glpi_session_token') ?? ''

  // ── Fetch all GLPI data ──────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setState(s => ({ ...s, error: 'Session token absent — reconnectez-vous.', loading: false }))
      return
    }
    console.log('[ImportVerify] ═══ DÉBUT CHARGEMENT ═══ token:', token.slice(0, 8) + '…')
    setState(s => ({ ...s, loading: true, error: null }))

    const [rawComputers, rawMonitors, rawTickets, rawCosts, rawDocuments] = await Promise.all([
      glpiFetch<Record<string, unknown>>('Computer', token, 'Computers'),
      glpiFetch<Record<string, unknown>>('Monitor',  token, 'Monitors'),
      glpiFetch<Record<string, unknown>>('Ticket',   token, 'Tickets'),
      glpiFetch<Record<string, unknown>>('TicketCost', token, 'TicketCosts'),
      glpiFetch<Record<string, unknown>>('Document', token, 'Documents'),
    ])

    const computers: GlpiAsset[] = rawComputers.map(c => ({ ...(c as unknown as GlpiAsset), itemType: 'Computer' }))
    const monitors: GlpiAsset[]  = rawMonitors.map(m => ({ ...(m as unknown as GlpiAsset), itemType: 'Monitor' }))
    const tickets  = rawTickets  as unknown as GlpiTicket[]
    const costs    = rawCosts    as unknown as GlpiTicketCost[]
    const documents: GlpiDocument[] = (rawDocuments as unknown as GlpiDocument[]).map(d => ({ ...d, blobUrl: undefined, blobError: false }))

    console.log('[ImportVerify] ═══ RÉSUMÉ ═══', {
      computers: computers.length,
      monitors: monitors.length,
      tickets: tickets.length,
      costs: costs.length,
      documents: documents.length,
    })

    setState({ computers, monitors, tickets, costs, documents, loading: false, error: null, lastFetch: new Date() })
    setImagesLoaded(false)
  }, [])

  // ── Load image blobs when Images tab opens ──────────────────────────────────
  const loadImageBlobs = useCallback(async () => {
    if (imagesLoaded || state.documents.length === 0) return
    const token = getToken()
    if (!token) return

    console.log(`[ImportVerify] ▶ chargement de ${state.documents.length} image(s)…`)

    // Release previous blob URLs
    blobsRef.current.forEach(u => URL.revokeObjectURL(u))
    blobsRef.current = []

    const updated = await Promise.all(
      state.documents.map(async doc => {
        const blobUrl = await fetchDocumentBlob(doc.id, token)
        if (blobUrl) blobsRef.current.push(blobUrl)
        return { ...doc, blobUrl: blobUrl ?? undefined, blobError: !blobUrl }
      }),
    )

    setState(s => ({ ...s, documents: updated }))
    setImagesLoaded(true)
    console.log(`[ImportVerify] ✓ images chargées: ${updated.filter(d => d.blobUrl).length}/${updated.length}`)
  }, [imagesLoaded, state.documents])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    if (tab === 'images') loadImageBlobs()
  }, [tab, loadImageBlobs])

  // Cleanup blobs on unmount
  useEffect(() => () => { blobsRef.current.forEach(u => URL.revokeObjectURL(u)) }, [])

  // ── Counts for tab badges ────────────────────────────────────────────────────
  const assets = [...state.computers, ...state.monitors]
  const counts: Record<Tab, number> = {
    assets: assets.length,
    tickets: state.tickets.length,
    costs: state.costs.length,
    images: state.documents.length,
  }

  return (
    <div className="iv-page">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="iv-header">
        <div>
          <h1>Vérification Import GLPI</h1>
          <p>
            Données actuellement présentes dans GLPI.
            {state.lastFetch && (
              <span className="iv-lastfetch"> Mis à jour : {state.lastFetch.toLocaleTimeString('fr-FR')}</span>
            )}
          </p>
        </div>
        <button className="iv-btn-refresh" onClick={fetchAll} disabled={state.loading}>
          {state.loading
            ? <><i className="bi bi-hourglass-split" style={{ marginRight: 6 }} />Chargement…</>
            : <><i className="bi bi-arrow-repeat" style={{ marginRight: 6 }} />Actualiser</>
          }
        </button>
      </div>

      {state.error && <div className="iv-error-banner"><i className="bi bi-x-circle-fill" style={{ marginRight: 7 }} />{state.error}</div>}

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="iv-tabs">
        {(['assets', 'tickets', 'costs', 'images'] as Tab[]).map(t => (
          <button
            key={t}
            className={`iv-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'assets'  && <><i className="bi bi-pc-display" style={{ marginRight: 5 }} />Actifs</>}
            {t === 'tickets' && <><i className="bi bi-ticket-detailed-fill" style={{ marginRight: 5 }} />Tickets</>}
            {t === 'costs'   && <><i className="bi bi-currency-euro" style={{ marginRight: 5 }} />Coûts</>}
            {t === 'images'  && <><i className="bi bi-file-zip-fill" style={{ marginRight: 5 }} />Images</>}
            <span className="iv-tab-badge">{counts[t]}</span>
          </button>
        ))}
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="iv-content">

        {state.loading && (
          <div className="iv-loading">
            <div className="iv-spinner" />
            Chargement des données GLPI…
          </div>
        )}

        {!state.loading && (
          <>
            {/* ── Assets ─────────────────────────────────────────────────── */}
            {tab === 'assets' && (
              <div>
                <div className="iv-section-header">
                  <h3>Ordinateurs — {state.computers.length}</h3>
                </div>
                <AssetTable rows={state.computers} />

                <div className="iv-section-header" style={{ marginTop: '2rem' }}>
                  <h3>Moniteurs — {state.monitors.length}</h3>
                </div>
                <AssetTable rows={state.monitors} />
              </div>
            )}

            {/* ── Tickets ────────────────────────────────────────────────── */}
            {tab === 'tickets' && <TicketTable rows={state.tickets} />}

            {/* ── Costs ──────────────────────────────────────────────────── */}
            {tab === 'costs' && <CostTable rows={state.costs} />}

            {/* ── Images ─────────────────────────────────────────────────── */}
            {tab === 'images' && (
              <ImageGrid
                docs={state.documents}
                loading={!imagesLoaded && state.documents.length > 0}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function AssetTable({ rows }: { rows: GlpiAsset[] }) {
  if (rows.length === 0) return <EmptyState message="Aucun actif trouvé dans GLPI." />
  return (
    <div className="iv-table-wrap">
      <table className="iv-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nom</th>
            <th>N° inventaire</th>
            <th>Statut</th>
            <th>Localisation</th>
            <th>Fabricant</th>
            <th>Modèle</th>
            <th>Utilisateur</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={`${r.itemType}-${r.id}`}>
              <td className="iv-cell-id">{r.id}</td>
              <td className="iv-cell-name">{r.name || '—'}</td>
              <td>{r.otherserial || '—'}</td>
              <td><DropBadge value={r.states_id} /></td>
              <td><DropBadge value={r.locations_id} /></td>
              <td><DropBadge value={r.manufacturers_id} /></td>
              <td><DropBadge value={r.itemType === 'Computer' ? r.computermodels_id : r.monitormodels_id} /></td>
              <td><DropBadge value={r.users_id} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TicketTable({ rows }: { rows: GlpiTicket[] }) {
  if (rows.length === 0) return <EmptyState message="Aucun ticket trouvé dans GLPI." />
  return (
    <div className="iv-table-wrap">
      <table className="iv-table">
        <thead>
          <tr>
            <th>ID GLPI</th>
            <th>Titre</th>
            <th>Type</th>
            <th>Statut</th>
            <th>Priorité</th>
            <th>Date</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(t => (
            <tr key={t.id}>
              <td className="iv-cell-id">{t.id}</td>
              <td className="iv-cell-name">{t.name || '—'}</td>
              <td><span className="iv-badge type">{TICKET_TYPE[t.type] ?? t.type}</span></td>
              <td><StatusBadge status={t.status} /></td>
              <td><PriorityBadge priority={t.priority} /></td>
              <td className="iv-cell-date">{t.date?.slice(0, 10) || '—'}</td>
              <td className="iv-cell-desc" title={t.content}>{(t.content || '—').slice(0, 80)}{(t.content?.length ?? 0) > 80 ? '…' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CostTable({ rows }: { rows: GlpiTicketCost[] }) {
  if (rows.length === 0) return <EmptyState message="Aucun coût trouvé dans GLPI." />
  return (
    <div className="iv-table-wrap">
      <table className="iv-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nom</th>
            <th>Ticket</th>
            <th>Durée</th>
            <th>Montant</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(c => (
            <tr key={c.id}>
              <td className="iv-cell-id">{c.id}</td>
              <td>{c.name || '—'}</td>
              <td><DropBadge value={c.tickets_id} /></td>
              <td>{fmtDuration(c.actiontime)}</td>
              <td className="iv-cell-amount">{fmtCost(c.cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ImageGrid({ docs, loading }: { docs: GlpiDocument[]; loading: boolean }) {
  if (loading) return (
    <div className="iv-loading">
      <div className="iv-spinner" />
      Téléchargement des images…
    </div>
  )
  if (docs.length === 0) return <EmptyState message="Aucun document / image trouvé dans GLPI." />
  return (
    <div className="iv-image-grid">
      {docs.map(doc => (
        <div key={doc.id} className="iv-image-card">
          <div className="iv-image-wrap">
            {doc.blobUrl ? (
              <img src={doc.blobUrl} alt={doc.filename} className="iv-image" />
            ) : doc.blobError ? (
              <div className="iv-image-err"><i className="bi bi-exclamation-triangle-fill" /><br />Échec du chargement</div>
            ) : (
              <div className="iv-image-placeholder"><i className="bi bi-image" style={{ fontSize: 28, color: '#cbd5e1' }} /></div>
            )}
          </div>
          <div className="iv-image-meta">
            <span className="iv-image-name" title={doc.filename}>{doc.filename || doc.name}</span>
            <span className="iv-image-id">ID {doc.id}</span>
            <span className="iv-image-mime">{doc.mime || '?'}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Micro components ───────────────────────────────────────────────────────────

function DropBadge({ value }: { value: string | number | undefined }) {
  if (value == null || value === 0 || value === '') return <span className="iv-badge empty">—</span>
  if (typeof value === 'number') return <span className="iv-badge id">ID {value}</span>
  return <span className="iv-badge label">{value}</span>
}

function StatusBadge({ status }: { status: number }) {
  const label = TICKET_STATUS[status] ?? `Status ${status}`
  const cls = status === 6 ? 'closed' : status === 5 ? 'solved' : status === 4 ? 'pending' : 'open'
  return <span className={`iv-badge status ${cls}`}>{label}</span>
}

function PriorityBadge({ priority }: { priority: number }) {
  const label = TICKET_PRIORITY[priority] ?? `P${priority}`
  const cls = priority >= 5 ? 'high' : priority >= 3 ? 'medium' : 'low'
  return <span className={`iv-badge priority ${cls}`}>{label}</span>
}

function EmptyState({ message }: { message: string }) {
  return <div className="iv-empty">{message}</div>
}
