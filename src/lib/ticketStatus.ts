export type NormalizedTicketStatus = 'new' | 'in-progress' | 'pending' | 'closed' | 'unknown'
export type NormalizedTicketPriority = 'low' | 'medium' | 'high' | 'unknown'

const statusMap: Record<string, NormalizedTicketStatus> = {
  '1': 'new',
  'new': 'new',
  'nouveau': 'new',
  'vaovao': 'new',

  '2': 'in-progress',
  '3': 'in-progress',
  'open': 'in-progress',
  'processing': 'in-progress',
  'in progress': 'in-progress',
  'en cours': 'in-progress',
  'en cours (assigné)': 'in-progress',
  'en cours (planifié)': 'in-progress',
  'planned': 'in-progress',

  '4': 'pending',
  'pending': 'pending',
  'en attente': 'pending',
  'waiting': 'pending',
  'miandry': 'pending',

  '5': 'closed',
  'solved': 'closed',
  'résolu': 'closed',
  'resolu': 'closed',
  'resolved': 'closed',
  '6': 'closed',
  'closed': 'closed',
  'clos': 'closed',
  'fermé': 'closed',
  'ferme': 'closed',
  'voakatona': 'closed',
}

export const normalizeTicketStatus = (value: string | number | undefined): NormalizedTicketStatus => {
  const normalized = String(value ?? '').trim().toLowerCase()
  return statusMap[normalized] ?? 'unknown'
}

export const getTicketStatusLabel = (value: string | number | undefined): string => {
  switch (normalizeTicketStatus(value)) {
    case 'new':
      return 'Nouveau'
    case 'in-progress':
      return 'In progress'
    case 'pending':
      return 'En attente'
    case 'closed':
      return 'Closed'
    default:
      return String(value ?? 'Inconnu')
  }
}

export const getTicketStatusVariant = (value: string | number | undefined): 'open' | 'pending' | 'closed' => {
  const normalized = normalizeTicketStatus(value)
  if (normalized === 'pending') return 'pending'
  if (normalized === 'closed') return 'closed'
  return 'open'
}

const priorityMap: Record<string, NormalizedTicketPriority> = {
  '1': 'low',
  '2': 'low',
  '3': 'medium',
  '4': 'high',
  '5': 'high',
  '6': 'high',
  'low': 'low',
  'basse': 'low',
  'bas': 'low',
  'medium': 'medium',
  'moyenne': 'medium',
  'moyen': 'medium',
  'high': 'high',
  'haute': 'high',
  'hauts': 'high',
  'urgent': 'high',
  'urgente': 'high',
}

export const normalizeTicketPriority = (value: string | number | undefined): NormalizedTicketPriority => {
  const normalized = String(value ?? '').trim().toLowerCase()
  return priorityMap[normalized] ?? 'unknown'
}

export const getTicketPriorityLabel = (value: string | number | undefined): string => {
  switch (normalizeTicketPriority(value)) {
    case 'low':
      return 'Basse'
    case 'medium':
      return 'Moyenne'
    case 'high':
      return 'Haute'
    default:
      return String(value ?? 'Inconnue')
  }
}

export const getTicketPriorityVariant = (value: string | number | undefined): 'low' | 'medium' | 'high' => {
  const normalized = normalizeTicketPriority(value)
  if (normalized === 'medium') return 'medium'
  if (normalized === 'high') return 'high'
  return 'low'
}
