package com.glpi.controller;

import com.glpi.model.Asset;
import com.glpi.repository.AssetRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/assets")
public class AssetController {

    private final AssetRepository assetRepository;

    public AssetController(AssetRepository assetRepository) {
        this.assetRepository = assetRepository;
    }

    @GetMapping
    public List<Asset> getAll() {
        return assetRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Asset> getById(@PathVariable Long id) {
        return assetRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Asset create(@Valid @RequestBody Asset asset) {
        return assetRepository.save(asset);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Asset> update(@PathVariable Long id, @Valid @RequestBody Asset updated) {
        return assetRepository.findById(id).map(asset -> {
            asset.setName(updated.getName());
            asset.setType(updated.getType());
            asset.setSerialNumber(updated.getSerialNumber());
            asset.setLocation(updated.getLocation());
            asset.setStatus(updated.getStatus());
            return ResponseEntity.ok(assetRepository.save(asset));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!assetRepository.existsById(id)) return ResponseEntity.notFound().build();
        assetRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
