# Fonctionnalité — Plafond de réouverture (Aléa 2) + vérif. annulations (Aléa 1)

## Aléa 1 — Gestion des annulations de réouverture
**Déjà couvert par l'existant** (`feature-supercost-annules-retablir`). Le tableau
« Liste des Super Cost annulés » de `ReopenList.tsx` enregistre toute action
« Annuler le dernier coût » (`cancelLastBatch` → mvt `cancel` → soft-delete `cancelled = 1`)
et propose **Rétablir**, qui replace le coût **exactement à sa position d'origine**
(son `batch`) via `POST /supercosts/:ticketId/:batch/restore`. Les frais de réouverture
étant recalculés dynamiquement à la lecture, les valeurs sont automatiquement recalculées
après annulation/rétablissement. Aucune modification supplémentaire nécessaire.

## Aléa 2 — Plafond de réouverture (%)

### Règle — plafond PAR TICKET, configurable par ticket
Le plafond se définit **ticket par ticket** : on choisit un ticket et on lui attribue un
pourcentage (un seul plafond par ticket, stocké en base).
`plafondMax(ticket) = (somme des Super Cost actifs DU ticket) × (plafond % du ticket / 100)`
Le total cumulé des frais de réouverture **d'un ticket** ne doit jamais dépasser le plafond
de ce ticket. À la création d'une réouverture, si elle dépasse le disponible du ticket, elle
est **automatiquement limitée** au montant restant (aucun dépassement, aucun refus dur). Si
elle est sous le plafond, rien n'est modifié. Un ticket sans plafond n'est pas limité.

### Point clé d'architecture
`GET /reopens` **recalcule** le montant à partir du `percent` stocké (il ignore le montant
en base). Le plafond se matérialise donc en **réduisant le `percent` effectif** stocké, pas
le montant — ainsi la limite est persistée et cohérente à l'affichage et dans tous les
recalculs (ajout/suppression/annulation/rétablissement de Super Cost).

### Modifications

**`server/api.ts`**
- Nouvelle table `ticket_reopen_ceilings (ticket_id PRIMARY KEY, percent)` ⇒ un seul plafond
  par ticket (créée dans le `CREATE TABLE IF NOT EXISTS`, aucune migration).
- `getCeilingPercent(ticketId)` lit le plafond du ticket. `sumActiveSuperCost(ticketId)`
  (base du ticket, `cancelled = 0`) et `sumReopenCosts(ticketId)` (total dynamique des
  réouvertures non fermées du ticket).
- `GET /api/item-supercosts/ceilings` : liste des plafonds par ticket.
- `PUT /api/item-supercosts/ceilings/:ticketId` : upsert (ou suppression si `percent` null).
- `POST /api/item-supercosts/reopen` : avant insertion, calcule
  `allowed = max(0, plafondMax(ticket) − utilisé(ticket))`. Si le total prévu de la
  réouverture dépasse `allowed`, le `percent` est mis à l'échelle `percent × allowed / prévu`
  pour tous les items du groupe (limitation proportionnelle exacte au disponible).

**`src/api/itemSuperCost.ts`** : type `TicketCeiling`, méthodes `listCeilings()` / `setCeiling()`.

**`src/pages/BackOffice/ReopenList.tsx`** (aucun CSS ajouté)
- Formulaire d'attribution : `<select>` du ticket (parmi ceux ayant un Super Cost) +
  champ `%` + bouton. Pré-remplit le `%` si le ticket a déjà un plafond. `%` vide ⇒ plafond
  supprimé.
- Maps par ticket (`superByTicket`, `reopenByTicket`) + `ceilings` (ticket → %), calculées
  côté client.
- Colonne « Plafond (ticket) » dans le tableau des réouvertures : `% · max … · dispo …`
  propre au ticket de la ligne, `—` si le ticket n'a pas de plafond.

### Notes
- Plafond vide ou `0` ⇒ aucune limite.
- Le « mode négligeable » mentionné dans la spec n'existe pas dans le modèle de données
  actuel (modes 1–4 : dernier/premier/moyenne/somme) ; aucune ligne à exclure. Un
  commentaire le documente dans `sumActiveSuperCost`.
- Les Super Cost annulés (`cancelled = 1`) sont exclus de la base du plafond.

### Vérification
1. `npx tsc --noEmit -p tsconfig.app.json` → aucune nouvelle erreur (seuls warnings
   préexistants hors périmètre).
2. Super Cost = 100, plafond = 30 % → réouverture de 40 % limitée à 30. Ajouter un Super
   Cost (total 150) → disponible recalculé à 45 automatiquement.
