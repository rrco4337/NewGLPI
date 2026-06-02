import { useState, type ChangeEvent, type FormEvent } from 'react'
import {
  createComputer,
  GLPI_APP_TOKEN,
  GLPI_BASE_URL,
  testSession,
} from './api/glpi'
import { sessionTokenFromFile } from './lib/sessionToken'
import './App.css'

const initialForm = {
  assetTag: 'PC-2026-0142',
  displayName: 'Poste graphique',
  manufacturer: 'Dell',
  model: 'Precision 5680',
  serialNumber: '7H2J9-11A',
  type: 'Portable',
  status: 'En stock',
  location: 'Paris - 3e etage',
  owner: 'prenom.nom',
  purchaseDate: '',
  notes: '',
}

function App() {
  const [formData, setFormData] = useState(initialForm)
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle',
  )
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null)

  const hasToken = sessionTokenFromFile.length > 0
  const hasAppToken = GLPI_APP_TOKEN.length > 0
  const submitDisabled = submitState === 'loading' || !hasToken || !hasAppToken

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleTestConnection = async () => {
    setConnectionState('loading')
    setConnectionMessage(null)
    try {
      await testSession()
      setConnectionState('success')
      setConnectionMessage('Connexion GLPI OK')
    } catch (error) {
      setConnectionState('error')
      setConnectionMessage(
        error instanceof Error ? error.message : 'Connexion GLPI impossible',
      )
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitState('loading')
    setSubmitMessage(null)

    try {
      const response = await createComputer(formData)
      const id = response?.id ?? response?.[0]?.id
      setSubmitState('success')
      setSubmitMessage(id ? `Actif cree (#${id})` : 'Actif cree')
    } catch (error) {
      setSubmitState('error')
      setSubmitMessage(
        error instanceof Error ? error.message : 'Creation impossible',
      )
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" aria-hidden="true"></span>
          <div>
            <p className="brand-eyebrow">GLPI / Inventaire</p>
            <h1>Ajout d'ordinateur</h1>
          </div>
        </div>
        <div className="top-actions">
          <div className="connection">
            <div>
              <p className="meta-label">GLPI API</p>
              <p className="meta-value">{GLPI_BASE_URL}/apirest.php</p>
            </div>
            <div>
              <p className="meta-label">Session token</p>
              <p
                className={`meta-value ${hasToken ? 'ok' : 'warn'}`}
              >
                {hasToken ? 'charge' : 'absent'}
              </p>
            </div>
            <div>
              <p className="meta-label">App token</p>
              <p
                className={`meta-value ${hasAppToken ? 'ok' : 'warn'}`}
              >
                {hasAppToken ? 'charge' : 'absent'}
              </p>
            </div>
          </div>
          <div className="top-buttons">
            <button
              className="ghost"
              type="button"
              onClick={handleTestConnection}
              disabled={!hasToken || !hasAppToken || connectionState === 'loading'}
            >
              {connectionState === 'loading'
                ? 'Test en cours'
                : 'Tester connexion'}
            </button>
            <button className="ghost" type="button">
              Importer CSV
            </button>
          </div>
        </div>
      </header>

      {connectionMessage ? (
        <div className={`status-message ${connectionState}`} role="status">
          {connectionMessage}
        </div>
      ) : null}

      <main className="layout">
        <section className="card form-card" aria-labelledby="form-title">
          <div className="card-header">
            <div>
              <h2 id="form-title">Fiche materiel</h2>
              <p className="muted">
                Saisis les informations principales. Les champs critiques sont
                mis en avant pour un ajout rapide.
              </p>
            </div>
            <span className="status">Brouillon auto</span>
          </div>

          <form
            className="form-grid"
            autoComplete="off"
            onSubmit={handleSubmit}
          >
            <label className="field">
              Asset tag
              <input
                name="assetTag"
                placeholder="PC-2026-0142"
                value={formData.assetTag}
                onChange={handleChange}
              />
            </label>
            <label className="field">
              Nom affichage
              <input
                name="displayName"
                placeholder="Poste graphique"
                value={formData.displayName}
                onChange={handleChange}
              />
            </label>
            <label className="field">
              Fabricant
              <input
                name="manufacturer"
                placeholder="Dell"
                value={formData.manufacturer}
                onChange={handleChange}
              />
            </label>
            <label className="field">
              Modele
              <input
                name="model"
                placeholder="Precision 5680"
                value={formData.model}
                onChange={handleChange}
              />
            </label>
            <label className="field">
              Numero de serie
              <input
                name="serialNumber"
                placeholder="7H2J9-11A"
                value={formData.serialNumber}
                onChange={handleChange}
              />
            </label>
            <label className="field">
              Type
              <select name="type" value={formData.type} onChange={handleChange}>
                <option>Portable</option>
                <option>Desktop</option>
                <option>Station graphique</option>
                <option>Mini PC</option>
              </select>
            </label>
            <label className="field">
              Statut
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <option>En stock</option>
                <option>En preparation</option>
                <option>Deployee</option>
                <option>Retire</option>
              </select>
            </label>
            <label className="field">
              Localisation
              <select
                name="location"
                value={formData.location}
                onChange={handleChange}
              >
                <option>Paris - 3e etage</option>
                <option>Lyon - Atelier</option>
                <option>Remote</option>
              </select>
            </label>
            <label className="field">
              Utilisateur
              <input
                name="owner"
                placeholder="prenom.nom"
                value={formData.owner}
                onChange={handleChange}
              />
            </label>
            <label className="field">
              Date d'achat
              <input
                name="purchaseDate"
                type="date"
                value={formData.purchaseDate}
                onChange={handleChange}
              />
            </label>
            <label className="field span-2">
              Notes
              <textarea
                name="notes"
                rows={4}
                placeholder="Accessoires, garantie, configuration speciale"
                value={formData.notes}
                onChange={handleChange}
              ></textarea>
            </label>
            {submitMessage ? (
              <div className={`status-message ${submitState}`} role="status">
                {submitMessage}
              </div>
            ) : null}

            <div className="form-footer">
              <div className="hint">
                {hasToken && hasAppToken
                  ? "Pense a rattacher la fiche a un fournisseur si le materiel est encore sous garantie."
                  : 'Ajoute un session token et un app token valides pour activer la creation GLPI.'}
              </div>
              <div className="actions">
                <button className="secondary" type="button">
                  Enregistrer brouillon
                </button>
                <button className="primary" type="submit" disabled={submitDisabled}>
                  {submitState === 'loading' ? 'Creation...' : "Creer l'actif"}
                </button>
              </div>
            </div>
          </form>
        </section>

        <aside className="side">
          <section className="card summary-card" aria-labelledby="summary-title">
            <h2 id="summary-title">Resume rapide</h2>
            <div className="summary-grid">
              <div>
                <p className="summary-label">Statut</p>
                <p className="summary-value">{formData.status || 'En stock'}</p>
              </div>
              <div>
                <p className="summary-label">Type</p>
                <p className="summary-value">{formData.type || 'Portable'}</p>
              </div>
              <div>
                <p className="summary-label">Localisation</p>
                <p className="summary-value">
                  {formData.location || 'Paris - 3e etage'}
                </p>
              </div>
              <div>
                <p className="summary-label">Garantie</p>
                <p className="summary-value">36 mois</p>
              </div>
            </div>
            <div className="divider"></div>
            <p className="muted">
              L'import du token de session activera la creation directe dans
              GLPI.
            </p>
          </section>

          <section
            className="card checklist-card"
            aria-labelledby="checklist-title"
          >
            <h2 id="checklist-title">Controle rapide</h2>
            <ul className="checklist">
              <li>Verification numerique du serie</li>
              <li>Photos avant mise en service</li>
              <li>Etiquette QR imprimee</li>
              <li>Attribution utilisateur validee</li>
            </ul>
            <div className="timeline">
              <div>
                <span className="step">1</span>
                <div>
                  <p className="summary-value">Preparation</p>
                  <p className="muted">Materiel recu, test rapide</p>
                </div>
              </div>
              <div>
                <span className="step">2</span>
                <div>
                  <p className="summary-value">Inventaire</p>
                  <p className="muted">Ajout fiche + etiquetage</p>
                </div>
              </div>
              <div>
                <span className="step">3</span>
                <div>
                  <p className="summary-value">Livraison</p>
                  <p className="muted">Signature et remise utilisateur</p>
                </div>
              </div>
            </div>
          </section>
        </aside>
      </main>
    </div>
  )
}

export default App
