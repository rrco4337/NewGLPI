package com.glpi.service;

import com.glpi.model.Setting;
import com.glpi.repository.SettingRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class SettingService {
    
    @Autowired
    private SettingRepository settingRepository;
    
    public List<Setting> getAllSettings() {
        return settingRepository.findAll();
    }
    
    public Map<String, String> getSettingsMap() {
        return settingRepository.findAll().stream()
            .collect(Collectors.toMap(Setting::getKey, Setting::getValue));
    }
    
    public Setting updateSetting(String key, String value) {
        Setting setting = settingRepository.findById(key)
            .orElse(new Setting(key, value));
        setting.setValue(value);
        return settingRepository.save(setting);
    }
    
    public String getSetting(String key, String defaultValue) {
        return settingRepository.findById(key)
            .map(Setting::getValue)
            .orElse(defaultValue);
    }
}