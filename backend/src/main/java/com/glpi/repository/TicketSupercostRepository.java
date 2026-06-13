package com.glpi.repository;

import com.glpi.model.TicketSupercost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TicketSupercostRepository extends JpaRepository<TicketSupercost, Long> {

    @Query("SELECT MAX(t.batch) FROM TicketSupercost t WHERE t.ticketId = :ticketId")
    Optional<Integer> findMaxBatch(@Param("ticketId") Long ticketId);

    List<TicketSupercost> findByTicketIdAndBatch(Long ticketId, Integer batch);

    @Modifying
    @Query("DELETE FROM TicketSupercost t WHERE t.ticketId = :ticketId AND t.batch = :batch")
    int deleteByTicketIdAndBatch(@Param("ticketId") Long ticketId, @Param("batch") Integer batch);

    @Query("SELECT t.itemtype, SUM(t.amount) FROM TicketSupercost t GROUP BY t.itemtype")
    List<Object[]> sumByItemtype();
}
