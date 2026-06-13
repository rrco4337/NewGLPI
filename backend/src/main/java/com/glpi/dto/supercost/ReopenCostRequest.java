package com.glpi.dto.supercost;

public class ReopenCostRequest {
    private Long ticketId;
    private Double percent;

    public Long getTicketId() { return ticketId; }
    public void setTicketId(Long ticketId) { this.ticketId = ticketId; }
    public Double getPercent() { return percent; }
    public void setPercent(Double percent) { this.percent = percent; }
}
