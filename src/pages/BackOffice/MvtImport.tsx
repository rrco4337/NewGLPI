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

async function executeLine(line: ParsedLine): Promise<{ statut: 'ok' | 'error'; message: string }> {
  const { ticketId, mvt, valeur } = line
  try {
    if (mvt === 'cancel') {
      const r = await ItemSuperCostApi.cancelLastBatch(ticketId)
      return { statut: 'ok', message: `${r.removed} entrée(s) annulée(s)` }
    }

    if (mvt === 'open') {
      const percentStr = valeur.replace('%', '').trim()
      const percent = parseFloat(percentStr)
      if (isNaN(percent) || percent < 0) {
        return { statut: 'error', message: `Pourcentage invalide: "${valeur}"` }
      }
      await ItemSuperCostApi.addReopenCost(ticketId, percent)
      return { statut: 'ok', message: `Frais de réouverture: ${percent}%` }
    }

    if (mvt === 'close') {
      const amount = parseFloat(valeur)
      if (isNaN(amount) || amount < 0) {
        return { statut: 'error', message: `Montant invalide: "${valeur}"` }
      }
      const items = await glpiTicketService.getTicketLinkedItems(ticketId)
      const r = await ItemSuperCostApi.addSuperCost(ticketId, amount, items)
      return { statut: 'ok', message: `SuperCost ${amount}€ enregistré — ${r.saved} item(s) suivi(s)` }
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
  //const [manualTicket, setManualTicket] = useState('')
  //const [manualMvt, setManualMvt] = useState('close')
  //const [manualValeur, setManualValeur] = useState('')
  const [results, setResults] = useState<ResultLine[]>([])
  const [processing, setProcessing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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

  //const handleManual = async () => {
   // if (!manualTicket.trim()) return
   // const raw = `${manualTicket}_${manualMvt}_${manualValeur}`
   // const parsed = parseLine(raw)
   // if (!parsed) return
   // await processLines([parsed])
   // setManualTicket('')
   // setManualValeur('')
  //}

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
        Appliquez des mouvements (close / open / cancel) sur des tickets via saisie manuelle ou fichier.
      </p>

      {/* Manual entry 
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
      </div> */}

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
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={tdStyle}>#{r.ticketId || '—'}</td>
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
    </div>
  )
}

const MVT_COLORS: Record<string, string> = {
  close: '#dbeafe',
  open:  '#fef9c3',
  cancel: '#fce7f3',
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

//const labelStyle: React.CSSProperties = {
  //display: 'block',
  //fontSize: 12,
  //color: '#64748b',
  //fontWeight: 500,
  //marginBottom: 4,
//}

//const inputStyle: React.CSSProperties = {
  //padding: '8px 12px',
  //border: '1.5px solid #d0d7e1',
  //borderRadius: 8,
  //fontSize: 13.5,
  //outline: 'none',
  //background: '#fff',
//}

//const btnPrimaryStyle: React.CSSProperties = {
  //padding: '8px 22px',
  //background: '#4f46e5',
  //color: '#fff',
  //border: 'none',
  //borderRadius: 8,
  //fontSize: 13.5,
  //fontWeight: 600,
  //cursor: 'pointer',
  //height: 38,
//}

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
