// src/components/elements/ElementFilter.tsx
import React, { useState, useEffect } from 'react';

// Interface pour définir la structure de nos filtres
export interface FilterCriteria {
  search: string;
  item_type: string;
  status: string;
  location: string;
}

interface ElementFilterProps {
  // Fonctions de rappel pour envoyer les filtres mis à jour au parent
  onFilterChange: (filters: FilterCriteria) => void;
  // Listes dynamiques optionnelles fournies par le parent pour remplir les sélecteurs
  uniqueStatuses: string[];
  uniqueLocations: string[];
}

// Liste des types d'éléments (doit correspondre aux 'label' de ElementService)
const AVAILABLE_TYPES = [
  'Ordinateur',
  'Écran',
  'Équipement réseau',
  'Imprimante',
  'Téléphone',
  'Périphérique',
  'Logiciel'
];

export const ElementFilter: React.FC<ElementFilterProps> = ({
  onFilterChange,
  uniqueStatuses,
  uniqueLocations,
}) => {
  // État local pour stocker les valeurs des filtres
  const [filters, setFilters] = useState<FilterCriteria>({
    search: '',
    item_type: '',
    status: '',
    location: '',
  });

  // Notifier le parent à chaque fois que l'état des filtres change
  useEffect(() => {
    onFilterChange(filters);
  }, [filters, onFilterChange]);

  // Handler générique pour les changements d'inputs
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Fonction pour réinitialiser tous les filtres d'un coup
  const handleReset = () => {
    setFilters({
      search: '',
      item_type: '',
      status: '',
      location: '',
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.grid}>
        
        {/* Recherche textuelle globale */}
        <div style={styles.formGroup}>
          <label style={styles.label}>Recherche globale</label>
          <input
            type="text"
            name="search"
            value={filters.search}
            onChange={handleChange}
            placeholder="Nom, n° d'inventaire, utilisateur..."
            style={styles.input}
          />
        </div>

        {/* Filtrer par type d'élément */}
        <div style={styles.formGroup}>
          <label style={styles.label}>Type de matériel</label>
          <select
            name="item_type"
            value={filters.item_type}
            onChange={handleChange}
            style={styles.select}
          >
            <option value="">Tous les types</option>
            {AVAILABLE_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Filtrer par statut */}
        <div style={styles.formGroup}>
          <label style={styles.label}>Statut</label>
          <select
            name="status"
            value={filters.status}
            onChange={handleChange}
            style={styles.select}
          >
            <option value="">Tous les statuts</option>
            {uniqueStatuses.map((status) => (
              <option key={status} value={status}>{status || '(Sans statut)'}</option>
            ))}
          </select>
        </div>

        {/* Filtrer par lieu (Location) */}
        <div style={styles.formGroup}>
          <label style={styles.label}>Lieu / Emplacement</label>
          <select
            name="location"
            value={filters.location}
            onChange={handleChange}
            style={styles.select}
          >
            <option value="">Tous les lieux</option>
            {uniqueLocations.map((loc) => (
              <option key={loc} value={loc}>{loc || '(Sans lieu)'}</option>
            ))}
          </select>
        </div>

      </div>

      {/* Bouton de réinitialisation si au moins un filtre est actif */}
      {(filters.search || filters.item_type || filters.status || filters.location) && (
        <div style={styles.actions}>
          <button onClick={handleReset} style={styles.resetButton}>
            Réinitialiser les filtres
          </button>
        </div>
      )}
    </div>
  );
};

// Styles de base en ligne (à adapter avec ton framework CSS : Tailwind, Bootstrap, etc.)
const styles = {
  container: {
    padding: '16px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    marginBottom: '20px',
    border: '1px solid #e9ecef',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#495057',
  },
  input: {
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #ced4da',
    fontSize: '14px',
  },
  select: {
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #ced4da',
    fontSize: '14px',
    backgroundColor: '#fff',
  },
  actions: {
    marginTop: '12px',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  resetButton: {
    padding: '6px 12px',
    backgroundColor: '#6c757d',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
};