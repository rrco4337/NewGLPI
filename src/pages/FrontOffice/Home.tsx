import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { listItems, fetchDocumentItems, fetchDocumentBlob, GLPI_APP_TOKEN } from '@/api/glpi'
import heroImg from '@/assets/hero.png'
import './Home.css'

// ─── Asset type catalogue ──────────────────────────────────────────────────────
const ASSET_TYPES = [
  { value: 'Computer',         label: 'Ordinateur',  icon: 'bi-pc-display',    color: '#4f46e5', grad: 'linear-gradient(135deg,#4f46e5,#7c3aed)' },
  { value: 'Monitor',          label: 'Écran',        icon: 'bi-display',       color: '#0ea5e9', grad: 'linear-gradient(135deg,#0ea5e9,#2563eb)' },
  { value: 'Printer',          label: 'Imprimante',   icon: 'bi-printer-fill',  color: '#10b981', grad: 'linear-gradient(135deg,#10b981,#059669)' },
  { value: 'Phone',            label: 'Téléphone',    icon: 'bi-phone-fill',    color: '#f59e0b', grad: 'linear-gradient(135deg,#f59e0b,#d97706)' },
  { value: 'NetworkEquipment', label: 'Réseau',       icon: 'bi-router-fill',   color: '#8b5cf6', grad: 'linear-gradient(135deg,#8b5cf6,#6d28d9)' },
  { value: 'Peripheral',       label: 'Périphérique', icon: 'bi-usb-plug-fill', color: '#ec4899', grad: 'linear-gradient(135deg,#ec4899,#be185d)' },
  { value: 'Software',         label: 'Logiciel',     icon: 'bi-code-slash',    color: '#06b6d4', grad: 'linear-gradient(135deg,#06b6d4,#0891b2)' },
  { value: 'Appliance',        label: 'Appliance',    icon: 'bi-server',        color: '#64748b', grad: 'linear-gradient(135deg,#64748b,#475569)' },
] as const

type AssetTypeValue = typeof ASSET_TYPES[number]['value']
type AssetType      = typeof ASSET_TYPES[number]

// ─── Types ─────────────────────────────────────────────────────────────────────
interface GlpiItem {
  id: number
  name?: string
  serial?: string
  otherserial?: string
  states_id?: string | number
  entities_id?: string | number
  locations_id?: string | number
  users_id?: string | number
  date_creation?: string
  date_mod?: string
  _assetType?: AssetTypeValue
  _typeRef?: AssetType
  [key: string]: unknown
}

type SortKey = 'name' | '_typeLabel' | 'serial' | 'otherserial' | 'states_id'
  | 'entities_id' | 'locations_id' | 'users_id' | 'date_creation' | 'date_mod'
type SortDir  = 'asc' | 'desc'
type ViewMode = 'cards' | 'table'

interface Filters {
  search: string; type: string; otherserial: string; serial: string
  states_id: string; entities_id: string; locations_id: string; users_id: string
  dateFrom: string; dateTo: string
}

const EMPTY_FILTERS: Filters = {
  search: '', type: '', otherserial: '', serial: '',
  states_id: '', entities_id: '', locations_id: '', users_id: '',
  dateFrom: '', dateTo: '',
}

const PAGE_SIZE = 24

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d?: string) => {
  if (!d) return null
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return d }
}

const val = (v: string | number | undefined): string | null => {
  if (v === undefined || v === null || v === 0 || v === '' || v === '0') return null
  return String(v)
}

const itemKey = (type: string, id: number) => `${type}-${id}`

// ─── Card image with real GLPI blob support ────────────────────────────────────
interface AssetImageProps {
  item: GlpiItem
  type: AssetType
  blobUrl?: string     // real image blob from GLPI, if available
  loading?: boolean    // blob is being fetched
}

