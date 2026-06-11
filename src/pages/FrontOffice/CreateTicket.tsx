import { useState } from 'react'
import type { FormEvent } from 'react'
import { glpiTicketService } from '@/services/glpiService'
import './CreateTicket.css'

interface Asset {
  id: number
  itemtype: string
  name: string
  serial: string
  otherserial: string
}

export function CreateTicket() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [urgency, setUrgency] = useState<number>(3) // 3 is medium in GLPI usually
  const [type, setType] = useState<number>(3)
  
  // New cost and duration fields
  const [duration, setDuration] = useState<string>('')
  const [timeCost, setTimeCost] = useState<string>('')
  const [fixedCost, setFixedCost] = useState<string>('')
  
  // Asset selection
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Asset[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedAssets, setSelectedAssets] = useState<Asset[]>([])

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [createdTicketId, setCreatedTicketId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setIsSearching(true)
    try {
      const results = await glpiTicketService.searchAssets(searchQuery)
      setSearchResults(results)
    } catch (e) {
      console.error(e)
    } finally {
      setIsSearching(false)
    }
  }

  const addAsset = (asset: Asset) => {
    if (!selectedAssets.find(a => a.id === asset.id && a.itemtype === asset.itemtype)) {
      setSelectedAssets([...selectedAssets, asset])
    }
    setSearchQuery('')
    setSearchResults([])
  }

  const removeAsset = (asset: Asset) => {
    setSelectedAssets(selectedAssets.filter(a => !(a.id === asset.id && a.itemtype === asset.itemtype)))
  }

  // Helper function to convert French decimal format (comma) to number
  const parseFrenchNumber = (value: string): number => {
    if (!value || value.trim() === '') return 0
    // Remove spaces and replace comma with dot
    const cleaned = value.trim().replace(/\s/g, '').replace(',', '.')
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }

 // Dans handleSubmit, remplacez l'appel à createTicket par :

