import { useState, useEffect } from 'react';
import { KanbanSettingApi } from '@/api/kanbanSetting';  // Assure-toi que le chemin est bon

interface Settings {
  kanban_color_new: string;
  kanban_color_in_progress: string;
  kanban_color_done: string;
  status_name_new: string;
  status_name_in_progress: string;
  status_name_done: string;
}

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>({
    kanban_color_new: '#FFE5E5',
    kanban_color_in_progress: '#FFF4E5',
    kanban_color_done: '#E5FFE5',
    status_name_new: 'Nouveau',
    status_name_in_progress: 'En cours',
    status_name_done: 'Terminé'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settingsMap = await KanbanSettingApi.getSettingsMap();
      setSettings({
        kanban_color_new: settingsMap['kanban_color_new'] || '#FFE5E5',
        kanban_color_in_progress: settingsMap['kanban_color_in_progress'] || '#FFF4E5',
        kanban_color_done: settingsMap['kanban_color_done'] || '#E5FFE5',
        status_name_new: settingsMap['status_name_new'] || 'Nouveau',
        status_name_in_progress: settingsMap['status_name_in_progress'] || 'En cours',
        status_name_done: settingsMap['status_name_done'] || 'Terminé',
      });
    } catch (error) {
      console.error('Erreur chargement paramètres Kanban:', error);
    } finally {
      setLoading(false);
    }
  };

  return { settings, loading };
};