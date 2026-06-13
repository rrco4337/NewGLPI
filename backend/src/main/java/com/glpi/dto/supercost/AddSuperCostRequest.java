package com.glpi.dto.supercost;

import java.util.List;

public class AddSuperCostRequest {
    private Long ticketId;
    private Double amount;
    private List<ItemRef> items;

    public static class ItemRef {
        private String itemtype;
        private Long itemsId;

        public String getItemtype() { return itemtype; }
        public void setItemtype(String itemtype) { this.itemtype = itemtype; }
        public Long getItemsId() { return itemsId; }
        public void setItemsId(Long itemsId) { this.itemsId = itemsId; }
    }

    public Long getTicketId() { return ticketId; }
    public void setTicketId(Long ticketId) { this.ticketId = ticketId; }
    public Double getAmount() { return amount; }
    public void setAmount(Double amount) { this.amount = amount; }
    public List<ItemRef> getItems() { return items; }
    public void setItems(List<ItemRef> items) { this.items = items; }
}
