package com.glpi.service;

import com.glpi.dto.supercost.AddSuperCostRequest;
import com.glpi.dto.supercost.ItemCostSummaryDto;
import com.glpi.model.TicketReopenCost;
import com.glpi.model.TicketSupercost;
import com.glpi.repository.TicketReopenCostRepository;
import com.glpi.repository.TicketSupercostRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class ItemSuperCostService {

    private static final Set<String> TRACKED_TYPES = Set.of("Computer", "Phone", "Monitor");

    @Autowired
    private TicketSupercostRepository supercostRepo;

    @Autowired
    private TicketReopenCostRepository reopenCostRepo;

    /**
     * Crée un nouveau batch de supercost pour un ticket.
     * Le montant est réparti à parts égales entre les items suivis (Computer, Phone, Monitor).
     * @return nombre d'items tracked sauvegardés (0 si aucun item suivi)
     */
    @Transactional
    public int addSuperCost(Long ticketId, Double amount, List<AddSuperCostRequest.ItemRef> items) {
        List<AddSuperCostRequest.ItemRef> tracked = items.stream()
            .filter(i -> TRACKED_TYPES.contains(i.getItemtype()))
            .collect(Collectors.toList());
        if (tracked.isEmpty()) return 0;

        int nextBatch = supercostRepo.findMaxBatch(ticketId).orElse(0) + 1;
        double share = amount / tracked.size();

        for (var item : tracked) {
            TicketSupercost sc = new TicketSupercost();
            sc.setTicketId(ticketId);
            sc.setBatch(nextBatch);
            sc.setItemtype(item.getItemtype());
            sc.setItemsId(item.getItemsId());
            sc.setAmount(share);
            supercostRepo.save(sc);
        }
        return tracked.size();
    }

    /**
     * Supprime uniquement le dernier batch (MAX(batch)) du ticket.
     * Ne touche pas ticket_reopen_costs.
     * @return nombre de lignes supprimées
     */
    @Transactional
    public int cancelLastBatch(Long ticketId) {
        Optional<Integer> maxBatch = supercostRepo.findMaxBatch(ticketId);
        if (maxBatch.isEmpty()) return 0;
        return supercostRepo.deleteByTicketIdAndBatch(ticketId, maxBatch.get());
    }

    /**
     * Calcule et stocke les frais de réouverture = percent% appliqué au dernier batch de supercost.
     * Si aucun supercost précédent → rien n'est enregistré.
     */
    @Transactional
    public void addReopenCost(Long ticketId, Double percent) {
        Optional<Integer> maxBatch = supercostRepo.findMaxBatch(ticketId);
        if (maxBatch.isEmpty()) return;

        List<TicketSupercost> lastBatch = supercostRepo.findByTicketIdAndBatch(ticketId, maxBatch.get());
        for (var sc : lastBatch) {
            TicketReopenCost rc = new TicketReopenCost();
            rc.setTicketId(ticketId);
            rc.setBatch(maxBatch.get());
            rc.setItemtype(sc.getItemtype());
            rc.setItemsId(sc.getItemsId());
            rc.setAmount(sc.getAmount() * (percent / 100.0));
            reopenCostRepo.save(rc);
        }
    }

    /**
     * Retourne le total du dernier batch de supercost pour un ticket (pour affichage dans le dialog).
     */
    public double getLastBatchTotal(Long ticketId) {
        Optional<Integer> maxBatch = supercostRepo.findMaxBatch(ticketId);
        if (maxBatch.isEmpty()) return 0.0;
        return supercostRepo.findByTicketIdAndBatch(ticketId, maxBatch.get())
            .stream().mapToDouble(TicketSupercost::getAmount).sum();
    }

    /**
     * Agrège supercost et reopencost par itemtype pour l'écran ItemsCostList.
     */
    public List<ItemCostSummaryDto> getItemCostSummaries() {
        Map<String, Double> superCosts = new HashMap<>();
        for (Object[] row : supercostRepo.sumByItemtype()) {
            superCosts.put((String) row[0], ((Number) row[1]).doubleValue());
        }
        Map<String, Double> reopenCosts = new HashMap<>();
        for (Object[] row : reopenCostRepo.sumByItemtype()) {
            reopenCosts.put((String) row[0], ((Number) row[1]).doubleValue());
        }
        Set<String> allTypes = new HashSet<>();
        allTypes.addAll(superCosts.keySet());
        allTypes.addAll(reopenCosts.keySet());
        return allTypes.stream()
            .map(t -> new ItemCostSummaryDto(
                t,
                superCosts.getOrDefault(t, 0.0),
                reopenCosts.getOrDefault(t, 0.0)
            ))
            .sorted(Comparator.comparing(ItemCostSummaryDto::getItemtype))
            .collect(Collectors.toList());
    }

    @Transactional
    public void resetAll() {
        supercostRepo.deleteAll();
        reopenCostRepo.deleteAll();
    }
}
