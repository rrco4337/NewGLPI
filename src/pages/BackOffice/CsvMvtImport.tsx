import { useState, useRef } from 'react'
import { ItemSuperCostApi } from '@/api/itemSuperCost'
import { glpiTicketService } from '@/services/glpiService'
import './CsvMvtImport.css'

const GLPI_STATUS = { EN_COURS: 2, RESOLU: 5 } as const

type LigneCSV = {
  ticket: number
  mvt: string
  valeur: number | null
  mode?: number   // 1-4, uniquement pour mvt=open (base de calcul du %)
}

type VokatraLigne = LigneCSV & {
  status: 'ok' | 'erreur' | 'skip'
  message: string
}

function parseCSV(texte: string): LigneCSV[] {
  const lignes = texte.trim().split('\n')
  const lisitra: LigneCSV[] = []
  const separateur = lignes[0]?.includes(';') ? ';' : ','
  const debut = lignes[0]?.toLowerCase().startsWith('ticket') ? 1 : 0
  for (let i = debut; i < lignes.length; i++) {
    const kolona = lignes[i].split(separateur)
    if (kolona.length < 2) continue
    const ticketId = parseInt(kolona[0]?.trim())
    const mvt = kolona[1]?.trim().toLowerCase()
    // mode = dernière colonne, uniquement pour open et seulement si valeur 1-4
    // (sinon on garde le comportement décimale "100,50" intact)
    let valeurCols = kolona.slice(2)
    let mode: number | undefined
    if (mvt === 'open' && valeurCols.length >= 2) {
      const m = parseInt(valeurCols[valeurCols.length - 1]?.trim())
      if (m >= 1 && m <= 4) {
        mode = m
        valeurCols = valeurCols.slice(0, -1)
      }
    }
    // on rejoint tout ce qui reste après mvt pour gérer les virgules décimales (ex: 100,50)
    const valeurBrut = valeurCols.join(separateur).trim().replace(',', '.')
    const valeur = valeurBrut && valeurBrut !== 'null' && valeurBrut !== '' ? parseFloat(valeurBrut) : null
    if (!isNaN(ticketId) && mvt) {
      lisitra.push({ ticket: ticketId, mvt, valeur, mode })
    }
  }
  return lisitra
}

// Fonction métier — source de vérité. Ne sait pas d'où viennent les données.
async function traiterLigne(ticket: number, mvt: string, valeur: number | null, mode?: number): Promise<VokatraLigne> {
  const base: LigneCSV = { ticket, mvt, valeur, mode }
  try {
    if (mvt === 'open') {
      if (valeur === null) return { ...base, status: 'skip', message: 'valeur manquante' }
      const modeFinal = mode ?? 1
      await ItemSuperCostApi.addReopenCost(ticket, valeur, modeFinal)
      await glpiTicketService.updateTicket(ticket, { status: GLPI_STATUS.EN_COURS })
      return { ...base, status: 'ok', message: `réouverture ${valeur}% (mode ${modeFinal}) enregistrée` }

    } else if (mvt === 'cancel') {
      const r = await ItemSuperCostApi.cancelLastBatch(ticket)
      await glpiTicketService.updateTicket(ticket, { status: GLPI_STATUS.EN_COURS })
      return { ...base, status: 'ok', message: `${r.removed} batch(s) annulé(s)` }

    } else if (mvt === 'close') {
      if (valeur === null) return { ...base, status: 'skip', message: 'valeur manquante' }
      const items = await glpiTicketService.getTicketLinkedItems(ticket)
      if (items.length === 0) return { ...base, status: 'skip', message: 'aucun item GLPI trouvé' }
      const r = await ItemSuperCostApi.addSuperCost(ticket, valeur, items)
      await glpiTicketService.updateTicket(ticket, { status: GLPI_STATUS.RESOLU })
      return { ...base, status: 'ok', message: `${r.saved} item(s) enregistré(s)` }

    } else {
      return { ...base, status: 'skip', message: `mvt inconnu: ${mvt}` }
    }
  } catch (err) {
    return { ...base, status: 'erreur', message: err instanceof Error ? err.message : 'erreur inconnue' }
  }
}

