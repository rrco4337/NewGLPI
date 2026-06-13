export type ComputerFormData = {
  assetTag: string
  displayName: string
  manufacturer: string
  model: string
  serialNumber: string
  type: string
  status: string
  location: string
  owner: string
  purchaseDate: string
  notes: string
}

export type AsyncState = 'idle' | 'loading' | 'success' | 'error'

export type FormErrors = Partial<Record<keyof ComputerFormData, string>>

export type TicketStatus = 'new' | 'open' | 'pending' | 'solved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

export type GlpiTicket = {
  id: number
  name: string
  status: TicketStatus | string
  priority: TicketPriority | string
  requester_name?: string
  requester?: { name?: string; firstname?: string; realname?: string }
  technician_name?: string
  technician?: { name?: string; firstname?: string; realname?: string }
  date?: string
  closedate?: string
  category?: string
  type?: string
  content?: string
  description?: string
  solution?: string
  users_id_lastupdater?: number
  entities_id?: number
}

export type TicketDetail = GlpiTicket & {
  comments?: Array<{ id: number; content: string; date: string; author?: string }>
  history?: Array<{ id: number; date: string; action: string; author?: string }>
  documents?: Array<{ id: number; filename: string; mime?: string }>
}

export type DashboardMetric = {
  label: string
  value: number
  accent: string
  detail: string
}


export type TicketItem = {
  tickets_id: number;
  items_id: number;
  itemtype: string;
}

export type TicketCost = {
  id: number
  tickets_id: number
  name?: string
  comment?: string
  begin_date?: string
  end_date?: string
  actiontime: number      // durée en secondes
  cost_time: number       // coût horaire calculé
  cost_fixed: number      // coût fixe
  cost_material: number   // coût matériel
  budgets_id?: number
  entities_id?: number
}