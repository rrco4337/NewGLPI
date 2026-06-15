const API_BASE_URL = '/api/backoffice';

export interface KanbanSetting {
  key: string;
  value: string;
}

export const KanbanSettingApi = {
  // Récupérer tous les paramètres
  async getAllSettings(): Promise<KanbanSetting[]> {
    const response = await fetch(`${API_BASE_URL}/settings`);
    if (!response.ok) throw new Error('Erreur chargement paramètres');
    return response.json();
  },

  // Récupérer sous forme d'objet
  async getSettingsMap(): Promise<Record<string, string>> {
    const settings = await this.getAllSettings();
    const map: Record<string, string> = {};
    settings.forEach(setting => {
      map[setting.key] = setting.value;
    });
    return map;
  },

  // Mettre à jour un paramètre
  async updateSetting(key: string, value: string): Promise<KanbanSetting> {
    const response = await fetch(`${API_BASE_URL}/settings/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value)
    });
    if (!response.ok) throw new Error(`Erreur mise à jour ${key}`);
    return response.json();
  },

  // Sauvegarder le super cost d'un ticket clôturé
  async saveSuperCost(ticketId: number, amount: number): Promise<void> {
    await this.updateSetting(`ticket_super_cost_${ticketId}`, String(amount));
  },

  // Récupérer le super cost d'un ticket
  async getSuperCost(ticketId: number): Promise<number> {
    const map = await this.getSettingsMap();
    return parseFloat(map[`ticket_super_cost_${ticketId}`] ?? '0') || 0;
  },

  // Effacer le super cost d'un ticket (remise à 0)
  async clearSuperCost(ticketId: number): Promise<void> {
    await this.updateSetting(`ticket_super_cost_${ticketId}`, '0');
  },

  // Sauvegarder les frais de réouverture d'un ticket (calculés sur le superCost précédent)
  async saveReopenCost(ticketId: number, amount: number): Promise<void> {
    await this.updateSetting(`ticket_reopen_cost_${ticketId}`, String(amount));
  },

  // Effacer les frais de réouverture (remise à 0, ex: annulation ou nouvelle clôture)
  async clearReopenCost(ticketId: number): Promise<void> {
    await this.updateSetting(`ticket_reopen_cost_${ticketId}`, '0');
  },
};