export const CsvMvtImport = () => {
  const [fichierChoisi, setFichierChoisi] = useState<File | null>(null)
  const [lignesCSV, setLignesCSV] = useState<LigneCSV[]>([])
  const [vokatra, setVokatra] = useState<VokatraLigne[]>([])
  const [miasa, setMiasa] = useState(false)
  const inputFichier = useRef<HTMLInputElement>(null)

  // Saisie manuelle
  const [manTicket, setManTicket] = useState('')
  const [manMvt, setManMvt] = useState<'open' | 'close' | 'cancel'>('close')
  const [manValeur, setManValeur] = useState('')
  const [manMode, setManMode] = useState(1)
  const [manMiasa, setManMiasa] = useState(false)

  function onChoixFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFichierChoisi(f)
    setVokatra([])
    const lecteur = new FileReader()
    lecteur.onload = (ev) => {
      const texte = ev.target?.result as string
      const lignes = parseCSV(texte)
      setLignesCSV(lignes)
    }
    lecteur.readAsText(f)
  }

  async function onImporter() {
    if (lignesCSV.length === 0) return
    setMiasa(true)
    const resultats: VokatraLigne[] = []
    for (const ligne of lignesCSV) {
      resultats.push(await traiterLigne(ligne.ticket, ligne.mvt, ligne.valeur, ligne.mode))
    }
    setVokatra(resultats)
    setMiasa(false)
    setFichierChoisi(null)
    setLignesCSV([])
    if (inputFichier.current) inputFichier.current.value = ''
  }

  async function onSaisieManuelle() {
    const ticketId = parseInt(manTicket)
    if (isNaN(ticketId)) return
    const valeur = manValeur.trim() ? parseFloat(manValeur.replace(',', '.')) : null
    setManMiasa(true)
    const resultat = await traiterLigne(ticketId, manMvt, valeur, manMvt === 'open' ? manMode : undefined)
    setVokatra(prev => [resultat, ...prev])
    setManMiasa(false)
    setManTicket('')
    setManValeur('')
  }

  return (
    <div className="mvt-page">
      <h2>Import CSV Mouvements</h2>
      <p>Format attendu : <strong>ticket,mvt,valeur,mode</strong> (mode = dernière colonne, 1-4, uniquement pour open)</p>
      <p>mvt possible : <strong>open</strong> (réouverture en %), <strong>cancel</strong> (annuler), <strong>close</strong> (supercost montant)</p>
      <p>mode (open) : <strong>1</strong>=dernier Super Cost, <strong>2</strong>=premier, <strong>3</strong>=moyenne, <strong>4</strong>=somme</p>

      {/* Saisie manuelle */}
      <div className="mvt-section">
        <h3>Saisie manuelle</h3>
        <div className="mvt-manual-row">
          <input
            type="number"
            placeholder="N° ticket"
            value={manTicket}
            onChange={e => setManTicket(e.target.value)}
          />
          <select value={manMvt} onChange={e => setManMvt(e.target.value as typeof manMvt)}>
            <option value="close">close</option>
            <option value="open">open</option>
            <option value="cancel">cancel</option>
          </select>
          <input
            type="text"
            placeholder="valeur"
            value={manValeur}
            onChange={e => setManValeur(e.target.value)}
            disabled={manMvt === 'cancel'}
          />
          {manMvt === 'open' && (
            <select value={manMode} onChange={e => setManMode(Number(e.target.value))} title="Mode de calcul (open uniquement)">
              <option value={1}>mode 1 — dernier</option>
              <option value={2}>mode 2 — premier</option>
              <option value={3}>mode 3 — moyenne</option>
              <option value={4}>mode 4 — somme</option>
            </select>
          )}
          <button className="mvt-btn" onClick={onSaisieManuelle} disabled={manMiasa || !manTicket}>
            {manMiasa ? '...' : 'Envoyer'}
          </button>
        </div>
      </div>

      {/* Import CSV */}
      <div className="mvt-file-row">
        <input ref={inputFichier} type="file" accept=".csv" onChange={onChoixFichier} />
        {fichierChoisi && <span className="mvt-file-name">{fichierChoisi.name}</span>}
      </div>

      {lignesCSV.length > 0 && (
        <div className="mvt-section">
          <h3>Aperçu — {lignesCSV.length} ligne(s)</h3>
          <div className="mvt-table-wrapper">
            <table className="mvt-table">
              <thead>
                <tr>
                  <th>ticket</th>
                  <th>mvt</th>
                  <th>valeur</th>
                  <th>mode</th>
                </tr>
              </thead>
              <tbody>
                {lignesCSV.map((l, i) => (
                  <tr key={i}>
                    <td>{l.ticket}</td>
                    <td>{l.mvt}</td>
                    <td>{l.valeur ?? 'null'}</td>
                    <td>{l.mvt === 'open' ? (l.mode ?? 1) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="mvt-btn" onClick={onImporter} disabled={miasa}>
            {miasa ? 'Import en cours...' : 'Importer'}
          </button>
        </div>
      )}

      {vokatra.length > 0 && (
        <div className="mvt-section">
          <h3>Résultats</h3>
          <div className="mvt-table-wrapper">
            <table className="mvt-table">
              <thead>
                <tr>
                  <th>ticket</th>
                  <th>mvt</th>
                  <th>valeur</th>
                  <th>mode</th>
                  <th>statut</th>
                  <th>message</th>
                </tr>
              </thead>
              <tbody>
                {vokatra.map((v, i) => (
                  <tr key={i}>
                    <td>{v.ticket}</td>
                    <td>{v.mvt}</td>
                    <td>{v.valeur ?? 'null'}</td>
                    <td>{v.mvt === 'open' ? (v.mode ?? 1) : '—'}</td>
                    <td className={`mvt-status-${v.status}`}>{v.status}</td>
                    <td>{v.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
