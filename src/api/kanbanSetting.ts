const API_BASE_URL = 'http://localhost:8081/api/backoffice';

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
  }
};