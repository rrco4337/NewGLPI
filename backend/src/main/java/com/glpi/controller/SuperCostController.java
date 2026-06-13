package com.glpi.controller;

import com.glpi.model.SuperCost;
import com.glpi.service.SuperCostService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/backoffice/SuperCost")
@CrossOrigin(origins = {
    "http://localhost:5173",  // Vite par défaut
    "http://localhost:3000",   // React create-react-app
    "http://localhost:8080"    // Autres
})  
public class SuperCostController {

    @Autowired
    private SuperCostService superCostService;
    
   
    

    
    @PostMapping("/{IdTicket}")
    public SuperCost createSuperCost(@PathVariable int IdTicket, 
                                    @RequestBody SuperCost supercost
                         ) {

       return superCostService.saveSuperCost(IdTicket,supercost.getSupercost(),supercost.getGlpicost(),supercost.getIdItem(),supercost.getCategory());

    }

}