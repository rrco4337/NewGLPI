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
  
  const [originalSettings, setOriginalSettings] = useState<SettingsState>({} as SettingsState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
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
      setOriginalSettings(prev => ({ ...prev, ...settingsMap }));
    } catch (error) {
      console.error('Erreur chargement:', error);
      setMessage({ type: 'error', text: 'Erreur lors du chargement des paramètres' });
    } finally {
      setLoading(false);
    }
  };

  // Pour les couleurs : sauvegarde immédiate (c'est normal pour un color picker)
  const handleColorChange = async (key: string, value: string) => {
    // Mise à jour immédiate de l'UI
    setSettings(prev => ({ ...prev, [key]: value }));
    
    try {
      setSavingField(key);
      await KanbanSettingApi.updateSetting(key, value);
      setOriginalSettings(prev => ({ ...prev, [key]: value }));
      setMessage({ type: 'success', text: `${key} mis à jour` });
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      setMessage({ type: 'error', text: `Erreur lors de la mise à jour de ${key}` });
      // Recharger pour restaurer l'ancienne valeur
      await loadSettings();
    } finally {
      setSavingField(null);
    }
  };

  // Pour les textes : sauvegarde uniquement via bouton
  const handleTextLocalChange = (key: string, value: string) => {
    // Met à jour seulement l'UI locale
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveText = async (key: string) => {
    const newValue = settings[key];
    const oldValue = originalSettings[key];
    
    if (newValue === oldValue) return;
    
    try {
      setSavingField(key);
      await KanbanSettingApi.updateSetting(key, newValue);
      setOriginalSettings(prev => ({ ...prev, [key]: newValue }));
      setMessage({ type: 'success', text: `${key} mis à jour` });
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      setMessage({ type: 'error', text: `Erreur lors de la mise à jour de ${key}` });
      // Restaurer l'ancienne valeur
      setSettings(prev => ({ ...prev, [key]: oldValue }));
    } finally {
      setSavingField(null);
    }
  };

  const handleSaveAllTexts = async () => {
    setSaving(true);
    const changes = [];
    
    if (settings.status_name_new !== originalSettings.status_name_new) {
      changes.push(KanbanSettingApi.updateSetting('status_name_new', settings.status_name_new));
    }
    if (settings.status_name_in_progress !== originalSettings.status_name_in_progress) {
      changes.push(KanbanSettingApi.updateSetting('status_name_in_progress', settings.status_name_in_progress));
    }
    if (settings.status_name_done !== originalSettings.status_name_done) {
      changes.push(KanbanSettingApi.updateSetting('status_name_done', settings.status_name_done));
    }
    
    if (changes.length === 0) {
      setMessage({ type: 'success', text: 'Aucune modification' });
      setTimeout(() => setMessage(null), 2000);
      setSaving(false);
      return;
    }
    
    try {
      await Promise.all(changes);
      setOriginalSettings({ ...settings });
      setMessage({ type: 'success', text: 'Tous les libellés ont été mis à jour' });
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde' });
      await loadSettings();
    } finally {
      setSaving(false);
    }
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
        <h2>Couleurs du tableau Kanban</h2>
        <div className="settings-grid">
          <div className="setting-item">
            <label>Statut "Nouveau" :</label>
            <div className="color-preview" style={{ backgroundColor: settings.kanban_color_new }} />
            <input
              type="color"
              value={settings.kanban_color_new}
              onChange={(e) => handleColorChange('kanban_color_new', e.target.value)}
              disabled={savingField === 'kanban_color_new'}
            />
            {savingField === 'kanban_color_new' && <i className="bi bi-arrow-repeat saving-indicator" />}
          </div>

          <div className="setting-item">
            <label>Statut "En cours" :</label>
            <div className="color-preview" style={{ backgroundColor: settings.kanban_color_in_progress }} />
            <input
              type="color"
              value={settings.kanban_color_in_progress}
              onChange={(e) => handleColorChange('kanban_color_in_progress', e.target.value)}
              disabled={savingField === 'kanban_color_in_progress'}
            />
            {savingField === 'kanban_color_in_progress' && <i className="bi bi-arrow-repeat saving-indicator" />}
          </div>

          <div className="setting-item">
            <label>Statut "Terminé" :</label>
            <div className="color-preview" style={{ backgroundColor: settings.kanban_color_done }} />
            <input
              type="color"
              value={settings.kanban_color_done}
              onChange={(e) => handleColorChange('kanban_color_done', e.target.value)}
              disabled={savingField === 'kanban_color_done'}
            />
            {savingField === 'kanban_color_done' && <i className="bi bi-arrow-repeat saving-indicator" />}
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>Libellés en malgache</h2>
        <div className="settings-grid">
          <div className="setting-item">
            <label>Nouveau (Vaovao) :</label>
            <input
              type="text"
              value={settings.status_name_new}
              onChange={(e) => handleTextLocalChange('status_name_new', e.target.value)}
              placeholder="Vaovao"
              disabled={savingField === 'status_name_new'}
            />
            <button
              className="save-text-btn"
              onClick={() => handleSaveText('status_name_new')}
              disabled={savingField === 'status_name_new' || settings.status_name_new === originalSettings.status_name_new}
            >
              {savingField === 'status_name_new'
                ? <i className="bi bi-arrow-repeat saving-indicator" />
                : <><i className="bi bi-check2" /> Enregistrer</>}
            </button>
          </div>

          <div className="setting-item">
            <label>En cours (Efa manao) :</label>
            <input
              type="text"
              value={settings.status_name_in_progress}
              onChange={(e) => handleTextLocalChange('status_name_in_progress', e.target.value)}
              placeholder="Efa manao"
              disabled={savingField === 'status_name_in_progress'}
            />
            <button
              className="save-text-btn"
              onClick={() => handleSaveText('status_name_in_progress')}
              disabled={savingField === 'status_name_in_progress' || settings.status_name_in_progress === originalSettings.status_name_in_progress}
            >
              {savingField === 'status_name_in_progress'
                ? <i className="bi bi-arrow-repeat saving-indicator" />
                : <><i className="bi bi-check2" /> Enregistrer</>}
            </button>
          </div>

          <div className="setting-item">
            <label>Terminé (Vita) :</label>
            <input
              type="text"
              value={settings.status_name_done}
              onChange={(e) => handleTextLocalChange('status_name_done', e.target.value)}
              placeholder="Vita"
              disabled={savingField === 'status_name_done'}
            />
            <button
              className="save-text-btn"
              onClick={() => handleSaveText('status_name_done')}
              disabled={savingField === 'status_name_done' || settings.status_name_done === originalSettings.status_name_done}
            >
              {savingField === 'status_name_done'
                ? <i className="bi bi-arrow-repeat saving-indicator" />
                : <><i className="bi bi-check2" /> Enregistrer</>}
            </button>
          </div>
        </div>
        
        <div className="settings-actions">
          <button 
            className="save-all-btn"
            onClick={handleSaveAllTexts}
            disabled={saving}
          >
            {saving
            ? <><i className="bi bi-arrow-repeat saving-indicator" /> Enregistrement...</>
            : <><i className="bi bi-floppy" /> Enregistrer tous les libellés</>}
          </button>
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