package com.glpi.repository;

import com.glpi.model.SuperCost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import com.glpi.dto.SuperCostDto;
import java.util.List;

@Repository
public interface SuperCostRepository extends JpaRepository<SuperCost, Long> {


   @Query("""
    SELECT new com.glpi.dto.SuperCostDto(
        sc.idTicket,
        SUM(sc.supercost),
        SUM(sc.glpicost),
        sc.category
    )
    FROM SuperCost sc
    GROUP BY sc.idTicket, sc.category
""")
List<SuperCostDto> getCostCloseResult();


}