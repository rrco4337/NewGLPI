import React, { useState, useEffect } from 'react';
import { ticketService, type Ticket, type TicketCost } from '../../api/TicketService';
import { elementService, type Element } from '../../api/ElementService';
import './TicketForm.css';

const TicketForm: React.FC = () => {
  // État du formulaire
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('Incident');
  const [status, setStatus] = useState('New');
  const [priority, setPriority] = useState('Medium');
  const [date, setDate] = useState('');
  const [heure, setHeure] = useState('');
  
  // Éléments sélectionnés
  const [elements, setElements] = useState<Element[]>([]);
  const [selectedElements, setSelectedElements] = useState<Element[]>([]);
  const [loadingElements, setLoadingElements] = useState(true);
  
  // Coûts
  const [costs, setCosts] = useState<TicketCost[]>([]);
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [timeCost, setTimeCost] = useState<number>(0);
  const [fixedCost, setFixedCost] = useState<number>(0);
  
  // États généraux
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  // 1. Initialiser la session GLPI au chargement du composant
  useEffect(() => {
    const initSession = async () => {
      try {
        setError(null);
        // Identifiants GLPI par défaut (à adapter si besoin)
        const success = await elementService.initSession('glpi', 'glpi');
        
        if (success) {
          console.log('Session GLPI initialisée avec succès');
          // Partager le token avec ticketService
          ticketService.setSessionToken(elementService.getSessionToken?.() || null);
          setSessionReady(true);
        } else {
          setError('Impossible de se connecter à GLPI. Vérifie que l\'API est activée et que les identifiants sont corrects.');
        }
      } catch (err) {
        console.error('Erreur lors de l\'initialisation de la session:', err);
        setError('Erreur de connexion à GLPI. Vérifie que GLPI est accessible.');
      } finally {
        setLoadingElements(false);
      }
    };

    initSession();
  }, []);

  // 2. Charger les éléments disponibles UNIQUEMENT après que la session soit prête
  useEffect(() => {
    const loadElements = async () => {
      if (!sessionReady) return;
      
      try {
        setLoadingElements(true);
        const data = await elementService.fetchAllElements();
        setElements(data);
      } catch (err) {
        console.error('Erreur chargement éléments:', err);
        setError('Impossible de charger la liste des éléments');
      } finally {
        setLoadingElements(false);
      }
    };

    loadElements();
    
    // Date par défaut = aujourd'hui
    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
    const formattedHeure = `${today.getHours().toString().padStart(2, '0')}:${today.getMinutes().toString().padStart(2, '0')}`;
    setDate(formattedDate);
    setHeure(formattedHeure);
  }, [sessionReady]);

  // Ajouter un élément à la sélection
  const handleAddElement = (elementId: number) => {
    const element = elements.find(e => e.id === elementId);
    if (element && !selectedElements.some(e => e.id === element.id)) {
      setSelectedElements([...selectedElements, element]);
    }
  };

  // Retirer un élément de la sélection
  const handleRemoveElement = (elementId: number) => {
    setSelectedElements(selectedElements.filter(e => e.id !== elementId));
  };

  // Ajouter un coût
  const handleAddCost = () => {
    if (durationSeconds > 0 || timeCost > 0 || fixedCost > 0) {
      setCosts([...costs, {
        duration_seconds: durationSeconds,
        time_cost: timeCost,
        fixed_cost: fixedCost
      }]);
      // Réinitialiser les champs de coût
      setDurationSeconds(0);
      setTimeCost(0);
      setFixedCost(0);
    }
  };

  // Retirer un coût
  const handleRemoveCost = (index: number) => {
    setCosts(costs.filter((_, i) => i !== index));
  };

  // Soumettre le formulaire
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Validation
    if (!titre.trim()) {
      setError('Le titre est obligatoire');
      setLoading(false);
      return;
    }
    if (!description.trim()) {
      setError('La description est obligatoire');
      setLoading(false);
      return;
    }
    if (!date) {
      setError('La date est obligatoire');
      setLoading(false);
      return;
    }
    if (!heure) {
      setError('L\'heure est obligatoire');
      setLoading(false);
      return;
    }

    try {
      const newTicket: Ticket = {
        ref_ticket: Date.now(), // ID temporaire
        date: date,
        heure: heure,
        type: type,
        titre: titre,
        description: description,
        status: status,
        priority: priority,
        items: selectedElements.map(e => e.name), // On utilise le nom pour l'identification
        costs: costs.length > 0 ? costs : undefined
      };

      const ticketId = await ticketService.createTicket(newTicket);
      
      // Réinitialiser le formulaire
      setTitre('');
      setDescription('');
      setType('Incident');
      setStatus('New');
      setPriority('Medium');
      setSelectedElements([]);
      setCosts([]);
      
      setSuccess(`Ticket créé avec succès ! ID GLPI: ${ticketId}`);
      
      // Faire défiler vers le haut
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
    } catch (err) {
      console.error('Erreur création ticket:', err);
      setError('Erreur lors de la création du ticket. Vérifie que GLPI est accessible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ticket-create-container">
      <div className="ticket-create-header">
        <h1>📝 Créer un ticket</h1>
        <p>Formulaire de création de ticket d'incident ou de demande</p>
      </div>

      {success && (
        <div className="alert alert-success">
          ✅ {success}
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          ❌ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="ticket-form">
        {/* Section 1: Informations générales */}
        <div className="form-section">
          <h2>Informations générales</h2>
          
          <div className="form-row">
            <div className="form-group">
              <label>Titre du ticket *</label>
              <input
                type="text"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Ex: Panne imprimante, Problème réseau..."
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez le problème en détail..."
                rows={5}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-row three-cols">
            <div className="form-group">
              <label>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} disabled={loading}>
                <option value="Incident">Incident</option>
                <option value="Demande">Demande</option>
                <option value="Problème">Problème</option>
              </select>
            </div>

            <div className="form-group">
              <label>Statut</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} disabled={loading}>
                <option value="New">Nouveau</option>
                <option value="Processing">En traitement</option>
                <option value="Pending">En attente</option>
                <option value="Solved">Résolu</option>
                <option value="Closed">Fermé</option>
              </select>
            </div>

            <div className="form-group">
              <label>Priorité</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} disabled={loading}>
                <option value="Low">Basse</option>
                <option value="Medium">Moyenne</option>
                <option value="High">Haute</option>
                <option value="Critical">Critique</option>
              </select>
            </div>
          </div>

          <div className="form-row two-cols">
            <div className="form-group">
              <label>Date</label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="JJ/MM/AAAA"
                disabled={loading}
              />
              <small>Format: JJ/MM/AAAA</small>
            </div>

            <div className="form-group">
              <label>Heure</label>
              <input
                type="text"
                value={heure}
                onChange={(e) => setHeure(e.target.value)}
                placeholder="HH:MM"
                disabled={loading}
              />
              <small>Format: HH:MM</small>
            </div>
          </div>
        </div>

        {/* Section 2: Éléments concernés */}
        <div className="form-section">
          <h2>📦 Éléments concernés</h2>
          
          <div className="form-row">
            <div className="form-group">
              <label>Ajouter un élément</label>
              <div className="element-selector">
                <select onChange={(e) => handleAddElement(parseInt(e.target.value))} value="" disabled={loadingElements || loading}>
                  <option value="">-- Sélectionner un élément --</option>
                  {elements.map(element => (
                    <option key={element.id} value={element.id}>
                      [{element.item_type}] {element.name} - {element.user || 'Non assigné'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {selectedElements.length > 0 && (
            <div className="selected-elements">
              <label>Éléments liés au ticket :</label>
              <div className="elements-list">
                {selectedElements.map(element => (
                  <div key={element.id} className="element-badge">
                    <span>
                      <strong>{element.name}</strong> ({element.item_type})
                      {element.model && <small> - {element.model}</small>}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveElement(element.id)}
                      disabled={loading}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Coûts (optionnel) */}
        <div className="form-section">
          <h2>💰 Coûts d'intervention (optionnel)</h2>
          
          <div className="form-row three-cols">
            <div className="form-group">
              <label>Durée (secondes)</label>
              <input
                type="number"
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(parseInt(e.target.value) || 0)}
                placeholder="0"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Coût horaire (€)</label>
              <input
                type="number"
                step="0.01"
                value={timeCost}
                onChange={(e) => setTimeCost(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Coût fixe (€)</label>
              <input
                type="number"
                step="0.01"
                value={fixedCost}
                onChange={(e) => setFixedCost(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddCost}
            className="btn-secondary"
            disabled={loading}
          >
            + Ajouter ce coût
          </button>

          {costs.length > 0 && (
            <div className="costs-list">
              <label>Coûts enregistrés :</label>
              {costs.map((cost, index) => (
                <div key={index} className="cost-item">
                  <span>
                    Durée: {cost.duration_seconds}s | 
                    Coût horaire: {cost.time_cost}€ | 
                    Coût fixe: {cost.fixed_cost}€
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCost(index)}
                    disabled={loading}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Boutons d'action */}
        <div className="form-actions">
          <button type="button" onClick={() => window.history.back()} className="btn-cancel" disabled={loading}>
            Annuler
          </button>
          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? 'Création en cours...' : '✓ Créer le ticket'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TicketForm;