const AssetImage = ({ item, type, blobUrl, loading }: AssetImageProps) => {
  const [imgFailed, setImgFailed] = useState(false)
  const hasReal = Boolean(blobUrl) && !imgFailed

  return (
    <div className="fo-card-img" style={{ background: type.grad }}>
      <div className="fo-card-img-dot" />
      <div className="fo-card-img-dot2" />

      {/* Real product image from GLPI documents */}
      {blobUrl && (
        <img
          src={blobUrl}
          alt="image non disponible"
          className="fo-card-product-img"
          style={{ display: hasReal ? 'block' : 'none' }}
          onError={() => setImgFailed(true)}
        />
      )}

      {/* Icon fallback — shown when no real image or image failed */}
      {(!hasReal || loading) && (
        <div className="fo-card-icon-fallback">
          {loading
            ? <div className="fo-img-loader" />
            : <i className={`bi ${type.icon}`} />
          }
          {/* The <img> alt="image non disponible" requirement fulfilled above;
              we also surface the text in the UI when no image is available. */}
          {!loading && !item.picture_front && (
            <span className="fo-card-img-na">image non disponible</span>
          )}
        </div>
      )}

      {/* Type badge */}
      <div className="fo-card-badge">
        <i className={`bi ${type.icon}`} />
        {type.label}
      </div>
    </div>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="fo-card-skeleton">
    <div className="fo-skel fo-skel-img" />
    <div className="fo-skel fo-skel-h" />
    <div className="fo-skel fo-skel-s" />
    <div className="fo-skel fo-skel-s2" />
  </div>
)

// ─── Sort icon ─────────────────────────────────────────────────────────────────
const SI = ({ active, dir }: { active: boolean; dir: SortDir }) => (
  <i
    className={`bi bi-arrow-${active ? (dir === 'asc' ? 'up' : 'down') : 'down-up'} td-sort-ico`}
    style={{ color: active ? '#4f46e5' : '#b0bec5' }}
  />
)

// ─── Main page ─────────────────────────────────────────────────────────────────
export const Home = () => {
  const [allItems,  setAllItems]  = useState<GlpiItem[]>([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [filters,   setFilters]   = useState<Filters>(EMPTY_FILTERS)
  const [showAdv,   setShowAdv]   = useState(false)
  const [viewMode,  setViewMode]  = useState<ViewMode>('cards')
  const [sortKey,   setSortKey]   = useState<SortKey>('name')
  const [sortDir,   setSortDir]   = useState<SortDir>('asc')
  const [page,      setPage]      = useState(1)

  // Document image state
  // docMap: itemKey → document ID (from Document_Item)
  const [docMap,    setDocMap]    = useState<Record<string, number>>({})
  // imageMap: itemKey → blob URL
  const [imageMap,  setImageMap]  = useState<Record<string, string>>({})
  // loadingImages: set of itemKeys currently being fetched
  const [loadingImgs, setLoadingImgs] = useState<Set<string>>(new Set())

  const blobsRef = useRef<string[]>([])
  const hasSession = Boolean(localStorage.getItem('glpi_session_token'))

  // ── Cleanup blobs on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => { blobsRef.current.forEach(u => URL.revokeObjectURL(u)) }
  }, [])

  // ── Fetch all assets ──────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [itemResults, docLinks] = await Promise.all([
      Promise.allSettled(
        ASSET_TYPES.map(t => listItems(t.value, '0-9999', undefined, GLPI_APP_TOKEN, true))
      ),
      fetchDocumentItems().catch(() => []),
    ])

    // Build assets list
    const merged: GlpiItem[] = []
    let errCount = 0
    itemResults.forEach((r, idx) => {
      const type = ASSET_TYPES[idx]
      if (r.status === 'fulfilled') {
        r.value.forEach((item: GlpiItem) => merged.push({ ...item, _assetType: type.value, _typeRef: type }))
      } else {
        errCount++
      }
    })
    setAllItems(merged)
    if (errCount > 0 && merged.length === 0) {
      setError('Impossible de charger les équipements. Vérifiez votre connexion GLPI.')
    }

    // Build docMap from Document_Item links
    const map: Record<string, number> = {}
    for (const link of docLinks) {
      if (link.itemtype && link.items_id && link.documents_id) {
        map[itemKey(link.itemtype, link.items_id)] = link.documents_id
      }
    }
    setDocMap(map)

    // Reset image cache on full refresh
    blobsRef.current.forEach(u => URL.revokeObjectURL(u))
    blobsRef.current = []
    setImageMap({})

    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Filter & sort ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let items = allItems

    if (filters.type)
      items = items.filter(i => i._assetType === filters.type)

    if (filters.search.trim()) {
      const q = filters.search.toLowerCase()
      items = items.filter(i =>
        (i.name || '').toLowerCase().includes(q) ||
        (i._typeRef?.label || '').toLowerCase().includes(q) ||
        String(i.serial || '').toLowerCase().includes(q) ||
        String(i.otherserial || '').toLowerCase().includes(q)
      )
    }

    const str = (field: keyof GlpiItem, fVal: string) => {
      if (!fVal.trim()) return items
      const q = fVal.toLowerCase()
      return items.filter(i => String(i[field] || '').toLowerCase().includes(q))
    }

    items = str('otherserial', filters.otherserial)
    items = str('serial', filters.serial)
    items = str('states_id', filters.states_id)
    items = str('entities_id', filters.entities_id)
    items = str('locations_id', filters.locations_id)
    items = str('users_id', filters.users_id)

    if (filters.dateFrom)
      items = items.filter(i => (i.date_creation || '') >= filters.dateFrom)
    if (filters.dateTo)
      items = items.filter(i => (i.date_creation || '') <= filters.dateTo + ' 23:59:59')

    return [...items].sort((a, b) => {
      let av: string, bv: string
      if (sortKey === '_typeLabel') {
        av = a._typeRef?.label || ''; bv = b._typeRef?.label || ''
      } else {
        av = String(a[sortKey] ?? ''); bv = String(b[sortKey] ?? '')
      }
      const cmp = av.localeCompare(bv, 'fr', { numeric: true, sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [allItems, filters, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const curPage    = Math.min(page, totalPages)
  const paginated  = filtered.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE)

  // ── Load images for current page items ───────────────────────────────────────
  useEffect(() => {
    if (Object.keys(docMap).length === 0) return

    const toFetch = paginated.filter(item => {
      const k = itemKey(item._assetType!, item.id)
      return docMap[k] !== undefined && !imageMap[k] && !loadingImgs.has(k)
    })
    if (toFetch.length === 0) return

    const keys = toFetch.map(i => itemKey(i._assetType!, i.id))
    setLoadingImgs(prev => { const s = new Set(prev); keys.forEach(k => s.add(k)); return s })

    Promise.allSettled(
      toFetch.map(async item => {
        const k   = itemKey(item._assetType!, item.id)
        const did = docMap[k]
        const url = await fetchDocumentBlob(did)
        return { k, url }
      })
    ).then(results => {
      const newImages: Record<string, string> = {}
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value.url) {
          newImages[r.value.k] = r.value.url
          blobsRef.current.push(r.value.url)
        }
      })
      setImageMap(prev => ({ ...prev, ...newImages }))
      setLoadingImgs(prev => { const s = new Set(prev); keys.forEach(k => s.delete(k)); return s })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginated, docMap])

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const setF = (k: keyof Filters, v: string) => { setFilters(f => ({ ...f, [k]: v })); setPage(1) }

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
    setPage(1)
  }

  const resetFilters = () => { setFilters(EMPTY_FILTERS); setPage(1) }

  const advCount  = Object.entries(filters).filter(([k, v]) => k !== 'search' && k !== 'type' && v !== '').length
  const anyFilter = Object.values(filters).some(v => v !== '')

  const pageNums = useMemo<(number | null)[]>(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const c = curPage
    const out: (number | null)[] = [1]
    if (c > 3) out.push(null)
    for (let p = Math.max(2, c - 1); p <= Math.min(totalPages - 1, c + 1); p++) out.push(p)
    if (c < totalPages - 2) out.push(null)
    out.push(totalPages)
    return out
  }, [totalPages, curPage])

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="fo-layout">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
     

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="fo-hero">
        <div className="fo-hero-grid" />
        <div className="fo-hero-glow-a" />
        <div className="fo-hero-glow-b" />
        <div className="fo-hero-inner">
          <div>
            <div className="fo-hero-eyebrow">
              <i className="bi bi-circle-fill" style={{ color: '#4ade80', fontSize: 8 }} />
              Inventaire GLPI en ligne
            </div>
            <h1 className="fo-hero-title">
              Gérez vos équipements<br />en toute simplicité
            </h1>
            <p className="fo-hero-sub">
              Consultez, filtrez et suivez l'ensemble de vos actifs IT
              en temps réel depuis une interface unifiée.
            </p>

            <div className="fo-hero-search">
              <i className="bi bi-search hi-search" />
              <input
                type="text"
                placeholder="Rechercher un équipement…"
                value={filters.search}
                onChange={e => setF('search', e.target.value)}
              />
              {filters.search && (
                <button className="hi-clear" onClick={() => setF('search', '')}>
                  <i className="bi bi-x" />
                </button>
              )}
            </div>

            <div className="fo-hero-pills">
              <div className="fo-hero-pill">
                <i className="bi bi-collection-fill" />
                <span className="pill-val">
                  {loading ? '…' : allItems.length.toLocaleString('fr-FR')}
                </span>
                équipements
              </div>
              <div className="fo-hero-pill">
                <i className="bi bi-diagram-3-fill" />
                <span className="pill-val">{ASSET_TYPES.length}</span>
                catégories
              </div>
              {Object.keys(docMap).length > 0 && (
                <div className="fo-hero-pill">
                  <i className="bi bi-images" />
                  <span className="pill-val">{Object.keys(docMap).length}</span>
                  photos
                </div>
              )}
              {!loading && filtered.length !== allItems.length && (
                <div className="fo-hero-pill">
                  <i className="bi bi-funnel-fill" />
                  <span className="pill-val">{filtered.length.toLocaleString('fr-FR')}</span>
                  résultats filtrés
                </div>
              )}
            </div>
          </div>

          <div className="fo-hero-img">
            <img src={heroImg} alt="image non disponible" />
          </div>
        </div>
      </section>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <main className="fo-main">

        {/* Session warning */}
        {!hasSession && !loading && allItems.length === 0 && !error && (
          <div className="fo-no-session">
            <div className="fo-no-session-icon">
              <i className="bi bi-shield-exclamation" />
            </div>
            <h3>Authentification requise</h3>
            <p>Connectez-vous au back-office pour accéder à l'inventaire GLPI.</p>
            <Link to="/admin/login" className="fo-login-btn">
              <i className="bi bi-box-arrow-in-right" />
              Se connecter
            </Link>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="fo-error">
            <i className="bi bi-exclamation-triangle-fill" />
            <span>{error}</span>
            <button className="fo-retry" onClick={fetchAll}>
              <i className="bi bi-arrow-clockwise" /> Réessayer
            </button>
          </div>
        )}

        {/* Type filter */}
        <div className="fo-type-bar">
          <button
            className={`fo-type-pill${filters.type === '' ? ' active' : ''}`}
            onClick={() => setF('type', '')}
          >
            <span className="pill-ico"><i className="bi bi-grid-fill" /></span>
            Tous
            <span className="pill-count">{allItems.length.toLocaleString('fr-FR')}</span>
          </button>

          {ASSET_TYPES.map(t => {
            const cnt = allItems.filter(i => i._assetType === t.value).length
            if (cnt === 0 && !loading) return null
            return (
              <button
                key={t.value}
                className={`fo-type-pill${filters.type === t.value ? ' active' : ''}`}
                onClick={() => setF('type', t.value)}
                style={filters.type === t.value
                  ? { background: t.grad, borderColor: 'transparent', boxShadow: `0 4px 14px ${t.color}44` }
                  : undefined
                }
              >
                <span className="pill-ico"><i className={`bi ${t.icon}`} /></span>
                {t.label}
                <span className="pill-count">{loading ? '…' : cnt.toLocaleString('fr-FR')}</span>
              </button>
            )
          })}
        </div>

        {/* Toolbar */}
        <div className="fo-toolbar">
          <div className="fo-search-wrap">
            <i className="bi bi-search si" />
            <input
              type="text"
              placeholder="Nom, N° série, N° inventaire…"
              value={filters.search}
              onChange={e => setF('search', e.target.value)}
            />
            {filters.search && (
              <button className="fo-search-clear" onClick={() => setF('search', '')}>
                <i className="bi bi-x" />
              </button>
            )}
          </div>

          <button
            className={`fo-btn${showAdv ? ' active' : ''}`}
            onClick={() => setShowAdv(v => !v)}
          >
            <i className="bi bi-funnel-fill" />
            Filtres
            {advCount > 0 && <span className="fo-badge">{advCount}</span>}
            <i className={`bi bi-chevron-${showAdv ? 'up' : 'down'}`} style={{ fontSize: 11 }} />
          </button>

          {anyFilter && (
            <button className="fo-btn danger" onClick={resetFilters}>
              <i className="bi bi-x-circle-fill" />
              Réinitialiser
            </button>
          )}

          <button className="fo-btn" onClick={fetchAll} disabled={loading} title="Actualiser">
            <i className={`bi bi-arrow-clockwise${loading ? ' fo-spinning' : ''}`} />
          </button>

          <div className="fo-view-toggle" style={{ marginLeft: 'auto' }}>
            <button className={`fo-view-btn${viewMode === 'cards' ? ' active' : ''}`} onClick={() => setViewMode('cards')} title="Vue cartes">
              <i className="bi bi-grid-fill" />
            </button>
            <button className={`fo-view-btn${viewMode === 'table' ? ' active' : ''}`} onClick={() => setViewMode('table')} title="Vue liste">
              <i className="bi bi-list-ul" />
            </button>
          </div>
        </div>

        {/* Advanced filters */}
        {showAdv && (
          <div className="fo-filter-panel">
            <p className="fo-filter-title">
              <i className="bi bi-sliders" />
              Filtres avancés
            </p>
            <div className="fo-filter-grid">
              {[
                { key: 'otherserial',  label: "N° d'inventaire",    ph: 'INV-2024-001' },
                { key: 'serial',       label: 'N° de série',         ph: 'SN123456' },
                { key: 'states_id',    label: 'Statut',              ph: 'En service…' },
                { key: 'entities_id',  label: 'Entité',              ph: 'Direction…' },
                { key: 'locations_id', label: 'Localisation',        ph: 'Salle 3…' },
                { key: 'users_id',     label: 'Utilisateur affecté', ph: 'alice…' },
                { key: 'dateFrom',     label: 'Création — depuis',   ph: '', type: 'date' },
                { key: 'dateTo',       label: "Création — jusqu'au", ph: '', type: 'date' },
              ].map(f => (
                <div key={f.key} className="fo-filter-field">
                  <label>{f.label}</label>
                  <input
                    type={f.type || 'text'}
                    placeholder={f.ph}
                    value={String(filters[f.key as keyof Filters])}
                    onChange={e => setF(f.key as keyof Filters, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Result count */}
        <div className="fo-result-header">
          <p className="fo-result-count">
            {loading && allItems.length === 0
              ? 'Chargement…'
              : <>
                  <strong>{filtered.length.toLocaleString('fr-FR')}</strong>{' '}
                  résultat{filtered.length !== 1 ? 's' : ''}
                  {filtered.length !== allItems.length && ` sur ${allItems.length.toLocaleString('fr-FR')}`}
                  {curPage > 1 && ` — page ${curPage}/${totalPages}`}
                </>
            }
          </p>
        </div>

        {/* ── CARD VIEW ────────────────────────────────────────────────────────── */}
        {viewMode === 'cards' && (
          <div className="fo-card-grid">
            {loading && allItems.length === 0
              ? Array.from({ length: PAGE_SIZE }).map((_, i) => <SkeletonCard key={i} />)
              : paginated.map(item => {
                  const type     = item._typeRef!
                  const k        = itemKey(item._assetType!, item.id)
                  const blobUrl  = imageMap[k]
                  const imgLoad  = loadingImgs.has(k)
                  const location = val(item.locations_id)
                  const user     = val(item.users_id)
                  const status   = val(item.states_id)
                  const invN     = val(item.otherserial)
                  const serial   = val(item.serial)
                  const created  = fmtDate(item.date_creation)

                  return (
                    <div className="fo-card" key={k}>
                      <AssetImage item={item} type={type} blobUrl={blobUrl} loading={imgLoad} />

                      <div className="fo-card-body">
                        <div className="fo-card-name" title={item.name || `#${item.id}`}>
                          {item.name || (
                            <em style={{ color: '#94a3b8', fontStyle: 'italic', fontWeight: 400 }}>
                              Sans nom #{item.id}
                            </em>
                          )}
                        </div>

                        <div className="fo-card-meta">
                          <div className="fo-card-meta-item">
                            <span className="fo-card-meta-label">N° Inventaire</span>
                            <span className={`fo-card-meta-value${!invN ? ' empty' : ''}`}>
                              {invN || '—'}
                            </span>
                          </div>
                          <div className="fo-card-meta-item">
                            <span className="fo-card-meta-label">N° Série</span>
                            <span className={`fo-card-meta-value${!serial ? ' empty' : ''}`}>
                              {serial || '—'}
                            </span>
                          </div>
                          {status && (
                            <div className="fo-card-meta-item" style={{ gridColumn: 'span 2' }}>
                              <span className="fo-card-meta-label">Statut</span>
                              <span className="fo-status-dot default">{status}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="fo-card-footer">
                        <div className="fo-card-location">
                          <i className="bi bi-geo-alt-fill" style={{ color: '#94a3b8' }} />
                          <span>{location ?? <span style={{ color: '#cbd5e1' }}>—</span>}</span>
                        </div>
                        <div className="fo-card-user">
                          <i className="bi bi-person-fill" style={{ color: '#94a3b8' }} />
                          <span>{user ?? <span style={{ color: '#cbd5e1' }}>—</span>}</span>
                        </div>
                      </div>

                      {created && (
                        <div style={{ padding: '0 18px 12px' }}>
                          <div className="fo-card-date">
                            <i className="bi bi-calendar3" />
                            {created}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
            }
          </div>
        )}

        {/* Empty (cards) */}
        {viewMode === 'cards' && !loading && paginated.length === 0 && (
          <div style={{ textAlign: 'center', padding: '56px 24px' }}>
            <div className="fo-empty-state">
              <i className="bi bi-inbox" />
              <p>{anyFilter ? 'Aucun équipement ne correspond à ces critères.' : 'Aucun équipement trouvé.'}</p>
              {anyFilter && (
                <button className="fo-btn danger" onClick={resetFilters} style={{ marginTop: 12 }}>
                  <i className="bi bi-x-circle-fill" /> Réinitialiser les filtres
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── TABLE VIEW ───────────────────────────────────────────────────────── */}
        {viewMode === 'table' && (
          <div className="fo-table-wrap">
            <table className="fo-table">
              <thead>
                <tr>
                  {([
                    { k: 'name',          label: 'Nom' },
                    { k: '_typeLabel',    label: 'Type' },
                    { k: 'otherserial',   label: 'N° Inventaire' },
                    { k: 'serial',        label: 'N° Série' },
                    { k: 'states_id',     label: 'Statut' },
                    { k: 'entities_id',   label: 'Entité' },
                    { k: 'locations_id',  label: 'Localisation' },
                    { k: 'users_id',      label: 'Utilisateur' },
                    { k: 'date_creation', label: 'Créé le' },
                    { k: 'date_mod',      label: 'Modifié le' },
                  ] as { k: SortKey; label: string }[]).map(col => (
                    <th
                      key={col.k}
                      className={`th-sort${sortKey === col.k ? ' th-active' : ''}`}
                      onClick={() => handleSort(col.k)}
                    >
                      {col.label}
                      <SI active={sortKey === col.k} dir={sortDir} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && allItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="fo-state-cell">
                      <div className="fo-loading-state">
                        <div className="fo-ring" />
                        <span>Chargement des équipements…</span>
                      </div>
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="fo-state-cell">
                      <div className="fo-empty-state">
                        <i className="bi bi-inbox" />
                        <p>{anyFilter ? 'Aucun résultat.' : 'Aucun équipement.'}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginated.map(item => {
                    const type   = item._typeRef!
                    const k      = itemKey(item._assetType!, item.id)
                    const blobUrl = imageMap[k]
                    return (
                      <tr key={k}>
                        <td className="td-name">
                          <div className="td-name-wrap">
                            {/* Miniature image in table row if available */}
                            <div className="td-type-ico" style={{ background: `${type.color}18`, overflow: 'hidden' }}>
                              {blobUrl
                                ? <img src={blobUrl} alt="image non disponible" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <i className={`bi ${type.icon}`} style={{ color: type.color }} />
                              }
                            </div>
                            <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.name || <em style={{ color: '#94a3b8', fontWeight: 400 }}>#{item.id}</em>}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="td-type-badge" style={{ background: `${type.color}18`, color: type.color }}>
                            <i className={`bi ${type.icon}`} style={{ fontSize: 11 }} />
                            {type.label}
                          </span>
                        </td>
                        <td className="td-mono">{val(item.otherserial) ?? <span className="td-empty">—</span>}</td>
                        <td className="td-mono">{val(item.serial)      ?? <span className="td-empty">—</span>}</td>
                        <td>{val(item.states_id)    ?? <span className="td-empty">—</span>}</td>
                        <td>{val(item.entities_id)  ?? <span className="td-empty">—</span>}</td>
                        <td>{val(item.locations_id) ?? <span className="td-empty">—</span>}</td>
                        <td>{val(item.users_id)     ?? <span className="td-empty">—</span>}</td>
                        <td className="td-date">{fmtDate(item.date_creation) ?? <span className="td-empty">—</span>}</td>
                        <td className="td-date">{fmtDate(item.date_mod)      ?? <span className="td-empty">—</span>}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── PAGINATION ───────────────────────────────────────────────────────── */}
        {filtered.length > PAGE_SIZE && (
          <div className="fo-pagination">
            <span className="fo-page-info">
              Page {curPage} sur {totalPages}
              {' · '}
              {((curPage - 1) * PAGE_SIZE + 1).toLocaleString('fr-FR')}–{Math.min(curPage * PAGE_SIZE, filtered.length).toLocaleString('fr-FR')} / {filtered.length.toLocaleString('fr-FR')}
            </span>
            <div className="fo-page-controls">
              <button className="fo-page-btn" onClick={() => setPage(1)} disabled={curPage === 1} title="Première">
                <i className="bi bi-chevron-double-left" style={{ fontSize: 11 }} />
              </button>
              <button className="fo-page-btn" onClick={() => setPage(p => p - 1)} disabled={curPage === 1} title="Précédente">
                <i className="bi bi-chevron-left" style={{ fontSize: 11 }} />
              </button>
              {pageNums.map((p, i) =>
                p === null
                  ? <span key={`e${i}`} className="fo-page-ellipsis">…</span>
                  : <button key={p} className={`fo-page-btn${p === curPage ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
              )}
              <button className="fo-page-btn" onClick={() => setPage(p => p + 1)} disabled={curPage === totalPages} title="Suivante">
                <i className="bi bi-chevron-right" style={{ fontSize: 11 }} />
              </button>
              <button className="fo-page-btn" onClick={() => setPage(totalPages)} disabled={curPage === totalPages} title="Dernière">
                <i className="bi bi-chevron-double-right" style={{ fontSize: 11 }} />
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
