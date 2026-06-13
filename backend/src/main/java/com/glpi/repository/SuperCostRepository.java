package com.glpi.repository;

import com.glpi.model.SuperCost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SuperCostRepository extends JpaRepository<SuperCost, Long> {
}