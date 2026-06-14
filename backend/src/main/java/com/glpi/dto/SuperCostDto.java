package com.glpi.dto;

public class SuperCostDto {

   private int idTicket;
   private double supercost;

   private double glpicost;
   private String category;

public SuperCostDto(int idTicket, double supercost, double glpicost, String category) {
    this.idTicket = idTicket;
    this.supercost = supercost;
    this.glpicost = glpicost;
    this.category = category;
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

public String getCategory() {
    return category;
}

public void setCategory(String category) {
    this.category = category;
}

    
}
