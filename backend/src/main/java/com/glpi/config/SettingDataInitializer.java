package com.glpi.config;

import com.glpi.model.Setting;
import com.glpi.repository.SettingRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class SettingDataInitializer implements CommandLineRunner {
    
    @Autowired
    private SettingRepository settingRepository;
    
    @Override
    public void run(String... args) throws Exception {
        // Vérifie si la table est vide
        if (settingRepository.count() == 0) {
            System.out.println("=== Initialisation des paramètres par défaut ===");
            
            // Couleurs du Kanban
            settingRepository.save(new Setting("kanban_color_new", "#FFE5E5"));
            settingRepository.save(new Setting("kanban_color_in_progress", "#FFF4E5"));
            settingRepository.save(new Setting("kanban_color_done", "#E5FFE5"));
            
            // Libellés en malgache
            settingRepository.save(new Setting("status_name_new", "Vaovao"));
            settingRepository.save(new Setting("status_name_in_progress", "Efa manao"));
            settingRepository.save(new Setting("status_name_done", "Vita"));        
            System.out.println("✅ " + settingRepository.count() + " paramètres initialisés");
        } else {
            System.out.println("📦 Base déjà initialisée avec " + settingRepository.count() + " paramètres");
        }
    }
}