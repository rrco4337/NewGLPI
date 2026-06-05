// src/services/ElementService.ts

export interface Element {
  id: number;
  name: string;
  status: string;
  location: string;
  manufacturer: string;
  item_type: string;
  model: string;
  inventory_number: string;
  user: string;
}

// Types d'éléments GLPI à fetcher
const GLPI_ITEM_TYPES = [
  { endpoint: 'Computer',         label: 'Ordinateur' },
  { endpoint: 'Monitor',          label: 'Écran' },
  { endpoint: 'NetworkEquipment', label: 'Équipement réseau' },
  { endpoint: 'Printer',          label: 'Imprimante' },
  { endpoint: 'Phone',            label: 'Téléphone' },
  { endpoint: 'Peripheral',       label: 'Périphérique' },
  { endpoint: 'Software',          label: 'Logiciel' },
];

/**
 * Mapping des champs modèle selon le type.
 * Note : Avec expand_dropdowns=true, GLPI injecte la valeur textuelle 
 * directement dans la clé de l'ID d'origine (ex: 'computermodels_id').
 */
const MODEL_FIELD: Record<string, string> = {
  Computer:         'computermodels_id',
  Monitor:          'monitormodels_id',
  NetworkEquipment: 'networkequipmentmodels_id',
  Printer:          'printermodels_id',
  Phone:            'phonemodels_id',
  Peripheral:       'peripheralmodels_id',
  Software:         '',
};

class ElementService {
  private glpiUrl: string;
  private appToken: string;
  private sessionToken: string | null = null;

  constructor() {
    this.glpiUrl = import.meta.env.VITE_GLPI_BASE_URL || 'http://localhost/glpi';
    this.appToken = import.meta.env.VITE_GLPI_APP_TOKEN || '';
  }

  async initSession(user: string, password: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.glpiUrl}/apirest.php/initSession`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'App-Token': this.appToken,
          'Authorization': `Basic ${btoa(`${user}:${password}`)}`,
        },
      });

      if (!response.ok) return false;

      const data = await response.json();
      this.sessionToken = data.session_token;
      return true;
    } catch (error) {
      console.error('Erreur initSession:', error);
      return false;
    }
  }

  private async fetchItemType(endpoint: string, label: string): Promise<Element[]> {
    // expand_dropdowns=true => résout les IDs en noms (location, manufacturer, model, user...)
    // range=0-500          => augmente la limite (défaut GLPI = 50 items)
    const url = `${this.glpiUrl}/apirest.php/${endpoint}?expand_dropdowns=true&range=0-500`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'App-Token': this.appToken,
          'Session-Token': this.sessionToken!,
        },
      });

      // GLPI retourne 206 (partial content) ou 200
      if (!response.ok && response.status !== 206) {
        console.warn(`Impossible de fetcher ${endpoint}: HTTP ${response.status}`);
        return [];
      }

      const data = await response.json();

      // Certains endpoints retournent un objet d'erreur au lieu d'un tableau si vide
      if (!Array.isArray(data)) return [];

      const modelField = MODEL_FIELD[endpoint] || '';
      // Alternative au cas où la clé se terminerait par _name sur votre version GLPI
      const modelFieldName = modelField.replace('_id', '_name');

      return data.map((item: any) => {
        // Logique de détection robuste pour le modèle (Fallback)
        let detectedModel = '';
        if (modelField && item[modelField]) {
          detectedModel = item[modelField];
        } else if (modelFieldName && item[modelFieldName]) {
          detectedModel = item[modelFieldName];
        } else if (item.model) {
          detectedModel = item.model;
        }

        return {
          id: item.id,
          name: item.name || '(sans nom)',
          status: item.states_id || item.status || 'Inconnu',
          location: item.locations_id || '',       // résolu grâce à expand_dropdowns
          manufacturer: item.manufacturers_id || '', // résolu grâce à expand_dropdowns
          item_type: label,
          model: detectedModel,
          inventory_number: item.otherserial || '',
          user: item.users_id_tech || item.users_id || '',
        };
      });
    } catch (error) {
      console.error(`Erreur lors du fetch de l'endpoint ${endpoint}:`, error);
      return [];
    }
  }

  async fetchAllElements(): Promise<Element[]> {
    if (!this.sessionToken) throw new Error('Session non initialisée');

    const results = await Promise.allSettled(
      GLPI_ITEM_TYPES.map(({ endpoint, label }) =>
        this.fetchItemType(endpoint, label)
      )
    );

    return results.flatMap((result) =>
      result.status === 'fulfilled' ? result.value : []
    );
  }
}

export const elementService = new ElementService();