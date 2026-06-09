import React, { useState, useEffect } from 'react';
import { KanbanSettingApi } from '../../api/kanbanSetting';
import './KanbanSetting.css';

interface SettingsState {
  kanban_color_new: string;
  kanban_color_in_progress: string;
  kanban_color_done: string;
  status_name_new: string;
  status_name_in_progress: string;
  status_name_done: string;
  [key: string]: string;
}

const KanbanSetting: React.FC = () => {
  const [settings, setSettings] = useState<SettingsState>({
    kanban_color_new: '#FFE5E5',
    kanban_color_in_progress: '#FFF4E5',
    kanban_color_done: '#E5FFE5',
    status_name_new: 'Nouveau',
    status_name_in_progress: 'En cours',
    status_name_done: 'Terminé'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Charger les paramètres au démarrage
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settingsMap = await KanbanSettingApi.getSettingsMap();
      setSettings(prev => ({ ...prev, ...settingsMap }));
    } catch (error) {
      console.error('Erreur chargement:', error);
      setMessage({ type: 'error', text: 'Erreur lors du chargement des paramètres' });
    } finally {
      setLoading(false);
    }
  };

  const handleColorChange = async (key: string, value: string) => {
    // Mise à jour immédiate de l'UI
    setSettings(prev => ({ ...prev, [key]: value }));
    
    try {
      setSaving(key);
      await KanbanSettingApi.updateSetting(key, value);
      setMessage({ type: 'success', text: `${key} mis à jour` });
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      setMessage({ type: 'error', text: `Erreur lors de la mise à jour de ${key}` });
      // Recharger pour restaurer l'ancienne valeur
      await loadSettings();
    } finally {
      setSaving(null);
    }
  };

  const handleTextChange = (key: string, value: string) => {
    handleColorChange(key, value);
  };

  if (loading) {
    return <div className="settings-loading">Chargement des paramètres...</div>;
  }

  return (
    <div className="settings-container">
      <h1>Paramétrage du Backoffice</h1>
      
      {message && (
        <div className={`settings-message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="settings-section">
        <h2>🎨 Couleurs du tableau Kanban</h2>
        <div className="settings-grid">
          <div className="setting-item">
            <label>Statut "Nouveau" :</label>
            <div className="color-preview" style={{ backgroundColor: settings.kanban_color_new }} />
            <input
              type="color"
              value={settings.kanban_color_new}
              onChange={(e) => handleColorChange('kanban_color_new', e.target.value)}
              disabled={saving === 'kanban_color_new'}
            />
            {saving === 'kanban_color_new' && <span className="saving-indicator">💾</span>}
          </div>

          <div className="setting-item">
            <label>Statut "En cours" :</label>
            <div className="color-preview" style={{ backgroundColor: settings.kanban_color_in_progress }} />
            <input
              type="color"
              value={settings.kanban_color_in_progress}
              onChange={(e) => handleColorChange('kanban_color_in_progress', e.target.value)}
              disabled={saving === 'kanban_color_in_progress'}
            />
            {saving === 'kanban_color_in_progress' && <span className="saving-indicator">💾</span>}
          </div>

          <div className="setting-item">
            <label>Statut "Terminé" :</label>
            <div className="color-preview" style={{ backgroundColor: settings.kanban_color_done }} />
            <input
              type="color"
              value={settings.kanban_color_done}
              onChange={(e) => handleColorChange('kanban_color_done', e.target.value)}
              disabled={saving === 'kanban_color_done'}
            />
            {saving === 'kanban_color_done' && <span className="saving-indicator">💾</span>}
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>🌍 Libellés en malgache</h2>
        <div className="settings-grid">
          <div className="setting-item">
            <label>Nouveau (Vaovao) :</label>
            <input
              type="text"
              value={settings.status_name_new}
              onChange={(e) => handleTextChange('status_name_new', e.target.value)}
              placeholder="Vaovao"
              disabled={saving === 'status_name_new'}
            />
            {saving === 'status_name_new' && <span className="saving-indicator">💾</span>}
          </div>

          <div className="setting-item">
            <label>En cours (Efa manao) :</label>
            <input
              type="text"
              value={settings.status_name_in_progress}
              onChange={(e) => handleTextChange('status_name_in_progress', e.target.value)}
              placeholder="Efa manao"
              disabled={saving === 'status_name_in_progress'}
            />
            {saving === 'status_name_in_progress' && <span className="saving-indicator">💾</span>}
          </div>

          <div className="setting-item">
            <label>Terminé (Vita) :</label>
            <input
              type="text"
              value={settings.status_name_done}
              onChange={(e) => handleTextChange('status_name_done', e.target.value)}
              placeholder="Vita"
              disabled={saving === 'status_name_done'}
            />
            {saving === 'status_name_done' && <span className="saving-indicator">💾</span>}
          </div>
        </div>
      </div>

      <div className="settings-section preview-section">
        <h3>Aperçu du Kanban</h3>
        <div className="kanban-preview">
          <div className="kanban-column" style={{ backgroundColor: settings.kanban_color_new + '40' }}>
            <h4 style={{ color: settings.kanban_color_new }}>{settings.status_name_new}</h4>
            <div className="kanban-card">Ticket exemple 1</div>
            <div className="kanban-card">Ticket exemple 2</div>
          </div>
          <div className="kanban-column" style={{ backgroundColor: settings.kanban_color_in_progress + '40' }}>
            <h4 style={{ color: settings.kanban_color_in_progress }}>{settings.status_name_in_progress}</h4>
            <div className="kanban-card">Ticket exemple 3</div>
          </div>
          <div className="kanban-column" style={{ backgroundColor: settings.kanban_color_done + '40' }}>
            <h4 style={{ color: settings.kanban_color_done }}>{settings.status_name_done}</h4>
            <div className="kanban-card">Ticket exemple 4</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KanbanSetting;