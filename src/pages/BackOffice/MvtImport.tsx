import { useState, useRef } from 'react'
import { ItemSuperCostApi } from '@/api/itemSuperCost'
import { glpiTicketService } from '@/services/glpiService'

interface ParsedLine {
  raw: string
  ticketId: number
  mvt: string
  valeur: string
  parseError?: string
}

interface ResultLine {
  raw: string
  ticketId: number
  mvt: string
  valeur: string
  statut: 'ok' | 'error'
  message: string
}

interface DetailItem {
  itemtype: string
  items_id: number
  supercost: number
  reopenCost: number
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

interface DetailData {
  items: DetailItem[]
  movements: Movement[]
}

const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })

const VALID_MVTS = ['open', 'close', 'cancel']

function detectSeparator(line: string): string {
  // Try underscore first (native format), then CSV separators
  for (const sep of ['_', ',', ';', '\t']) {
    const p = line.split(sep)
    if (p.length >= 2 && /^\d+$/.test(p[0].trim())) return sep
  }
  return '_'
}

function parseLine(raw: string): ParsedLine | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  // Skip header rows (e.g. "ticket,mvt,valeur")
  if (/^(ticket|id|#)/i.test(trimmed)) return null

  const sep = detectSeparator(trimmed)
  const parts = trimmed.split(sep).map(p => p.trim())

  if (parts.length < 2 || !parts[0]) {
    return { raw: trimmed, ticketId: 0, mvt: '', valeur: '', parseError: `Format invalide — utilisez: ticketId${sep}mvt${sep}valeur (ex: 2${sep}close${sep}150)` }
  }

  const ticketId = Number(parts[0])
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    return { raw: trimmed, ticketId: 0, mvt: '', valeur: '', parseError: `ID ticket invalide: "${parts[0]}"` }
  }

  const mvt = (parts[1] ?? '').toLowerCase()
  const valeur = parts.slice(2).join(sep)

  if (!VALID_MVTS.includes(mvt)) {
    return { raw: trimmed, ticketId, mvt, valeur, parseError: `Mouvement inconnu: "${mvt}" (valides: open, close, cancel)` }
  }

  return { raw: trimmed, ticketId, mvt, valeur }
}

// Codes de statut GLPI
const GLPI_STATUS = { EN_COURS: 2, RESOLU: 5, CLOS: 6 } as const

async function executeLine(line: ParsedLine): Promise<{ statut: 'ok' | 'error'; message: string }> {
  const { ticketId, mvt, valeur } = line
  try {
    if (mvt === 'cancel') {
      const [r] = await Promise.all([
        ItemSuperCostApi.cancelLastBatch(ticketId),
        glpiTicketService.updateTicket(ticketId, { status: GLPI_STATUS.EN_COURS }),
      ])
      return { statut: 'ok', message: `${r.removed} entrée(s) annulée(s) — statut → En cours` }
    }

    if (mvt === 'open') {
      const percentStr = valeur.replace('%', '').trim()
      const percent = parseFloat(percentStr)
      if (isNaN(percent) || percent < 0) {
        return { statut: 'error', message: `Pourcentage invalide: "${valeur}"` }
      }
      await Promise.all([
        ItemSuperCostApi.addReopenCost(ticketId, percent),
        glpiTicketService.updateTicket(ticketId, { status: GLPI_STATUS.EN_COURS }),
      ])
      return { statut: 'ok', message: `Réouverture: ${percent}% — statut → En cours` }
    }

    if (mvt === 'close') {
      const amount = parseFloat(valeur)
      if (isNaN(amount) || amount < 0) {
        return { statut: 'error', message: `Montant invalide: "${valeur}"` }
      }
      const items = await glpiTicketService.getTicketLinkedItems(ticketId)
      const [r] = await Promise.all([
        ItemSuperCostApi.addSuperCost(ticketId, amount, items),
        glpiTicketService.updateTicket(ticketId, { status: GLPI_STATUS.CLOS }),
      ])
      return { statut: 'ok', message: `SuperCost ${amount}€ — ${r.saved} item(s) — statut → Clos` }
    }

    return { statut: 'error', message: 'Mouvement non supporté' }
  } catch (e) {
    return { statut: 'error', message: e instanceof Error ? e.message : 'Erreur inconnue' }
  }
}

