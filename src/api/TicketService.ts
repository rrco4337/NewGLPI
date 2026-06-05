// src/services/TicketService.ts

export interface TicketCost {
  duration_seconds: number;
  time_cost: number;
  fixed_cost: number;
}

export interface Ticket {
  id?: number;
  ref_ticket: number;
  date: string;           // "03/06/2026"
  heure: string;          // "13:45"
  type: string;           // "Incident"
  titre: string;
  description: string;
  status: string;         // "New"
  priority: string;       // "Medium"
  items: string[];        // ["PC-ADM-001", "MN-FORM-002"]
  costs?: TicketCost[];
}

// Interface pour la réponse de l'API GLPI
interface GlpiTicketResponse {
  id: number;
  message?: string;
}

class TicketService {
  private glpiUrl: string;
  private appToken: string;
  private sessionToken: string | null = null;

  constructor() {
    this.glpiUrl = import.meta.env.VITE_GLPI_BASE_URL || 'http://localhost/glpi';
    this.appToken = import.meta.env.VITE_GLPI_APP_TOKEN || '';
  }

  setSessionToken(token: string) {
    this.sessionToken = token;
  }

  /**
   * Récupère l'ID d'un élément GLPI à partir de son nom (ex: "PC-ADM-001")
   */
  private async getItemIdByName(name: string, itemType: string): Promise<number | null> {
    if (!this.sessionToken) throw new Error('Session non initialisée');

    const url = `${this.glpiUrl}/apirest.php/${itemType}?searchText=${encodeURIComponent(name)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'App-Token': this.appToken,
        'Session-Token': this.sessionToken,
      },
    });

    if (!response.ok && response.status !== 206) {
      console.warn(`Impossible de trouver l'élément ${name}`);
      return null;
    }

    const data = await response.json();
    
    if (Array.isArray(data) && data.length > 0) {
      return data[0].id;
    }
    
