import React, { useState, useEffect } from 'react';
import { ticketService, type Ticket, type TicketCost } from '../../api/TicketService';
import { elementService, type Element } from '../../api/ElementService';
import './TicketForm.css';

// Interface pour l'état local du formulaire
interface FormDataState {
  ref_ticket: string;
  date: string;
  heure: string;
  type: string;
  titre: string;
  description: string;
  status:  string;   // Peut être un ID numérique ou une chaîne pour le mapping
  priority:  string; // Peut être un ID numérique ou une chaîne pour le mapping
}
const labelToEndpoint: Record<string, string> = {
  'Ordinateur': 'Computer',
  'Écran': 'Monitor',
  'Équipement réseau': 'NetworkEquipment',
  'Imprimante': 'Printer',
  'Téléphone': 'Phone',
  'Périphérique': 'Peripheral',
  'Logiciel': 'Software',
};
const TicketForm: React.FC = () => {
  // 1. État unifié du formulaire
  const [formData, setFormData] = useState<FormDataState>({
    ref_ticket: '',
    date: '',
    heure: '',
    type: 'Incident',
    status: 'New',
    priority: 'Medium',
    titre: '',
    description: '',
  });

  // Éléments sélectionnés et liste globale
  const [elements, setElements] = useState<Element[]>([]);
  const [selectedElements, setSelectedElements] = useState<Element[]>([]);
  const [loadingElements, setLoadingElements] = useState(true);

  // Coûts
  const [costs, setCosts] = useState<TicketCost[]>([]);
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [timeCost, setTimeCost] = useState<number>(0);
  const [fixedCost, setFixedCost] = useState<number>(0);

  // États de l'application
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  // Mappings pour GLPI (Conversion Text -> ID Numérique)

  // Gestionnaire de changement générique pour les inputs
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Fonction de réinitialisation du formulaire
  const resetForm = () => {
    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
    const formattedHeure = `${today.getHours().toString().padStart(2, '0')}:${today.getMinutes().toString().padStart(2, '0')}`;

    setFormData({
      ref_ticket: '',
      date: formattedDate,
      heure: formattedHeure,
      type: 'Incident',
      status: 'New',
      priority: 'Medium',
      titre: '',
      description: '',
    });
    setSelectedElements([]);
    setCosts([]);
    setError(null);
  };

  // 1. Initialiser la session GLPI au chargement pour les éléments
  useEffect(() => {
    const initSession = async () => {
      try {
              const sessionToken = await elementService.initSession('glpi', 'glpi');

        if (sessionToken) {
          console.log('Session GLPI initiale réussie');
          ticketService.setSessionToken(sessionToken);
          setSessionReady(true);
        } else {
          setError("Impossible de se connecter à GLPI au démarrage.");
        }
      } catch (err) {
        console.error("Erreur lors de l'initialisation initiale:", err);
        setError('Erreur de connexion à GLPI.');
      } finally {
        setLoadingElements(false);
      }
    };

    initSession();
  }, []);

  // 2. Charger les éléments disponibles
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

    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}`;
    const formattedHeure = `${today.getHours().toString().padStart(2, '0')}:${today.getMinutes().toString().padStart(2, '0')}`;
    
    setFormData((prev) => ({
      ...prev,
      date: formattedDate,
      heure: formattedHeure,
    }));
  }, [sessionReady]);

  const handleAddElement = (elementId: number) => {
    const element = elements.find((e) => e.id === elementId);
    if (element && !selectedElements.some((e) => e.id === element.id)) {
      setSelectedElements([...selectedElements, element]);
    }
  };

  const handleRemoveElement = (elementId: number) => {
    setSelectedElements(selectedElements.filter((e) => e.id !== elementId));
  };

  const handleAddCost = () => {
    if (durationSeconds > 0 || timeCost > 0 || fixedCost > 0) {
      setCosts([
        ...costs,
        {
          duration_seconds: durationSeconds,
          time_cost: timeCost,
          fixed_cost: fixedCost,
        },
      ]);
      setDurationSeconds(0);
      setTimeCost(0);
      setFixedCost(0);
    }
  };

  const handleRemoveCost = (index: number) => {
    setCosts(costs.filter((_, i) => i !== index));
  };

  // Soumission du formulaire avec reconnexion flash et fix de types
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.titre || !formData.description) {
      setError('Veuillez remplir tous les champs obligatoires (*)');
      return;
    }

    setIsSubmitting(true);

    try {
      // Reconnexion flash "juste à temps" pour s'assurer d'avoir un jeton actif
      console.log("Tentative de reconnexion flash à GLPI avant soumission...");
      // ✅ Après — option B
        const sessionToken = await elementService.initSession('glpi', 'glpi');
        if (!sessionToken) {
          throw new Error("Échec de la reconnexion à GLPI. Vérifie les identifiants.");
        }
        ticketService.setSessionToken(sessionToken);


      // Conversion des types pour correspondre à l'interface Ticket
      // Extraction des IDs d'éléments en tableau de strings (Element[] -> string[])
        const formattedItems = selectedElements.map(e => ({
        id: e.id,
        itemtype: labelToEndpoint[e.item_type] || e.item_type, // fallback sur la valeur brute
}));

      const ticketData: Ticket = {
        ref_ticket: formData.ref_ticket,
        date: formData.date,
        heure: formData.heure,
        type: formData.type,
        titre: formData.titre,
        description: formData.description,
        // Conversion string -> number via nos objets mapping
        status: formData.status || 1, 
        priority:formData.priority || 3,
        items: formattedItems, 
        costs: costs,            
      };

      const ticketId = await ticketService.createTicket(ticketData);

      setSuccess(`Ticket créé avec succès ! ID GLPI: ${ticketId}`);
      resetForm();
    } catch (err) {
      console.error('Erreur création ticket:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ticket-create-container">
      <div className="ticket-create-header">
        <h1>📝 Créer un ticket</h1>
        <p>Formulaire de création de ticket d'incident ou de demande</p>
      </div>

      {success && <div className="alert alert-success">✅ {success}</div>}
      {error && <div className="alert alert-error">❌ {error}</div>}

      <form onSubmit={handleSubmit} className="ticket-form">
        {/* Section 1: Informations générales */}
        <div className="form-section">
          <h2>Informations générales</h2>

          <div className="form-row">
            <div className="form-group">
              <label>Titre du ticket *</label>
              <input
                type="text"
                name="titre"
                value={formData.titre}
                onChange={handleInputChange}
                placeholder="Ex: Panne imprimante, Problème réseau..."
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Description *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Décrivez le problème en détail..."
                rows={5}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="form-row three-cols">
            <div className="form-group">
              <label>Type</label>
              <select name="type" value={formData.type} onChange={handleInputChange} disabled={isSubmitting}>
                <option value="Incident">Incident</option>
                <option value="Demande">Demande</option>
                <option value="Problème">Problème</option>
              </select>
            </div>

            <div className="form-group">
              <label>Statut</label>
              <select name="status" value={formData.status} onChange={handleInputChange} disabled={isSubmitting}>
                <option value="New">Nouveau</option>
                <option value="Processing">En traitement</option>
                <option value="Pending">En attente</option>
                <option value="Solved">Résolu</option>
                <option value="Closed">Fermé</option>
              </select>
            </div>

            <div className="form-group">
              <label>Priorité</label>
              <select name="priority" value={formData.priority} onChange={handleInputChange} disabled={isSubmitting}>
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
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                placeholder="JJ/MM/AAAA"
                disabled={isSubmitting}
              />
              <small>Format: JJ/MM/AAAA</small>
            </div>

            <div className="form-group">
              <label>Heure</label>
              <input
                type="text"
                name="heure"
                value={formData.heure}
                onChange={handleInputChange}
                placeholder="HH:MM"
                disabled={isSubmitting}
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
                <select
                  onChange={(e) => handleAddElement(parseInt(e.target.value))}
                  value=""
                  disabled={loadingElements || isSubmitting}
                >
                  <option value="">-- Sélectionner un élément --</option>
                  {elements.map((element) => (
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
                {selectedElements.map((element) => (
                  <div key={element.id} className="element-badge">
                    <span>
                      <strong>{element.name}</strong> ({element.item_type})
                      {element.model && <small> - {element.model}</small>}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveElement(element.id)}
                      disabled={isSubmitting}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Coûts */}
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                disabled={isSubmitting}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddCost}
            className="btn-secondary"
            disabled={isSubmitting}
          >
            + Ajouter ce coût
          </button>

          {costs.length > 0 && (
            <div className="costs-list">
              <label>Coûts enregistrés :</label>
              {costs.map((cost, index) => (
                <div key={index} className="cost-item">
                  <span>
                    Durée: {cost.duration_seconds}s | Coût horaire: {cost.time_cost}€ | Coût fixe:{' '}
                    {cost.fixed_cost}€
                  </span>
                  <button type="button" onClick={() => handleRemoveCost(index)} disabled={isSubmitting}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Boutons d'action */}
        <div className="form-actions">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="btn-cancel"
            disabled={isSubmitting}
          >
            Annuler
          </button>
          <button type="submit" className="btn-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Création en cours...' : '✓ Créer le ticket'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TicketForm;
