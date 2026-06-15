import { useState, useRef } from 'react'
import { ItemSuperCostApi } from '@/api/itemSuperCost'
import { glpiTicketService } from '@/services/glpiService'
import './CsvMvtImport.css'

type LigneCSV = {
  ticket: number
  mvt: string
  valeur: number | null
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
    // on rejoint tout ce qui reste après mvt pour gérer les virgules décimales (ex: 100,50)
    const valeurBrut = kolona.slice(2).join(separateur).trim().replace(',', '.')
    const valeur = valeurBrut && valeurBrut !== 'null' && valeurBrut !== '' ? parseFloat(valeurBrut) : null
    if (!isNaN(ticketId) && mvt) {
      lisitra.push({ ticket: ticketId, mvt, valeur })
    }
  }
  return lisitra
}

export const CsvMvtImport = () => {
  const [fichierChoisi, setFichierChoisi] = useState<File | null>(null)
  const [lignesCSV, setLignesCSV] = useState<LigneCSV[]>([])
  const [vokatra, setVokatra] = useState<VokatraLigne[]>([])
  const [miasa, setMiasa] = useState(false)
  const inputFichier = useRef<HTMLInputElement>(null)

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
      try {
        if (ligne.mvt === 'open') {
          if (ligne.valeur === null) {
            resultats.push({ ...ligne, status: 'skip', message: 'valeur manquante' })
            continue
          }
          await ItemSuperCostApi.addReopenCost(ligne.ticket, ligne.valeur)
          resultats.push({ ...ligne, status: 'ok', message: `réouverture ${ligne.valeur}% enregistrée` })

        } else if (ligne.mvt === 'cancel') {
          const r = await ItemSuperCostApi.cancelLastBatch(ligne.ticket)
          resultats.push({ ...ligne, status: 'ok', message: `${r.removed} batch(s) annulé(s)` })

        } else if (ligne.mvt === 'close') {
          if (ligne.valeur === null) {
            resultats.push({ ...ligne, status: 'skip', message: 'valeur manquante' })
            continue
          }
          const items = await glpiTicketService.getTicketLinkedItems(ligne.ticket)
          if (items.length === 0) {
            resultats.push({ ...ligne, status: 'skip', message: 'aucun item GLPI trouvé' })
            continue
          }
          const r = await ItemSuperCostApi.addSuperCost(ligne.ticket, ligne.valeur, items)
          resultats.push({ ...ligne, status: 'ok', message: `${r.saved} item(s) enregistré(s)` })

        } else {
          resultats.push({ ...ligne, status: 'skip', message: `mvt inconnu: ${ligne.mvt}` })
        }
      } catch (err) {
        resultats.push({ ...ligne, status: 'erreur', message: err instanceof Error ? err.message : 'erreur inconnue' })
      }
    }

    setVokatra(resultats)
    setMiasa(false)
    setFichierChoisi(null)
    setLignesCSV([])
    if (inputFichier.current) inputFichier.current.value = ''
  }

  return (
    <div className="mvt-page">
      <h2>Import CSV Mouvements</h2>
      <p>Format attendu : <strong>ticket,mvt,valeur</strong></p>
      <p>mvt possible : <strong>open</strong> (réouverture en %), <strong>cancel</strong> (annuler), <strong>close</strong> (supercost montant)</p>

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
                </tr>
              </thead>
              <tbody>
                {lignesCSV.map((l, i) => (
                  <tr key={i}>
                    <td>{l.ticket}</td>
                    <td>{l.mvt}</td>
                    <td>{l.valeur ?? 'null'}</td>
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
