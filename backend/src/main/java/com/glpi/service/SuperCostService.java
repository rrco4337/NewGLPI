package com.glpi.service;

import com.glpi.dto.SuperCostDto;
import com.glpi.model.SuperCost;
import com.glpi.repository.SuperCostRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class SuperCostService {
    
    @Autowired
    private SuperCostRepository superCostRepository;

    
    
    public  SuperCost saveSuperCost(int idTicket, double supercostPrice, double glpicost, int idItem, String category ) {
       SuperCost supercost = new SuperCost(idTicket, supercostPrice, glpicost, idItem,category);
        return superCostRepository.save(supercost);
    }

    public List<SuperCostDto> getCostCloseResult(){
        return superCostRepository.getCostCloseResult();
    }
    
   
}