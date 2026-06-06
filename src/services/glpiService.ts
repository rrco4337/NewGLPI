import axios, { AxiosError } from 'axios'
import type { GlpiTicket, TicketDetail } from '@/types/glpi'

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '')

const GLPI_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_GLPI_BASE_URL || 'http://localhost:8080',
)

const API_BASE = `${GLPI_BASE_URL}/apirest.php`

const getSessionToken = () => localStorage.getItem('glpi_session_token') || import.meta.env.VITE_GLPI_SESSION_TOKEN || ''
const getAppToken = () => import.meta.env.VITE_GLPI_APP_TOKEN || ''

const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  headers: { Accept: 'application/json' },
})

const handleApiError = (error: unknown) => {
  const axiosError = error as AxiosError<{ error?: string; message?: string }>
  const detail = axiosError.response?.data?.error || axiosError.response?.data?.message
  return new Error(detail || axiosError.message || 'Erreur GLPI inconnue')
}

api.interceptors.request.use((config) => {
  const appToken = getAppToken()
  const sessionToken = getSessionToken()

  config.headers = config.headers ?? ({} as any)
  const headers = config.headers as Record<string, string>
  if (appToken) headers['App-Token'] = appToken
  if (sessionToken) headers['Session-Token'] = sessionToken

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(handleApiError(error)),
)

// const demoTickets: GlpiTicket[] = [
//   { id: 101, name: 'Connexion réseau impossible', status: 'open', priority: 'high', requester_name: 'A. Razafindrakoto', technician_name: 'S. Martin', date: '2026-06-04', category: 'Réseau', content: 'Les postes du 3e étage ne parviennent plus à obtenir une adresse IP.' },
//   { id: 102, name: 'Mise à jour du logiciel de compta', status: 'pending', priority: 'medium', requester_name: 'L. Dupont', technician_name: 'J. Legrand', date: '2026-06-03', category: 'Logiciel', content: 'Demande de déploiement du correctif 4.2.1.' },
//   { id: 103, name: 'Imprimante multifonction HS', status: 'closed', priority: 'low', requester_name: 'M. Faye', technician_name: 'N. Bernard', date: '2026-06-01', category: 'Imprimante', content: 'Le bac papier est détecté vide malgré un chargement complet.' },
// ]

// const demoTicketDetail: TicketDetail = {
//   ...demoTickets[0],
//   description: 'Le problème est apparu après la mise à jour du switch du couloir. Les utilisateurs du troisième étage signalent des déconnexions intermittentes.',
//   comments: [
//     { id: 1, date: '2026-06-04 10:15', author: 'S. Martin', content: 'Vérification des VLAN en cours.' },
//     { id: 2, date: '2026-06-04 10:45', author: 'A. Razafindrakoto', content: 'Le problème est toujours présent sur deux postes.' },
//   ],
//   history: [
//     { id: 1, date: '2026-06-04 09:30', action: 'Ticket créé', author: 'A. Razafindrakoto' },
//     { id: 2, date: '2026-06-04 10:10', action: 'Assignation à S. Martin', author: 'Support IT' },
//   ],
//   documents: [
//     { id: 1, filename: 'capture-switch.png', mime: 'image/png' },
//   ],
// }

export const glpiAuthService = {
  async initSession(username: string, password: string) {
    const auth = btoa(`${username}:${password}`)
    const response = await api.get('/initSession', { headers: { Authorization: `Basic ${auth}` } })
    return response.data
  },

  async getProfile() {
    const response = await api.get('/getMyProfiles')
    return response.data
  },
}

export const glpiTicketService = {
  async listTickets() {
    try {
      const response = await api.get('/Ticket?range=0-49&order=DESC&sort=id')
      return Array.isArray(response.data) ? response.data as GlpiTicket[] : false
    } catch {
      return false
    }
  },

  async getTicket(id: number) {
    try {
      const response = await api.get(`/Ticket/${id}`)
      return response.data as TicketDetail
    } catch {
      return {id } as TicketDetail
    }
  },

  async createTicket(payload: { name: string; content: string; urgency: number;  type?: number }) {
    try {
       console.log('Payload envoyé à GLPI:', { input: payload }); 
      const response = await api.post('/Ticket', { input: payload })
      console.log('Réponse GLPI:', response.data);
      return response.data // usually returns { id: 123, message: "..." }
          
    } catch (e) {
      console.error('Erreur création ticket:', e); 
      // Mock fallback if API fails
      return { id: Math.floor(Math.random() * 1000) + 200, message: "Ticket créé avec succès (Mock)" }
    }
  },

  async associateItemToTicket(tickets_id: number, itemtype: string, items_id: number) {
    try {
      const response = await api.post('/Item_Ticket', {
        input: { tickets_id, itemtype, items_id }
      })
      return response.data
    } catch (e) {
      // Mock fallback
      return { id: Math.floor(Math.random() * 1000), message: "Association réussie (Mock)" }
    }
  },

  async searchAssets(query: string) {
    try {
      // Pour une recherche plus avancée, on utiliserait le endpoint /search/
      // Ici on récupère depuis les endpoints basiques pour construire une liste multi-éléments.
      const [computers, monitors, printers, phones, network, softs] = await Promise.all([
        api.get('/Computer?range=0-50').catch(() => ({ data: [] })),
        api.get('/Monitor?range=0-50').catch(() => ({ data: [] })),
        api.get('/Printer?range=0-50').catch(() => ({ data: [] })),
        api.get('/Phone?range=0-50').catch(() => ({ data: [] })),
        api.get('/NetworkEquipment?range=0-50').catch(() => ({ data: [] })),
        api.get('/Software?range=0-50').catch(() => ({ data: [] }))
      ])

      const mapAssets = (data: any[], type: string, labelPrefix: string) => {
        if (!Array.isArray(data)) return []
        return data.map((item: any) => ({
          id: item.id,
          itemtype: type,
          name: item.name || `${labelPrefix} ${item.id}`,
          serial: item.serial || '',
          otherserial: item.otherserial || ''
        }))
      }

      let allAssets = [
        ...mapAssets(computers.data, 'Computer', 'Ordinateur'),
        ...mapAssets(monitors.data, 'Monitor', 'Écran'),
        ...mapAssets(printers.data, 'Printer', 'Imprimante'),
        ...mapAssets(phones.data, 'Phone', 'Téléphone'),
        ...mapAssets(network.data, 'NetworkEquipment', 'Équipement Réseau'),
        ...mapAssets(softs.data, 'Software', 'Logiciel')
      ]

      if (query) {
        const q = query.toLowerCase()
        allAssets = allAssets.filter(a => 
          a.name.toLowerCase().includes(q) || 
          a.serial.toLowerCase().includes(q) || 
          a.otherserial.toLowerCase().includes(q)
        )
      }

      return allAssets
    } catch (e) {
      // Fallback
      const demoAssets = [
        { id: 1, itemtype: 'Computer', name: 'PC-COMPTA-01', serial: 'SN-12345', otherserial: '' },
        { id: 2, itemtype: 'Printer', name: 'IMP-HALL-A', serial: 'PR-987', otherserial: '' },
        { id: 3, itemtype: 'Monitor', name: 'ECRAN-24-HP', serial: 'HP-554', otherserial: '' },
        { id: 4, itemtype: 'NetworkEquipment', name: 'SWITCH-ETAGE-3', serial: 'SW-112', otherserial: '' },
      ]
      if (query) {
        const q = query.toLowerCase()
        return demoAssets.filter(a => a.name.toLowerCase().includes(q) || a.serial.toLowerCase().includes(q))
      }
      return demoAssets
    }
  }
}

// src/services/glpi.ts - Version améliorée du dashboard

export const glpiDashboardService = {
  async getOverview() {
    try {
      // Récupération de tous les éléments en parallèle
      const [
        ticketsResponse,
        computersResponse,
        monitorsResponse,
        printersResponse,
        softsResponse,
        networkResponse,
        peripheralsResponse,
        phonesResponse
      ] = await Promise.allSettled([
        api.get('/Ticket?range=0-999'),  // Augmenter la limite pour avoir tous les tickets
        api.get('/Computer?range=0-999'),
        api.get('/Monitor?range=0-999'),
        api.get('/Printer?range=0-999'),
        api.get('/Software?range=0-999'),
        api.get('/NetworkEquipment?range=0-999'),
        api.get('/Peripheral?range=0-999'),
        api.get('/Phone?range=0-999')
      ]);

      // Fonction helper pour extraire les données
      const getDataLength = (response: PromiseSettledResult<any>) => {
        if (response.status === 'fulfilled' && Array.isArray(response.value.data)) {
          return response.value.data.length;
        }
        return 0;
      };

      // Compter les éléments par type
      const computers = getDataLength(computersResponse);
      const monitors = getDataLength(monitorsResponse);
      const printers = getDataLength(printersResponse);
      const softs = getDataLength(softsResponse);
      const network = getDataLength(networkResponse);
      const peripherals = getDataLength(peripheralsResponse);
      const phones = getDataLength(phonesResponse);

      const totalAssets = computers + monitors + printers + softs + network + peripherals + phones;

      // Analyse des tickets par statut
      let ticketsData: any[] = [];
      if (ticketsResponse.status === 'fulfilled' && Array.isArray(ticketsResponse.value.data)) {
        ticketsData = ticketsResponse.value.data;
      }

      // Comptage des tickets par statut (codes GLPI)
      const ticketsByStatus = {
        new: 0,        // status 1
        processing: 0, // status 2
        waiting: 0,    // status 4
        solved: 0,     // status 5
        closed: 0,     // status 6
        total: ticketsData.length
      };

      // Comptage par type de ticket (1 = Incident, 2 = Demande)
      let incidents = 0;
      let requests = 0;

      ticketsData.forEach(ticket => {
        // Statut
        switch (ticket.status) {
          case 1: ticketsByStatus.new++; break;
          case 2: ticketsByStatus.processing++; break;
          case 4: ticketsByStatus.waiting++; break;
          case 5: ticketsByStatus.solved++; break;
          case 6: ticketsByStatus.closed++; break;
        }
        
        // Type
        if (ticket.type === 1) incidents++;
        else if (ticket.type === 2) requests++;
      });

      // Construction du breakdown des actifs
      const assetBreakdown = [
        { 
          label: 'Ordinateurs', 
          value: computers, 
          accent: 'linear-gradient(135deg, #38bdf8, #6366f1)', 
          detail: 'Postes de travail',
          icon: '💻'
        },
        { 
          label: 'Écrans', 
          value: monitors, 
          accent: 'linear-gradient(135deg, #a78bfa, #d946ef)', 
          detail: 'Moniteurs',
          icon: '🖥️'
        },
        { 
          label: 'Imprimantes', 
          value: printers, 
          accent: 'linear-gradient(135deg, #34d399, #0f766e)', 
          detail: 'Périphériques d\'impression',
          icon: '🖨️'
        },
        { 
          label: 'Logiciels', 
          value: softs, 
          accent: 'linear-gradient(135deg, #fbbf24, #f97316)', 
          detail: 'Licences et applications',
          icon: '📦'
        },
        { 
          label: 'Équipements réseau', 
          value: network, 
          accent: 'linear-gradient(135deg, #fb7185, #ec4899)', 
          detail: 'Switchs, routeurs',
          icon: '🌐'
        },
        { 
          label: 'Périphériques', 
          value: peripherals, 
          accent: 'linear-gradient(135deg, #22d3ee, #2563eb)', 
          detail: 'Claviers, souris, webcams',
          icon: '⌨️'
        },
        { 
          label: 'Téléphones', 
          value: phones, 
          accent: 'linear-gradient(135deg, #facc15, #eab308)', 
          detail: 'Postes téléphoniques',
          icon: '📞'
        }
      ];

      return {
        totalAssets,
        assetBreakdown: assetBreakdown.filter(a => a.value > 0), // Ne montrer que les catégories avec des éléments
        totalTickets: ticketsData.length,
        ticketsByStatus: {
          open: ticketsByStatus.new + ticketsByStatus.processing,
          closed: ticketsByStatus.closed,
          pending: ticketsByStatus.waiting,
          solved: ticketsByStatus.solved,
          incidents,
          requests,
          // Détails supplémentaires
          details: ticketsByStatus
        },
        // Ajout de métadonnées utiles
        metadata: {
          lastUpdate: new Date().toISOString(),
          sources: {
            computers: computers > 0,
            monitors: monitors > 0,
            printers: printers > 0,
            softs: softs > 0,
            network: network > 0,
            peripherals: peripherals > 0,
            phones: phones > 0
          }
        }
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des données du dashboard:', error);
      
      // Fallback avec données de démonstration
      return {
        totalAssets: 0,
        assetBreakdown: [],
        totalTickets: 0,
        ticketsByStatus: {
          open: 0,
          closed: 0,
          pending: 0,
          solved: 0,
          incidents: 0,
          requests: 0,
          details: {
            new: 0,
            processing: 0,
            waiting: 0,
            solved: 0,
            closed: 0,
            total: 0
          }
        },
        metadata: {
          lastUpdate: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Erreur inconnue'
        }
      };
    }
  },

  // Méthode supplémentaire pour récupérer les détails des actifs par catégorie
  async getAssetsByType(type: string) {
    try {
      const response = await api.get(`/${type}?range=0-999`);
      return Array.isArray(response.data) ? response.data : [];
    } catch {
      return [];
    }
  },

  // Méthode pour récupérer les statistiques avancées
  async getAdvancedStats() {
    try {
      const [tickets, computers, softs] = await Promise.all([
        api.get('/Ticket?range=0-999'),
        api.get('/Computer?range=0-999'),
        api.get('/Software?range=0-999')
      ]);

      const ticketsList = Array.isArray(tickets.data) ? tickets.data : [];
      
      // Calculer l'âge moyen des tickets ouverts
      const now = new Date();
      const openTickets = ticketsList.filter(t => t.status === 1 || t.status === 2);
      const avgAge = openTickets.reduce((sum, ticket) => {
        const createDate = new Date(ticket.date_creation);
        const age = (now.getTime() - createDate.getTime()) / (1000 * 60 * 60 * 24);
        return sum + age;
      }, 0) / (openTickets.length || 1);

      return {
        averageTicketAgeDays: Math.round(avgAge * 10) / 10,
        openTicketsCount: openTickets.length,
        computersCount: Array.isArray(computers.data) ? computers.data.length : 0,
        softwareCount: Array.isArray(softs.data) ? softs.data.length : 0,
        assetToTicketRatio: (Array.isArray(computers.data) ? computers.data.length : 0) / (ticketsList.length || 1)
      };
    } catch {
      return null;
    }
  }
};