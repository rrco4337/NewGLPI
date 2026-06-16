const API_BASE = '/api/item-supercosts'

export interface ItemCostSummary {
  itemtype: string
  superCost: number
  reopenCost: number
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
   * Enregistre les frais de réouverture = percent% du dernier batch.
   * Le calcul est fait côté backend.
   */
  async addReopenCost(ticketId: number, percent: number): Promise<void> {
    const res = await fetch(`${API_BASE}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, percent }),
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

  async getDetailsByItemtype(itemtype: string): Promise<{
    supercosts: { ticket_id: number; batch: number; items_id: number; amount: number }[]
    reopencosts: { ticket_id: number; batch: number; items_id: number; amount: number }[]
  }> {
    const res = await fetch(`${API_BASE}/details/${encodeURIComponent(itemtype)}`)
    if (!res.ok) throw new Error('Erreur chargement details')
    return res.json()
  },
}