const handleSubmit = async (e: FormEvent) => {
  e.preventDefault()
  if (!title.trim() || !description.trim()) {
    setError("Le titre et la description sont requis.")
    return
  }

  setIsSubmitting(true)
  setError(null)
  setSubmitSuccess(false)

  try {
    // Parse cost values
    const durationSeconds = parseFrenchNumber(duration)
    const timeCostValue = parseFrenchNumber(timeCost)
    const fixedCostValue = parseFrenchNumber(fixedCost)

    // Utiliser la nouvelle fonction createTicketWithCosts
    const result = await glpiTicketService.createTicketWithCosts({
      name: title,
      content: description,
      urgency: urgency,
      type: type,
      actiontime: durationSeconds > 0 ? durationSeconds : undefined,
      time_cost: timeCostValue > 0 ? timeCostValue : undefined,
      fixed_cost: fixedCostValue > 0 ? fixedCostValue : undefined
    })

    const newTicketId = result.id

    if (!newTicketId) {
      throw new Error("Erreur lors de la création du ticket (ID manquant).")
    }

    setCreatedTicketId(newTicketId)

    // Associer les équipements
    for (const asset of selectedAssets) {
      await glpiTicketService.associateItemToTicket(newTicketId, asset.itemtype, asset.id)
    }

    setSubmitSuccess(true)
    // Reset form
    setTitle('')
    setDescription('')
    setUrgency(3)
    setDuration('')
    setTimeCost('')
    setFixedCost('')
    setSelectedAssets([])
  } catch (err: any) {
    setError(err.message || "Une erreur est survenue lors de la création du ticket.")
  } finally {
    setIsSubmitting(false)
  }
}

  return (
    <div className="create-ticket-container">
      <div className="create-ticket-glass">
        <header className="create-ticket-header">
          <h1>Créer un Nouveau Ticket</h1>
          <p>Soumettez votre demande d'assistance et liez les équipements concernés.</p>
        </header>

        {submitSuccess && (
          <div className="success-banner">
            <i className="bi bi-check-circle" style={{ fontSize: 24 }} />
            <div className="success-content">
              <h3>Ticket créé avec succès !</h3>
              <p>Votre demande a été enregistrée sous le numéro <strong>#{createdTicketId}</strong>.</p>
              {selectedAssets.length > 0 && (
                <p className="success-assets-info">Les {selectedAssets.length} équipement(s) sélectionné(s) ont été associés automatiquement.</p>
              )}
            </div>
            <button className="new-ticket-btn" onClick={() => setSubmitSuccess(false)}>Nouveau ticket</button>
          </div>
        )}

        {error && (
          <div className="error-banner">
            <i className="bi bi-exclamation-circle" style={{ fontSize: 24 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className={`ticket-form ${submitSuccess ? 'form-hidden' : ''}`}>
          <div className="form-section">
            <h2>1. Informations Générales</h2>
            <div className="form-group">
              <label htmlFor="title">Titre du ticket *</label>
              <input
                type="text"
                id="title"
                placeholder="Ex: Problème de connexion au réseau"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="description">Description détaillée *</label>
              <textarea
                id="description"
                rows={5}
                placeholder="Décrivez votre problème en détail..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="type">Type</label>
              <select id="type" value={type} onChange={e => setType(Number(e.target.value))}>
                <option value={1}>Incident</option>
                <option value={2}>Demande</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="urgency">Urgence</label>
              <select id="urgency" value={urgency} onChange={e => setUrgency(Number(e.target.value))}>
                <option value={5}>Très Haute</option>
                <option value={4}>Haute</option>
                <option value={3}>Moyenne</option>
                <option value={2}>Basse</option>
                <option value={1}>Très Basse</option>
              </select>
            </div>
          </div>

          {/* New Cost Section */}
          <div className="form-section">
            <h2>2. Coûts et Durée <span className="optional-badge">Optionnel</span></h2>
            <p className="section-help">Ces informations sont facultatives et peuvent être modifiées ultérieurement.</p>
            
            <div className="cost-grid">
              <div className="form-group">
                <label htmlFor="duration">
                  <i className="bi bi-hourglass-split" style={{ marginRight: 8 }} />
                  Durée (secondes)
                </label>
                <input
                  type="text"
                  id="duration"
                  placeholder="Ex: 3600 (1 heure) ou 417,59"
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                />
                <small>Durée en secondes. Utilisez la virgule pour les décimales.</small>
              </div>

              <div className="form-group">
                <label htmlFor="timeCost">
                  <i className="bi bi-clock-history" style={{ marginRight: 8 }} />
                  Coût Temps
                </label>
                <input
                  type="text"
                  id="timeCost"
                  placeholder="Ex: 184088,19"
                  value={timeCost}
                  onChange={e => setTimeCost(e.target.value)}
                />
                <small>Coût lié au temps passé (format français: virgule = décimale)</small>
              </div>

              <div className="form-group">
                <label htmlFor="fixedCost">
                  <i className="bi bi-cash-stack" style={{ marginRight: 8 }} />
                  Coût Fixe
                </label>
                <input
                  type="text"
                  id="fixedCost"
                  placeholder="Ex: 911291,97"
                  value={fixedCost}
                  onChange={e => setFixedCost(e.target.value)}
                />
                <small>Coût fixe associé au ticket</small>
              </div>
            </div>

            {/* Optional: Display calculated total */}
            {(timeCost || fixedCost) && (
              <div className="cost-total-preview">
                <i className="bi bi-calculator" />
                <span>
                  Total estimé: {(parseFrenchNumber(timeCost) + parseFrenchNumber(fixedCost)).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </span>
              </div>
            )}
          </div>

          <div className="form-section">
            <h2>3. Éléments Concernés</h2>
            <p className="section-help">Recherchez et ajoutez les équipements (PC, Imprimante, etc.) concernés par ce ticket.</p>

            <div className="asset-search-wrapper">
              <div className="search-input-group">
                <i className="bi bi-search search-icon" style={{ fontSize: 20 }} />
                <input
                  type="text"
                  placeholder="Rechercher par nom, numéro de série..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
                />
                <button type="button" className="btn-search" onClick={handleSearch} disabled={isSearching || !searchQuery}>
                  {isSearching ? <i className="bi bi-arrow-repeat spin" style={{ fontSize: 20 }} /> : 'Chercher'}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="search-results">
                  <ul>
                    {searchResults.map(asset => (
                      <li key={`${asset.itemtype}-${asset.id}`}>
                        <div className="asset-info">
                          <span className="asset-type">{asset.itemtype}</span>
                          <span className="asset-name">{asset.name}</span>
                          {asset.serial && <span className="asset-serial">SN: {asset.serial}</span>}
                        </div>
                        <button type="button" className="btn-add-asset" onClick={() => addAsset(asset)}>
                          <i className="bi bi-plus-circle" style={{ fontSize: 18 }} /> Ajouter
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {selectedAssets.length > 0 && (
              <div className="selected-assets">
                <h3>Équipements liés à ce ticket :</h3>
                <ul>
                  {selectedAssets.map(asset => (
                    <li key={`${asset.itemtype}-${asset.id}`} className="selected-asset-item">
                      <div className="asset-info">
                        <span className="asset-type">{asset.itemtype}</span>
                        <span className="asset-name">{asset.name}</span>
                      </div>
                      <button type="button" className="btn-remove-asset" onClick={() => removeAsset(asset)} title="Retirer">
                        <i className="bi bi-trash" style={{ fontSize: 18 }} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <><i className="bi bi-arrow-repeat spin" style={{ fontSize: 20 }} /> Création en cours...</>
              ) : (
                'Soumettre le ticket'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}