async function recordMovement(ticketId: number, mvt: string, valeur: string, statut: 'ok' | 'error', message: string) {
  await fetch('/api/ticket-movements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticketId, mvt, valeur, statut, message }),
  })
}

export const MvtImport = () => {
  const [manualTicket, setManualTicket] = useState('')
  const [manualMvt, setManualMvt] = useState('close')
  const [manualValeur, setManualValeur] = useState('')
  const [results, setResults] = useState<ResultLine[]>([])
  const [processing, setProcessing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [selectedResult, setSelectedResult] = useState<ResultLine | null>(null)
  const [detail, setDetail] = useState<DetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const handleResultClick = async (r: ResultLine) => {
    if (r.ticketId <= 0) return
    setSelectedResult(r)
    setDetailLoading(true)
    setDetail(null)
    try {
      const [scRes, mvtRes] = await Promise.all([
        fetch(`/api/item-supercosts/${r.ticketId}/detail`),
        fetch(`/api/ticket-movements/${r.ticketId}`),
      ])
      const { supercosts, reopenCosts } = await scRes.json() as {
        supercosts: { itemtype: string; items_id: number; total: number }[]
        reopenCosts: { itemtype: string; items_id: number; total: number }[]
      }
      const movements = await mvtRes.json() as Movement[]
      const map = new Map<string, DetailItem>()
      for (const s of supercosts) {
        map.set(`${s.itemtype}::${s.items_id}`, { itemtype: s.itemtype, items_id: s.items_id, supercost: s.total, reopenCost: 0 })
      }
      for (const rc of reopenCosts) {
        const k = `${rc.itemtype}::${rc.items_id}`
        const ex = map.get(k)
        if (ex) ex.reopenCost = rc.total
        else map.set(k, { itemtype: rc.itemtype, items_id: rc.items_id, supercost: 0, reopenCost: rc.total })
      }
      setDetail({ items: Array.from(map.values()), movements })
    } catch { /* ignore */ }
    setDetailLoading(false)
  }

  const processLines = async (lines: ParsedLine[]) => {
    setProcessing(true)
    const newResults: ResultLine[] = []

    for (const line of lines) {
      if (line.parseError) {
        const r: ResultLine = { ...line, statut: 'error', message: line.parseError }
        newResults.push(r)
        if (line.ticketId > 0) await recordMovement(line.ticketId, line.mvt, line.valeur, 'error', line.parseError)
        continue
      }
      const { statut, message } = await executeLine(line)
      await recordMovement(line.ticketId, line.mvt, line.valeur, statut, message)
      newResults.push({ ...line, statut, message })
    }

    setResults(prev => [...newResults, ...prev])
    setProcessing(false)
  }

  const handleManual = async () => {
    if (!manualTicket.trim()) return
   const raw = `${manualTicket}_${manualMvt}_${manualValeur}`
   const parsed = parseLine(raw)
    if (!parsed) return
    await processLines([parsed])
   setManualTicket('')
   setManualValeur('')
  }

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = (ev.target?.result as string) ?? ''
      const lines = text.split('\n').map(parseLine).filter(Boolean) as ParsedLine[]
      await processLines(lines)
      if (fileRef.current) fileRef.current.value = ''
    }
    reader.readAsText(file)
  }

  const okCount = results.filter(r => r.statut === 'ok').length
  const errCount = results.filter(r => r.statut === 'error').length

  return (
    <div style={{ padding: '24px', maxWidth: 960, margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
        Import de Mouvements
      </h2>
      <p style={{ fontSize: 13.5, color: '#64748b', marginBottom: 24 }}>
        Appliquez des mouvements (close / open / cancel) sur des tickets via import
      </p>

      {/* Manual entry */}
      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>Saisie manuelle</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>Ticket ID</label>
            <input
              type="number"
              min={1}
              value={manualTicket}
              onChange={e => setManualTicket(e.target.value)}
              placeholder="ex: 2"
              style={{ ...inputStyle, width: 100 }}
              onKeyDown={e => e.key === 'Enter' && handleManual()}
            />
          </div>
          <div>
            <label style={labelStyle}>Mouvement</label>
            <select value={manualMvt} onChange={e => setManualMvt(e.target.value)} style={{ ...inputStyle, width: 110 }}>
              <option value="close">close</option>
              <option value="open">open</option>
              <option value="cancel">cancel</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>
              Valeur{' '}
              <span style={{ color: '#94a3b8', fontWeight: 400 }}>
                {manualMvt === 'close' ? '(montant €)' : manualMvt === 'open' ? '(% du dernier batch)' : '(laissez vide)'}
              </span>
            </label>
            <input
              type="text"
              value={manualValeur}
              onChange={e => setManualValeur(e.target.value)}
              placeholder={manualMvt === 'close' ? '150' : manualMvt === 'open' ? '5%' : ''}
              disabled={manualMvt === 'cancel'}
              style={{ ...inputStyle, width: 120 }}
              onKeyDown={e => e.key === 'Enter' && handleManual()}
            />
          </div>
          <button
            onClick={handleManual}
            disabled={processing || !manualTicket.trim()}
            style={btnPrimaryStyle}
          >
            {processing ? '...' : 'Traiter'}
          </button>
        </div>
      </div> 

      {/* File import */}
      <div style={cardStyle}>
        <h3 style={cardTitleStyle}>Importation fichier</h3>
        <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8, padding: '14px 18px', marginBottom: 14, fontSize: 13 }}>
          <strong style={{ color: '#475569' }}>Format :</strong>{' '}
          <code style={{ background: '#e2e8f0', padding: '1px 6px', borderRadius: 4 }}>{'{ticketId}_{mvt}_{valeur}'}</code>
          {' — '}une ligne par mouvement
          <div style={{ marginTop: 8, display: 'flex', gap: 16 }}>
            {[['2_close_150', 'Supercost 150€'], ['2_open_5%', 'Réouverture 5%'], ['2_cancel_', 'Annuler batch']].map(([ex, desc]) => (
              <div key={ex}>
                <code style={{ background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: 4 }}>{ex}</code>
                <span style={{ color: '#64748b', marginLeft: 6 }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFileImport}
          disabled={processing}
          style={{ fontSize: 13 }}
        />
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ ...cardTitleStyle, marginBottom: 0 }}>
              Résultats —{' '}
              <span style={{ color: '#166534' }}>{okCount} OK</span>
              {errCount > 0 && <span style={{ color: '#991b1b' }}> · {errCount} erreur(s)</span>}
            </h3>
            <button
              onClick={() => setResults([])}
              style={{ fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
            >
              Effacer
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={thStyle}>Ticket</th>
                  <th style={thStyle}>Mvt</th>
                  <th style={thStyle}>Valeur</th>
                  <th style={thStyle}>Statut</th>
                  <th style={thStyle}>Message</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr
                    key={i}
                    onClick={() => r.ticketId > 0 && void handleResultClick(r)}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      cursor: r.ticketId > 0 ? 'pointer' : 'default',
                      background: selectedResult === r ? '#eef2ff' : undefined,
                      transition: 'background .12s',
                    }}
                    onMouseEnter={e => { if (r.ticketId > 0 && selectedResult !== r) (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}
                    onMouseLeave={e => { if (selectedResult !== r) (e.currentTarget as HTMLElement).style.background = '' }}
                    title={r.ticketId > 0 ? 'Voir le détail' : undefined}
                  >
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600 }}>#{r.ticketId || '—'}</span>
                      {r.ticketId > 0 && <i className="bi bi-box-arrow-up-right" style={{ marginLeft: 5, fontSize: 10, color: '#a5b4fc' }} />}
                    </td>
                    <td style={tdStyle}>
                      {r.mvt ? (
                        <span style={{ ...badgeStyle, background: MVT_COLORS[r.mvt] ?? '#e2e8f0', color: '#1e293b' }}>{r.mvt}</span>
                      ) : '—'}
                    </td>
                    <td style={{ ...tdStyle, color: '#475569' }}>{r.valeur || '—'}</td>
                    <td style={tdStyle}>
                      <span style={{
                        ...badgeStyle,
                        background: r.statut === 'ok' ? '#dcfce7' : '#fee2e2',
                        color: r.statut === 'ok' ? '#166534' : '#991b1b',
                      }}>
                        {r.statut === 'ok' ? '✓ OK' : '✗ Erreur'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: '#64748b', fontSize: 12 }}>{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {processing && (
        <div style={{ textAlign: 'center', padding: '16px', color: '#64748b', fontSize: 13 }}>
          Traitement en cours...
        </div>
      )}

      {/* ── Detail Panel ─────────────────────────────────────────────────── */}
      {selectedResult && (
        <>
          {/* Overlay */}
          <div
            onClick={() => { setSelectedResult(null); setDetail(null) }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.3)', zIndex: 40 }}
          />

          {/* Drawer */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
            background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,.12)',
            zIndex: 50, display: 'flex', flexDirection: 'column',
            fontFamily: 'system-ui, sans-serif',
          }}>
            {/* Header */}
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Détail du mouvement</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>#{selectedResult.ticketId}</span>
                  {selectedResult.mvt && (
                    <span style={{
                      background: MVT_BADGE[selectedResult.mvt]?.bg ?? '#e2e8f0',
                      color:      MVT_BADGE[selectedResult.mvt]?.fg ?? '#1e293b',
                      padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                    }}>
                      {selectedResult.mvt}
                    </span>
                  )}
                  {selectedResult.valeur && (
                    <span style={{ fontSize: 14, color: '#475569', fontWeight: 600 }}>{selectedResult.valeur}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: selectedResult.statut === 'ok' ? '#166534' : '#991b1b' }}>
                  <span style={{
                    background: selectedResult.statut === 'ok' ? '#dcfce7' : '#fee2e2',
                    padding: '1px 7px', borderRadius: 999, fontSize: 11, fontWeight: 600, marginRight: 6,
                  }}>
                    {selectedResult.statut === 'ok' ? '✓ OK' : '✗ Erreur'}
                  </span>
                  {selectedResult.message}
                </div>
              </div>
              <button
                onClick={() => { setSelectedResult(null); setDetail(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#94a3b8', lineHeight: 1, padding: '0 4px', marginLeft: 8 }}
              >×</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {detailLoading && (
                <div style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>Chargement...</div>
              )}

              {!detailLoading && detail && (
                <>
                  {/* Items affectés */}
                  {detail.items.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={sectionLabel}>Items affectés</div>
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: '#f8fafc' }}>
                              <th style={pthStyle}>Item</th>
                              <th style={{ ...pthStyle, textAlign: 'right' }}>Supercost</th>
                              <th style={{ ...pthStyle, textAlign: 'right' }}>Réouverture</th>
                              <th style={{ ...pthStyle, textAlign: 'right' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.items.map((item, i) => {
                              const total = item.supercost + item.reopenCost
                              return (
                                <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                                  <td style={ptdStyle}>
                                    <span style={{ fontWeight: 600, color: '#374151' }}>{item.itemtype}</span>
                                    <span style={{ color: '#94a3b8', marginLeft: 4, fontSize: 11 }}>#{item.items_id}</span>
                                  </td>
                                  <td style={{ ...ptdStyle, textAlign: 'right', color: item.supercost  ? '#1e40af' : '#cbd5e1' }}>{fmt(item.supercost)}</td>
                                  <td style={{ ...ptdStyle, textAlign: 'right', color: item.reopenCost ? '#854d0e' : '#cbd5e1' }}>{fmt(item.reopenCost)}</td>
                                  <td style={{ ...ptdStyle, textAlign: 'right', fontWeight: 700, color: '#b45309' }}>{fmt(total)}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                          {detail.items.length > 1 && (
                            <tfoot>
                              <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                                <td style={{ ...ptdStyle, fontWeight: 700, color: '#64748b' }}>Total</td>
                                <td style={{ ...ptdStyle, textAlign: 'right', fontWeight: 700, color: '#1e40af' }}>{fmt(detail.items.reduce((s, i) => s + i.supercost,  0))}</td>
                                <td style={{ ...ptdStyle, textAlign: 'right', fontWeight: 700, color: '#854d0e' }}>{fmt(detail.items.reduce((s, i) => s + i.reopenCost, 0))}</td>
                                <td style={{ ...ptdStyle, textAlign: 'right', fontWeight: 700, color: '#b45309' }}>{fmt(detail.items.reduce((s, i) => s + i.supercost + i.reopenCost, 0))}</td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </div>
                  )}

                  {detail.items.length === 0 && selectedResult.mvt === 'cancel' && (
                    <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: '#92400e' }}>
                      Le dernier batch a été annulé — les coûts associés ont été supprimés.
                    </div>
                  )}

                  {/* Historique des mouvements */}
                  <div style={sectionLabel}>Historique — ticket #{selectedResult.ticketId}</div>

                  {detail.movements.length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
                      Aucun mouvement enregistré
                    </div>
                  ) : detail.movements.map(m => {
                    const c = MVT_BADGE[m.mvt] ?? { bg: '#e2e8f0', fg: '#1e293b' }
                    const date = new Date(m.created_at).toLocaleString('fr-FR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })
                    const isCurrentMvt = selectedResult.message === m.message && selectedResult.mvt === m.mvt
                    return (
                      <div key={m.id} style={{
                        border: `1px solid ${isCurrentMvt ? '#a5b4fc' : '#e2e8f0'}`,
                        borderRadius: 10,
                        padding: '10px 14px',
                        marginBottom: 8,
                        background: isCurrentMvt ? '#eef2ff' : m.statut === 'error' ? '#fef2f2' : '#fafafa',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ background: c.bg, color: c.fg, padding: '1px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{m.mvt}</span>
                            {m.valeur && <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>{m.valeur}</span>}
                            {isCurrentMvt && <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 600 }}>← ce mouvement</span>}
                          </div>
                          <span style={{ fontSize: 10, color: '#94a3b8' }}>{date}</span>
                        </div>
                        <div style={{ fontSize: 11, color: m.statut === 'error' ? '#dc2626' : '#64748b' }}>
                          <span style={{
                            background: m.statut === 'ok' ? '#dcfce7' : '#fee2e2',
                            color: m.statut === 'ok' ? '#166534' : '#991b1b',
                            padding: '0 5px', borderRadius: 999, fontSize: 10, fontWeight: 600, marginRight: 5,
                          }}>
                            {m.statut === 'ok' ? '✓' : '✗'}
                          </span>
                          {m.message}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '10px 20px', borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#94a3b8' }}>
              {detail && `${detail.items.length} item(s) · ${detail.movements.length} mouvement(s)`}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const MVT_COLORS: Record<string, string> = {
  close:  '#dbeafe',
  open:   '#fef9c3',
  cancel: '#fce7f3',
}

const MVT_BADGE: Record<string, { bg: string; fg: string }> = {
  close:  { bg: '#dbeafe', fg: '#1e40af' },
  open:   { bg: '#fef9c3', fg: '#854d0e' },
  cancel: { bg: '#fce7f3', fg: '#9d174d' },
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  marginBottom: 10,
}

const pthStyle: React.CSSProperties = {
  padding: '7px 10px',
  textAlign: 'left',
  fontWeight: 700,
  color: '#64748b',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  borderBottom: '1px solid #e2e8f0',
}

const ptdStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 12,
  verticalAlign: 'middle',
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: '20px 24px',
  marginBottom: 20,
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 4px rgba(0,0,0,.05)',
}

const cardTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 16,
  marginTop: 0,
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: '#64748b',
  fontWeight: 500,
marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1.5px solid #d0d7e1',
  borderRadius: 8,
  fontSize: 13.5,
  outline: 'none',
  background: '#fff',
}

const btnPrimaryStyle: React.CSSProperties = {
  padding: '8px 22px',
  background: '#4f46e5',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 13.5,
  fontWeight: 600,
  cursor: 'pointer',
  height: 38,
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontWeight: 600,
  color: '#64748b',
  fontSize: 11.5,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

const tdStyle: React.CSSProperties = {
  padding: '9px 12px',
  verticalAlign: 'middle',
}

const badgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 9px',
  borderRadius: 999,
  fontSize: 11.5,
  fontWeight: 600,
}
