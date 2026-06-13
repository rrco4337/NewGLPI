package com.glpi.repository;

import com.glpi.model.TicketReopenCost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TicketReopenCostRepository extends JpaRepository<TicketReopenCost, Long> {

    @Query("SELECT t.itemtype, SUM(t.amount) FROM TicketReopenCost t GROUP BY t.itemtype")
    List<Object[]> sumByItemtype();
}
