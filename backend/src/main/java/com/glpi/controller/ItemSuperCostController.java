package com.glpi.controller;

import com.glpi.dto.supercost.*;
import com.glpi.service.ItemSuperCostService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/item-supercosts")
public class ItemSuperCostController {

    @Autowired
    private ItemSuperCostService service;

    /** Crée un nouveau batch de supercost. Retourne le nb d'items tracked sauvegardés. */
    @PostMapping
    public ResponseEntity<?> addSuperCost(@RequestBody AddSuperCostRequest request) {
        int saved = service.addSuperCost(request.getTicketId(), request.getAmount(), request.getItems());
        return ResponseEntity.ok(Map.of("saved", saved));
    }

    /** Enregistre les frais de réouverture (percent% du dernier batch). */
    @PostMapping("/reopen")
    public ResponseEntity<?> addReopenCost(@RequestBody ReopenCostRequest request) {
        service.addReopenCost(request.getTicketId(), request.getPercent());
        return ResponseEntity.ok().build();
    }

    /** Annule le dernier batch de supercost. Retourne le nb de lignes supprimées. */
    @PostMapping("/cancel")
    public ResponseEntity<?> cancelLastBatch(@RequestBody CancelCostRequest request) {
        int removed = service.cancelLastBatch(request.getTicketId());
        return ResponseEntity.ok(Map.of("removed", removed));
    }

    /** Total du dernier batch pour un ticket (pour affichage dans le dialog de réouverture). */
    @GetMapping("/{ticketId}/last-batch-total")
    public ResponseEntity<Double> getLastBatchTotal(@PathVariable Long ticketId) {
        return ResponseEntity.ok(service.getLastBatchTotal(ticketId));
    }

    /** Agrégation supercost + reopencost par itemtype pour ItemsCostList. */
    @GetMapping
    public List<ItemCostSummaryDto> getItemCostSummaries() {
        return service.getItemCostSummaries();
    }

    /** Vide les deux tables (reset complet). */
    @PostMapping("/reset")
    public ResponseEntity<?> resetAll() {
        service.resetAll();
        return ResponseEntity.ok().build();
    }
}
