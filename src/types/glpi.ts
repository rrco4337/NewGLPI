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
  status: TicketStatus | string | number
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

export type TicketCostEntry = {
  id: number
  name: string
  actiontime: number   // secondes
  cost_time: number    // coût temps €
  cost_fixed: number   // coût fixe €
  begin_date?: string
}

export type LinkedItem = {
  id: number
  itemtype: string
  items_id: number
  itemName?: string    // résolu après fetch
}

export type TicketDetail = GlpiTicket & {
  comments?: Array<{ id: number; content: string; date: string; author?: string }>
  history?: Array<{ id: number; date: string; action: string; author?: string }>
  documents?: Array<{ id: number; filename: string; mime?: string }>
  costs?: TicketCostEntry[]
  linkedItems?: LinkedItem[]
}

export type DashboardMetric = {
  label: string
  value: number
  accent: string
  detail: string
}
