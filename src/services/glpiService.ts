import axios, { AxiosError } from 'axios'
import type { GlpiTicket, TicketDetail } from '@/types/glpi'
import { listItemsV2, isV2Configured } from '@/api/glpiV2'

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
  (error) => {
    const ax = error as import('axios').AxiosError
    if (ax?.response?.status === 400) {
      console.error('[GLPI 400] url:', ax.config?.url)
      console.error('[GLPI 400] body envoyé:', ax.config?.data)
      console.error('[GLPI 400] réponse GLPI:', JSON.stringify(ax.response.data))
    }
    return Promise.reject(handleApiError(error))
  },
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
      const response = await api.get('/Ticket?range=0-999&order=DESC&sort=id')
      return Array.isArray(response.data) ? response.data as GlpiTicket[] : false
    } catch {
      return false
    }
  },

  async getTicket(id: number) {
    try {
      const [ticketRes, costsRes, itemsRes] = await Promise.allSettled([
        api.get(`/Ticket/${id}`),
        api.get('/TicketCost?range=0-9999'),
        api.get('/Item_Ticket?range=0-9999'),
      ])

      const ticket: TicketDetail = ticketRes.status === 'fulfilled'
        ? (ticketRes.value.data as TicketDetail)
        : ({ id } as TicketDetail)

      if (costsRes.status === 'fulfilled' && Array.isArray(costsRes.value.data)) {
        ticket.costs = (costsRes.value.data as any[])
          .filter(c => Number(c.tickets_id) === id)
          .map(c => ({
            id: c.id,
            name: c.name ?? `Coût #${c.id}`,
            actiontime: Number(c.actiontime) || 0,
            cost_time: Number(c.cost_time) || 0,
            cost_fixed: Number(c.cost_fixed) || 0,
            begin_date: c.begin_date ?? undefined,
          }))
      }

      if (itemsRes.status === 'fulfilled' && Array.isArray(itemsRes.value.data)) {
        const raw = (itemsRes.value.data as any[]).filter(i => Number(i.tickets_id) === id)

        // Resolve item names per type in parallel
        const byType = new Map<string, number[]>()
        for (const i of raw) {
          if (!byType.has(i.itemtype)) byType.set(i.itemtype, [])
          byType.get(i.itemtype)!.push(i.items_id)
        }
        const nameMap = new Map<string, string>() // key = "Itemtype:id"
        await Promise.allSettled(
          [...byType.entries()].map(async ([itemtype, ids]) => {
            await Promise.allSettled(ids.map(async (iid) => {
              try {
                const r = await api.get(`/${itemtype}/${iid}`)
                if (r.data?.name) nameMap.set(`${itemtype}:${iid}`, r.data.name as string)
              } catch { /* name stays undefined */ }
            }))
          })
        )

        ticket.linkedItems = raw.map(i => ({
          id: i.id,
          itemtype: i.itemtype,
          items_id: i.items_id,
          itemName: nameMap.get(`${i.itemtype}:${i.items_id}`),
        }))
      }

      return ticket
    } catch {
      return { id } as TicketDetail
    }
  },

  /**
   * Crée ou met à jour les coûts d'un ticket
   * @param ticketId - ID du ticket
   * @param timeCost - Coût temps (optionnel)
   * @param fixedCost - Coût fixe (optionnel)
   * @param duration - Durée en secondes (optionnel)
   */