    return null;
  }

  /**
   * Détermine le type GLPI d'un élément à partir de son préfixe ou nom
   */
  private guessItemType(itemName: string): string {
    const prefixMap: Record<string, string> = {
      'PC': 'Computer',
      'MN': 'Monitor',
      'PRT': 'Printer',
      'SW': 'Software',
      'NET': 'NetworkEquipment',
      'PH': 'Phone',
      'PRP': 'Peripheral',
    };

    for (const [prefix, type] of Object.entries(prefixMap)) {
      if (itemName.startsWith(prefix)) {
        return type;
      }
    }
    
    return 'Computer'; // Par défaut
  }

  /**
   * Convertit votre statut texte en code GLPI
   */
  private mapStatusToGlpi(status: string): number {
    const statusMap: Record<string, number> = {
      'New': 1,
      'Processing': 2,
      'Processing (assigned)': 2,
      'Pending': 4,
      'Solved': 5,
      'Closed': 6,
      'Accepted': 1,
      'Waiting': 4,
    };
    return statusMap[status] || 1; // 1 = Nouveau par défaut
  }

  /**
   * Convertit votre priorité texte en code GLPI
   */
  private mapPriorityToGlpi(priority: string): number {
    const priorityMap: Record<string, number> = {
      'Low': 1,
      'Lowest': 1,
      'Medium': 2,
      'Medium+': 3,
      'High': 4,
      'Very High': 5,
      'Critical': 5,
    };
    return priorityMap[priority] || 2; // 2 = Medium par défaut
  }

  /**
   * Convertit votre type texte en ID requesttypes_id
   */
  private mapTypeToGlpi(type: string): number {
    const typeMap: Record<string, number> = {
      'Incident': 1,
      'Demande': 1,
      'Problème': 1,
      'Request': 1,
      'Change': 2,
    };
    return typeMap[type] || 1;
  }

  /**
   * Convertit la date de votre format (DD/MM/YYYY) au format GLPI (YYYY-MM-DD HH:MM:SS)
   */
  private formatDateForGlpi(date: string, heure: string): string {
    const [day, month, year] = date.split('/');
    return `${year}-${month}-${day} ${heure}:00`;
  }

  /**
   * Crée un ticket dans GLPI
   */
  async createTicket(ticket: Ticket): Promise<number> {
    if (!this.sessionToken) {
      throw new Error('Session non initialisée. Appelle initSession() d\'abord.');
    }

    // Préparer le payload pour GLPI
    const payload = {
      name: ticket.titre,
      content: ticket.description,
      status: this.mapStatusToGlpi(ticket.status),
      urgency: this.mapPriorityToGlpi(ticket.priority),
      requesttypes_id: this.mapTypeToGlpi(ticket.type),
      date: this.formatDateForGlpi(ticket.date, ticket.heure),
      entities_id: 0,  // Entité racine par défaut
    };

    console.log('Création ticket avec payload:', payload);

    // 1. Créer le ticket
    const response = await fetch(`${this.glpiUrl}/apirest.php/Ticket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'App-Token': this.appToken,
        'Session-Token': this.sessionToken,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erreur GLPI:', errorText);
      throw new Error(`Erreur création ticket: ${response.status} - ${errorText}`);
    }

    const result: GlpiTicketResponse = await response.json();
    const ticketId = result.id;

    console.log(`Ticket créé avec ID: ${ticketId}`);

    // 2. Lier les éléments au ticket (si des items sont fournis)
    if (ticket.items && ticket.items.length > 0) {
      await this.linkItemsToTicket(ticketId, ticket.items);
    }

    // 3. Ajouter les coûts (si fournis)
    if (ticket.costs && ticket.costs.length > 0) {
      await this.addCostsToTicket(ticketId, ticket.costs);
    }

    return ticketId;
  }

  /**
   * Lie plusieurs éléments à un ticket existant
   * @param ticketId - ID GLPI du ticket
   * @param itemNames - Liste des noms d'éléments (ex: ["PC-ADM-001", "MN-FORM-002"])
   */
  async linkItemsToTicket(ticketId: number, itemNames: string[]): Promise<void> {
    if (!this.sessionToken) throw new Error('Session non initialisée');

    for (const itemName of itemNames) {
      const itemType = this.guessItemType(itemName);
      const itemId = await this.getItemIdByName(itemName, itemType);

      if (itemId) {
        const linkPayload = {
          tickets_id: ticketId,
          items_id: itemId,
          itemtype: itemType,
        };

        console.log(`Liaison: Ticket ${ticketId} -> ${itemType} ${itemName} (ID: ${itemId})`);

        const response = await fetch(`${this.glpiUrl}/apirest.php/Ticket_Item`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'App-Token': this.appToken,
            'Session-Token': this.sessionToken,
          },
          body: JSON.stringify(linkPayload),
        });

        if (!response.ok && response.status !== 201) {
          const error = await response.text();
          console.error(`Erreur liaison ${itemName}:`, error);
        }
      } else {
        console.warn(`Élément non trouvé dans GLPI: ${itemName}`);
      }
    }
  }

  /**
   * Ajoute des coûts à un ticket (via TicketCost dans GLPI)
   */
  private async addCostsToTicket(ticketId: number, costs: TicketCost[]): Promise<void> {
    if (!this.sessionToken) throw new Error('Session non initialisée');

    for (const cost of costs) {
      const costPayload = {
        tickets_id: ticketId,
        actiontime: cost.duration_seconds,
        cost_time: cost.time_cost,
        cost_fixed: cost.fixed_cost,
        name: `Intervention ${new Date().toLocaleDateString()}`,
      };

      const response = await fetch(`${this.glpiUrl}/apirest.php/TicketCost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'App-Token': this.appToken,
          'Session-Token': this.sessionToken,
        },
        body: JSON.stringify(costPayload),
      });

      if (!response.ok && response.status !== 201) {
        console.error(`Erreur ajout coût:`, await response.text());
      }
    }
  }

  /**
   * Méthode utilitaire pour récupérer tous les tickets
   */
  async getAllTickets(): Promise<any[]> {
    if (!this.sessionToken) throw new Error('Session non initialisée');

    const response = await fetch(`${this.glpiUrl}/apirest.php/Ticket?range=0-500`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'App-Token': this.appToken,
        'Session-Token': this.sessionToken,
      },
    });

    if (!response.ok) {
      throw new Error(`Erreur récupération tickets: ${response.status}`);
    }

    return await response.json();
  }
}

export const ticketService = new TicketService();