package com.glpi.model;

import jakarta.persistence.*;

@Entity
@Table(name = "supercost")
public class SuperCost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    
    private int idTicket;
    
    @Column(nullable = false)
    private double supercost;

    private double glpicost;

    private int idItem;

    private String category;

    public SuperCost() {

    }


    public SuperCost(int idTicket, double supercost, double glpicost, int idItem, String category) {
        this.idTicket = idTicket;
        this.supercost = supercost;
        this.glpicost = glpicost;
        this.idItem = idItem;
        this.category = category;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public int getIdTicket() {
        return idTicket;
    }

    public void setIdTicket(int idTicket) {
        this.idTicket = idTicket;
    }

    public double getSupercost() {
        return supercost;
    }

    public void setSupercost(double supercost) {
        this.supercost = supercost;
    }

    public double getGlpicost() {
        return glpicost;
    }

    public void setGlpicost(double glpicost) {
        this.glpicost = glpicost;
    }

    public int getIdItem() {
        return idItem;
    }

    public void setIdItem(int idItem) {
        this.idItem = idItem;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }


    


    

}