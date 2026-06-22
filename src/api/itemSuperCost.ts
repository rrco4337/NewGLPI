const API_BASE = '/api/item-supercosts'

export interface ItemCostSummary {
  itemtype: string
  superCost: number
  reopenCost: number
}

export interface ReopenGroup {
  reopenGroup: number
  ticketId: number
  percent: number
  mode: number
  closed: boolean
  total: number
  items: { itemtype: string; items_id: number; amount: number }[]
}

export interface SuperCostBatch {
  ticketId: number
  batch: number
  total: number
  items: { itemtype: string; items_id: number; amount: number }[]
}

export interface TicketCeiling {
  ticketId: number
  percent: number
}

export const ItemSuperCostApi = {
  /**
   * Crée un batch de supercost pour un ticket.
   * Les items sont filtrés côté backend (Computer, Phone, Monitor uniquement).
   * @returns { saved: number } — 0 si aucun item suivi lié au ticket
   */
  async addSuperCost(
    ticketId: number,
    amount: number,
    items: { itemtype: string; itemsId: number }[]
  ): Promise<{ saved: number }> {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, amount, items }),
    })
    if (!res.ok) throw new Error('Erreur enregistrement supercost')
    return res.json()
  },

  /**
   * Enregistre les frais de réouverture = percent% d'une base Supercost.
   * mode : 1=dernier Supercost, 2=premier, 3=moyenne, 4=somme. Le calcul est fait côté backend.
   */
  async addReopenCost(ticketId: number, percent: number, mode = 1): Promise<void> {
    const res = await fetch(`${API_BASE}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, percent, mode }),
    })
    if (!res.ok) throw new Error('Erreur enregistrement frais de réouverture')
  },

  /**
   * Annule le dernier batch de supercost (ne touche pas les reopen costs).
   * @returns { removed: number }
   */
  async cancelLastBatch(ticketId: number): Promise<{ removed: number }> {
    const res = await fetch(`${API_BASE}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId }),
    })
    if (!res.ok) throw new Error('Erreur annulation supercost')
    return res.json()
  },

  /**
   * Retourne le total du dernier batch pour un ticket.
   * Utilisé pour afficher le "SuperCost précédent" dans le dialog de réouverture.
   */
  async getLastBatchTotal(ticketId: number): Promise<number> {
    const res = await fetch(`${API_BASE}/${ticketId}/last-batch-total`)
    if (!res.ok) return 0
    return res.json()
  },

  /** Agrégation supercost + reopencost par itemtype pour ItemsCostList. */
  async getItemCostSummaries(): Promise<ItemCostSummary[]> {
    const res = await fetch(API_BASE)
    if (!res.ok) throw new Error('Erreur chargement coûts')
    return res.json()
  },

  /** Liste toutes les réouvertures (regroupées par reopen_group), dans l'ordre de création. */
  async listReopens(): Promise<ReopenGroup[]> {
    const res = await fetch(`${API_BASE}/reopens`)
    if (!res.ok) throw new Error('Erreur chargement des réouvertures')
    return res.json()
  },

  /** Modifie une réouverture : seuls le pourcentage et le mode changent, les montants sont recalculés côté serveur. */
  async updateReopen(group: number, percent: number, mode: number): Promise<void> {
    const res = await fetch(`${API_BASE}/reopens/${group}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percent, mode }),
    })
    if (!res.ok) throw new Error('Erreur modification de la réouverture')
  },

  /** Ferme (close) une réouverture : montant remis à 0, mais la ligne reste à sa place dans la liste. */
  async closeReopen(group: number): Promise<void> {
    const res = await fetch(`${API_BASE}/reopens/${group}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Erreur suppression de la réouverture')
  },

  /** Liste tous les Super Cost (un par batch de ticket), regroupés par ticket + batch. */
  async listSuperCosts(): Promise<SuperCostBatch[]> {
    const res = await fetch(`${API_BASE}/supercosts`)
    if (!res.ok) throw new Error('Erreur chargement des Super Cost')
    return res.json()
  },

  /** Liste les Super Cost annulés (soft-delete), conservés à leur place (batch) pour pouvoir être rétablis. */
  async listCancelledSuperCosts(): Promise<SuperCostBatch[]> {
    const res = await fetch(`${API_BASE}/supercosts/cancelled`)
    if (!res.ok) throw new Error('Erreur chargement des Super Cost annulés')
    return res.json()
  },

  /** Rétablit un Super Cost annulé : il regagne sa place (son batch) dans la liste. */
  async restoreSuperCost(ticketId: number, batch: number): Promise<void> {
    const res = await fetch(`${API_BASE}/supercosts/${ticketId}/${batch}/restore`, { method: 'POST' })
    if (!res.ok) throw new Error('Erreur rétablissement du Super Cost')
  },

  /** Modifie le montant d'un Super Cost. Le montant est réparti à parts égales entre ses items. */
  async updateSuperCost(ticketId: number, batch: number, amount: number): Promise<void> {
    const res = await fetch(`${API_BASE}/supercosts/${ticketId}/${batch}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    })
    if (!res.ok) throw new Error('Erreur modification du Super Cost')
  },

  /** Liste les plafonds de réouverture définis par ticket. */
  async listCeilings(): Promise<TicketCeiling[]> {
    const res = await fetch(`${API_BASE}/ceilings`)
    if (!res.ok) throw new Error('Erreur chargement des plafonds')
    return res.json()
  },

  /** Définit (ou supprime si percent = null) le plafond de réouverture d'un ticket. */
  async setCeiling(ticketId: number, percent: number | null): Promise<void> {
    const res = await fetch(`${API_BASE}/ceilings/${ticketId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percent }),
    })
    if (!res.ok) throw new Error('Erreur enregistrement du plafond')
  },

  async getDetailsByItemtype(itemtype: string): Promise<{
    supercosts: { ticket_id: number; batch: number; items_id: number; amount: number }[]
    reopencosts: { ticket_id: number; batch: number; items_id: number; amount: number; mode: number }[]
  }> {
    const res = await fetch(`${API_BASE}/details/${encodeURIComponent(itemtype)}`)
    if (!res.ok) throw new Error('Erreur chargement details')
    return res.json()
  },
}
