package com.glpi.dto.supercost;

public class ItemCostSummaryDto {
    private String itemtype;
    private Double superCost;
    private Double reopenCost;

    public ItemCostSummaryDto(String itemtype, Double superCost, Double reopenCost) {
        this.itemtype = itemtype;
        this.superCost = superCost;
        this.reopenCost = reopenCost;
    }

    public String getItemtype() { return itemtype; }
    public Double getSuperCost() { return superCost; }
    public Double getReopenCost() { return reopenCost; }
}
