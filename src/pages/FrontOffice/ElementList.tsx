// src/pages/FrontOffice/ElementsList.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { elementService, type Element } from '../../api/ElementService';
import { ElementFilter, type FilterCriteria } from '../../components/Element/ElementFilter'; // Ajuste le chemin si nécessaire
import './ElementList.css';

export const ElementList: React.FC = () => {
  const [elements, setElements] = useState<Element[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // État pour stocker les filtres actifs
  const [filters, setFilters] = useState<FilterCriteria>({
    search: '',
    item_type: '',
    status: '',
    location: '',
  });

  useEffect(() => {
    const loadElements = async () => {
      try {
        setLoading(true);
        // Initialisation de la session GLPI
        const init = await elementService.initSession('glpi', 'glpi');
        if (!init) {
          setError('Connexion GLPI échouée');
          return;
        }

        // Récupération des éléments
        const data = await elementService.fetchAllElements();
        setElements(data);
      } catch (err) {
        console.error('Erreur lors du chargement:', err);
        setError('Impossible de charger les données GLPI.');
      } finally {
        setLoading(false);
      }
    };

    loadElements();
  }, []);

  // 1. Extraire les statuts uniques pour le filtre (sans doublons ni valeurs vides)
  const uniqueStatuses = useMemo(() => {
    const statuses = elements.map((el) => el.status).filter(Boolean);
    return Array.from(new Set(statuses)).sort();
  }, [elements]);

  // 2. Extraire les localisations uniques pour le filtre
  const uniqueLocations = useMemo(() => {
    const locations = elements.map((el) => el.location).filter(Boolean);
    return Array.from(new Set(locations)).sort();
  }, [elements]);

  // 3. Filtrer la liste en temps réel selon les critères saisis
  const filteredElements = useMemo(() => {
    return elements.filter((element) => {
      // Critère 1 : Recherche textuelle globale
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesName = element.name.toLowerCase().includes(searchLower);
        const matchesInventory = element.inventory_number.toLowerCase().includes(searchLower);
        const matchesUser = element.user.toLowerCase().includes(searchLower);
        const matchesModel = element.model.toLowerCase().includes(searchLower);

        if (!matchesName && !matchesInventory && !matchesUser && !matchesModel) {
          return false;
        }
      }

      // Critère 2 : Type de matériel
      if (filters.item_type && element.item_type !== filters.item_type) {
        return false;
      }

      // Critère 3 : Statut
      if (filters.status && element.status !== filters.status) {
        return false;
      }

      // Critère 4 : Localisation
      if (filters.location && element.location !== filters.location) {
        return false;
      }

      return true;
    });
  }, [elements, filters]);

  if (loading) return <div className="elements-container">Chargement...</div>;
  if (error) return <div className="elements-container style-error">{error}</div>;

  return (
    <div className="elements-container">
      <h1>📋 Liste des éléments</h1>

      {/* Ajout du composant de filtrage */}
      <ElementFilter
        onFilterChange={setFilters}
        uniqueStatuses={uniqueStatuses}
        uniqueLocations={uniqueLocations}
      />

      {/* Indicateur de résultats pour le confort utilisateur */}
      <div className="results-counter" style={{ textAlign: 'right', marginBottom: '10px', fontSize: '14px', color: '#666' }}>
        {filteredElements.length} élément(s) affiché(s) 
        {elements.length !== filteredElements.length && ` (sur ${elements.length} au total)`}
      </div>

      <div className="table-wrapper">
        <table className="elements-table">
          <thead>
            <tr>
              <th>Type</th> {/* Nouvelle colonne pour repérer le type d'item fusionné */}
              <th>Nom</th>
              <th>Statut</th>
              <th>Localisation</th>
              <th>Fabricant</th>
              <th>Modèle</th>
              <th>N° inventaire</th>
              <th>Utilisateur</th>
            </tr>
          </thead>
          <tbody>
            {filteredElements.length > 0 ? (
              filteredElements.map((element) => (
                // Concaténation Type + ID pour assurer une clé unique stricte dans React
                <tr key={`${element.item_type}-${element.id}`}>
                  <td><strong>{element.item_type}</strong></td>
                  <td>{element.name}</td>
                  <td>{element.status || <span className="text-muted">-</span>}</td>
                  <td>{element.location || <span className="text-muted">-</span>}</td>
                  <td>{element.manufacturer || <span className="text-muted">-</span>}</td>
                  <td>{element.model || <span className="text-muted">-</span>}</td>
                  <td>{element.inventory_number || <span className="text-muted">-</span>}</td>
                  <td>{element.user || <span className="text-muted">-</span>}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                  Aucun élément ne correspond à vos critères de recherche.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ElementList;