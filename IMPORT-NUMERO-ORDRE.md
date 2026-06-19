# Import CSV Mouvements — numéro d'ordre au lieu de l'id GLPI

## Besoin
Ne plus avoir à rechercher le vrai numéro de ticket GLPI (1251, 1252…) à chaque
import. L'utilisateur saisit désormais un **numéro d'ordre** simple : `1`, `2`, `3`…

## Comportement
- Dans la colonne `ticket` du CSV (et dans la saisie manuelle), le nombre est un
  **numéro d'ordre**, pas l'id GLPI.
- `1` = 1ᵉʳ ticket, `2` = 2ᵉ, etc. — la liste est triée par **id croissant**
  (le plus ancien = 1).
- Si le numéro d'ordre dépasse le nombre de tickets existants, la ligne est
  marquée en **erreur** (`numéro d'ordre N introuvable`).

Le format du fichier reste identique : `ticket,mvt,valeur,mode`.

### Exemple (`scenario.csv`)
```
ticket,mvt,valeur,mode
1,close,50,
2,close,150,
1,open,5,1
1,close,46,
1,open,10,4
2,open,10,3
2,close,300,
```

## Implémentation
Fichier modifié : `src/pages/BackOffice/CsvMvtImport.tsx`

- Ajout de `chargerTicketsTries()` — réutilise `glpiTicketService.listTickets()`
  et trie par id croissant.
- Ajout de `resoudreTicket(numeroOrdre, ticketsTries)` — convertit l'indice
  1-based en vrai id GLPI (`null` si hors limites).
- `onImporter()` et `onSaisieManuelle()` résolvent l'indice avant d'appeler la
  fonction métier `traiterLigne()`, qui reste inchangée (reçoit toujours un vrai id).
- Textes d'aide et placeholder mis à jour.

Aucune logique métier dupliquée, aucun nouveau fichier de code.

## Point d'attention
Les anciens CSV contenant de vrais id GLPI (ex. `1251`) ne fonctionnent plus tels
quels — c'est le comportement voulu. Il faut les ré-exprimer en numéros d'ordre.
