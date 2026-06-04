package com.glpi.repository;

import com.glpi.model.Asset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AssetRepository extends JpaRepository<Asset, Long> {
    List<Asset> findByType(String type);
    List<Asset> findByStatus(String status);
}