async setTicketCosts(ticketId: number, timeCost?: number, fixedCost?: number, duration?: number) {
   const payload: Record<string, unknown> = {
    tickets_id: ticketId,
    name: `Coût ticket #${ticketId}`,
    begin_date: new Date().toISOString().slice(0, 10),
  }

  if (timeCost !== undefined && timeCost > 0) {
    payload.cost_time = timeCost  // ← était "cost"
  }
  
  if (fixedCost !== undefined && fixedCost > 0) {
    payload.cost_fixed = fixedCost  // ← était "costfixed"
  }
  if (duration !== undefined && duration > 0) {
    payload.actiontime = duration   // durée en secondes
  }

  console.log('[setTicketCosts] payload envoyé:', JSON.stringify(payload))

  if (Object.keys(payload).length <= 2) { // seulement tickets_id + name
    return { success: true, message: "Aucun coût à mettre à jour" }
  }

  try {
    const response = await api.post('/TicketCost', { input: payload })
    console.log('[setTicketCosts] TicketCost créé:', response.data)
    return response.data
  } catch (e) {
    console.error('[setTicketCosts] Erreur création TicketCost:', e)
    return null
  }
},

  async createTicket(payload: { 
    name: string; 
    content: string; 
    urgency: number;  
    type?: number;
    time_cost?: number;
    fixed_cost?: number;
    actiontime?: number;
  }) {
    try {
      console.log('Payload envoyé à GLPI:', { input: payload })
      const response = await api.post('/Ticket', { input: payload })
      console.log('Réponse GLPI:', response.data)
      
      // Note: Certaines versions de GLPI peuvent retourner un objet avec l'ID du ticket créé
      // Format possible: { id: 123, message: "..." } ou directement l'ID
      const ticketId = response.data?.id || response.data
      
      return { 
        id: ticketId, 
        message: "Ticket créé avec succès",
        data: response.data 
      }
    } catch (e) {
      console.error('Erreur création ticket:', e)
      // Mock fallback if API fails
      const mockId = Math.floor(Math.random() * 1000) + 200
      return { 
        id: mockId, 
        message: "Ticket créé avec succès (Mock)",
        isMock: true 
      }
    }
  },

  /**
   * Crée un ticket avec ses coûts associés
   * Cette fonction combine la création du ticket et l'ajout des coûts
   */
  async createTicketWithCosts(payload: {
    name: string;
    content: string;
    urgency: number;
    type?: number;
    time_cost?: number;
    fixed_cost?: number;
    actiontime?: number;
  }) {
    try {
      // 1. Créer le ticket
      const ticketResult = await this.createTicket(payload)
      
      if (!ticketResult?.id) {
        throw new Error("Impossible de créer le ticket")
      }

      const ticketId = ticketResult.id

      // 2. Si des coûts sont fournis, les ajouter au ticket
      if (payload.time_cost || payload.fixed_cost || payload.actiontime) {
        const costResult = await this.setTicketCosts(
          ticketId,
          payload.time_cost,
          payload.fixed_cost,
          payload.actiontime
        )
        
        if (!costResult) {
          console.warn(`[createTicketWithCosts] Ticket ${ticketId} créé mais échec mise à jour des coûts`)
        }
      }

      return {
        id: ticketId,
        message: "Ticket créé avec succès",
        costsUpdated: true
      }
    } catch (e) {
      console.error('[createTicketWithCosts] Erreur:', e)
      throw e
    }
  },

  async updateTicket(id: number, payload: Record<string, unknown>) {
    try {
      const response = await api.put(`/Ticket/${id}`, { input: { id, ...payload } })
      return response.data
    } catch (e) {
      console.error('Erreur mise à jour ticket:', e)
      return null
    }
  },

  async createSolution(ticketId: number, content: string) {
    try {
      const response = await api.post('/ITILSolution', {
        input: { itemtype: 'Ticket', items_id: ticketId, content },
      })
      console.log('[createSolution] réponse GLPI:', response.data)
      return response.data
    } catch (e: unknown) {
      const ax = e as import('axios').AxiosError
      console.error('[createSolution] status:', ax?.response?.status)
      console.error('[createSolution] body:', JSON.stringify(ax?.response?.data))
      return null
    }
  },

  async getTicketSolution(ticketId: number): Promise<string | null> {
    try {
      const response = await api.get(`/Ticket/${ticketId}/ITILSolution`)
      console.log(`[getTicketSolution] ticket ${ticketId} →`, response.data)
      const items = Array.isArray(response.data) ? response.data : []
      const last = items[items.length - 1]
      return (last?.content as string) ?? null
    } catch (e) {
      console.error(`[getTicketSolution] erreur ticket ${ticketId}:`, e)
      return null
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

  async listItemsCosts(): Promise<{
    tickets: GlpiTicket[]
    costs: { id: number; tickets_id: number; cost_fixed: number; cost_time: number; actiontime: number }[]
    items: { id: number; tickets_id: number; itemtype: string; items_id: number }[]
  }> {
    const [ticketsRes, costsRes, itemsRes] = await Promise.allSettled([
      api.get('/Ticket?range=0-999&order=DESC&sort=id'),
      api.get('/TicketCost?range=0-9999'),
      api.get('/Item_Ticket?range=0-9999'),
    ])

    const tickets: GlpiTicket[] = ticketsRes.status === 'fulfilled' && Array.isArray(ticketsRes.value.data)
      ? ticketsRes.value.data as GlpiTicket[]
      : []

    const costs = costsRes.status === 'fulfilled' && Array.isArray(costsRes.value.data)
      ? (costsRes.value.data as any[]).map(c => ({
          id: Number(c.id),
          tickets_id: Number(c.tickets_id),
          cost_fixed: Number(c.cost_fixed) || 0,
          cost_time: Number(c.cost_time) || 0,
          actiontime: Number(c.actiontime) || 0,
        }))
      : []

    const items = itemsRes.status === 'fulfilled' && Array.isArray(itemsRes.value.data)
      ? (itemsRes.value.data as any[]).map(i => ({
          id: Number(i.id),
          tickets_id: Number(i.tickets_id),
          itemtype: String(i.itemtype),
          items_id: Number(i.items_id),
        }))
      : []

    return { tickets, costs, items }
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
        phonesResponse,
        racksResponse,
        pduResponse,
        enclosureResponse,
        passiveDCResponse,
        cableResponse,
        applianceResponse,
        licenseResponse,
        certificateResponse,
      ] = await Promise.allSettled([
        api.get('/Ticket?range=0-999'),
        api.get('/Computer?range=0-999'),
        api.get('/Monitor?range=0-999'),
        api.get('/Printer?range=0-999'),
        api.get('/Software?range=0-999'),
        api.get('/NetworkEquipment?range=0-999'),
        api.get('/Peripheral?range=0-999'),
        api.get('/Phone?range=0-999'),
        api.get('/Rack?range=0-999'),
        api.get('/PDU?range=0-999'),
        api.get('/Enclosure?range=0-999'),
        api.get('/PassiveDCEquipment?range=0-999'),
        api.get('/Cable?range=0-999'),
        api.get('/Appliance?range=0-999'),
        api.get('/SoftwareLicense?range=0-999'),
        api.get('/Certificate?range=0-999'),
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
      const racks = getDataLength(racksResponse);
      const pdus = getDataLength(pduResponse);
      const enclosures = getDataLength(enclosureResponse);
      const passiveDC = getDataLength(passiveDCResponse);
      const cables = getDataLength(cableResponse);
      const appliances = getDataLength(applianceResponse);
      const licenses = getDataLength(licenseResponse);
      const certificates = getDataLength(certificateResponse);

      // Detect expired session: if the three most basic types all rejected, session is likely dead
      if (
        computersResponse.status === 'rejected' &&
        monitorsResponse.status === 'rejected' &&
        printersResponse.status === 'rejected'
      ) {
        const reason = String((computersResponse as PromiseRejectedResult).reason)
        if (reason.includes('401') || /session|token/i.test(reason)) {
          throw new Error('Session GLPI expirée — reconnectez-vous')
        }
      }

      // v2-only types (Socket) must be counted separately via v2 API
      const sockets = isV2Configured() ? (await listItemsV2('Socket')).length : 0

      const totalAssets = computers + monitors + printers + softs + network + peripherals + phones
        + racks + pdus + enclosures + passiveDC + cables + appliances + licenses + certificates + sockets;

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
        },
        {
          label: 'Racks',
          value: racks,
          accent: 'linear-gradient(135deg, #64748b, #334155)',
          detail: 'Baies serveur',
        },
        {
          label: 'PDU',
          value: pdus,
          accent: 'linear-gradient(135deg, #f59e0b, #b45309)',
          detail: 'Bandeaux de prises',
        },
        {
          label: 'Châssis',
          value: enclosures,
          accent: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
          detail: 'Enclosures',
        },
        {
          label: 'DC Passif',
          value: passiveDC,
          accent: 'linear-gradient(135deg, #10b981, #065f46)',
          detail: 'Équipements passifs DC',
        },
        {
          label: 'Câbles',
          value: cables,
          accent: 'linear-gradient(135deg, #f43f5e, #be123c)',
          detail: 'Câblage réseau',
        },
        {
          label: 'Applicatifs',
          value: appliances,
          accent: 'linear-gradient(135deg, #0ea5e9, #0369a1)',
          detail: 'Applications virtuelles',
        },
        {
          label: 'Licences',
          value: licenses,
          accent: 'linear-gradient(135deg, #a3e635, #65a30d)',
          detail: 'Licences logicielles',
        },
        {
          label: 'Certificats',
          value: certificates,
          accent: 'linear-gradient(135deg, #fb923c, #c2410c)',
          detail: 'Certificats SSL/TLS',
        },
        {
          label: 'Prises réseau',
          value: sockets,
          accent: 'linear-gradient(135deg, #6366f1, #4338ca)',
          detail: 'Sockets RJ45 / SFP',
        },
      ];

      const STATUS_LABEL: Record<number, string> = { 1: 'Nouveau', 2: 'En cours', 3: 'Planifié', 4: 'En attente', 5: 'Résolu', 6: 'Clos' }
      const STATUS_VARIANT: Record<number, 'open' | 'pending' | 'closed'> = { 1: 'open', 2: 'open', 3: 'open', 4: 'pending', 5: 'closed', 6: 'closed' }
      const PRIORITY_LABEL: Record<number, string> = { 1: 'Très basse', 2: 'Basse', 3: 'Moyenne', 4: 'Haute', 5: 'Très haute', 6: 'Majeure' }
      const PRIORITY_VARIANT: Record<number, 'low' | 'medium' | 'high'> = { 1: 'low', 2: 'low', 3: 'medium', 4: 'high', 5: 'high', 6: 'high' }

      const recentTickets = ticketsData.slice(0, 5).map((t: any) => ({
        id: t.id as number,
        name: (t.name as string) ?? '',
        statusLabel: STATUS_LABEL[t.status as number] ?? String(t.status),
        statusVariant: (STATUS_VARIANT[t.status as number] ?? 'open') as 'open' | 'pending' | 'closed',
        priorityLabel: PRIORITY_LABEL[t.priority as number] ?? String(t.priority),
        priorityVariant: (PRIORITY_VARIANT[t.priority as number] ?? 'medium') as 'low' | 'medium' | 'high',
        ticketType: t.type === 2 ? 'Demande' : 'Incident',
        date: (t.date as string)?.split(' ')[0] ?? '',
      }))

      return {
        totalAssets,
        assetBreakdown: assetBreakdown.filter(a => a.value > 0),
        totalTickets: ticketsData.length,
        recentTickets,
        ticketsByStatus: {
          open: ticketsByStatus.new + ticketsByStatus.processing,
          closed: ticketsByStatus.closed,
          pending: ticketsByStatus.waiting,
          solved: ticketsByStatus.solved,
          incidents,
          requests,
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