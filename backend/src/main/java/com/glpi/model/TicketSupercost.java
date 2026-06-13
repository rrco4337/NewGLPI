package com.glpi.model;

import jakarta.persistence.*;

@Entity
@Table(name = "ticket_supercosts")
public class TicketSupercost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long ticketId;
    private Integer batch;
    private String itemtype;
    private Long itemsId;
    private Double amount;

    public TicketSupercost() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getTicketId() { return ticketId; }
    public void setTicketId(Long ticketId) { this.ticketId = ticketId; }
    public Integer getBatch() { return batch; }
    public void setBatch(Integer batch) { this.batch = batch; }
    public String getItemtype() { return itemtype; }
    public void setItemtype(String itemtype) { this.itemtype = itemtype; }
    public Long getItemsId() { return itemsId; }
    public void setItemsId(Long itemsId) { this.itemsId = itemsId; }
    public Double getAmount() { return amount; }
    public void setAmount(Double amount) { this.amount = amount; }
}
