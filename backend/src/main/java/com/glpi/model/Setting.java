package com.glpi.model;

import jakarta.persistence.*;

@Entity
@Table(name = "settings")
public class Setting {
    
    @Id
    private String key;
    
    @Column(nullable = false)
    private String value;
    
    // Constructeur par défaut (obligatoire pour JPA)
    public Setting() {}
    
    public Setting(String key, String value) {
        this.key = key;
        this.value = value;
    }
    
    // Getters et Setters
    public String getKey() {
        return key;
    }
    
    public void setKey(String key) {
        this.key = key;
    }
    
    public String getValue() {
        return value;
    }
    
    public void setValue(String value) {
        this.value = value;
    }
}