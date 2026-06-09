package com.glpi.controller;

import com.glpi.model.Setting;
import com.glpi.service.SettingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/backoffice/settings")
public class SettingController {
    
    @Autowired
    private SettingService settingService;
    
    @GetMapping
    public List<Setting> getAllSettings() {
        return settingService.getAllSettings();
    }
    
    @GetMapping("/{key}")
    public String getSetting(@PathVariable String key) {
        return settingService.getSetting(key, "");
    }
    
    @PutMapping("/{key}")
    public Setting updateSetting(@PathVariable String key, @RequestBody String value) {

          String cleanedValue = value;
    if (cleanedValue.startsWith("\"") && cleanedValue.endsWith("\"")) {
        cleanedValue = cleanedValue.substring(1, cleanedValue.length() - 1);
    }
        return settingService.updateSetting(key, cleanedValue);
    }
}