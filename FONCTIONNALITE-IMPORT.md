# Fonctionnalité d'import de fichiers

## Vue d'ensemble

L'import permet de créer en masse des données GLPI à partir de fichiers CSV et d'un ZIP d'images, avec garantie transactionnelle : à la première erreur, tout ce qui a été créé est supprimé (rollback complet). Aucune donnée partielle ne peut rester dans GLPI.

---

## Fichiers attendus

| # | Fichier | Obligatoire | Description |
|---|---------|-------------|-------------|
| 1 | CSV matériels | Oui | Un matériel par ligne |
| 2 | CSV tickets | Oui | Un ticket par ligne |
| 3 | CSV coûts | Non | Un coût par ligne, rattaché à un ticket |
| 4 | ZIP images | Non | Photos à associer aux matériels |

L'import fonctionne avec les deux premiers fichiers seuls. Les coûts et les images sont traités seulement si leurs fichiers sont fournis.

---

## Colonnes CSV

### Feuille 1 — Matériels

| Colonne | Description | Exemple |
|---------|-------------|---------|
| `Name` | Identifiant unique du matériel (sert aussi à la déduplication et au matching des images) | `PC-ADM-001` |
| `Item_Type` | Type GLPI : `Computer`, `Monitor`, `Printer`, `Phone`, `NetworkEquipment`, `Peripheral`, `Rack`, `Enclosure`, `PDU`, `PassiveDCEquipment`, `Cable`, `Software`, `Appliance`, `Certificate`, `SoftwareLicense`, `Socket` | `Computer` |
| `Status` | Statut GLPI du matériel | `En stock` |
| `Location` | Lieu GLPI (créé s'il n'existe pas) | `Salle serveur` |
| `Manufacturer` | Fabricant (créé s'il n'existe pas) | `Dell` |
| `Model` | Modèle (créé s'il n'existe pas, ignoré si le type n'a pas d'endpoint modèle) | `OptiPlex 7090` |
| `Type` | Sous-type (ignoré si le type n'a pas d'endpoint type, ex : Enclosure, Software, Socket) | `Tour` |
| `Inventory_Number` | Numéro d'inventaire → champ `otherserial` | `INV-2024-001` |
| `User` | Utilisateur affecté (créé s'il n'existe pas) | `jean.dupont` |

### Feuille 2 — Tickets

| Colonne | Description | Exemple |
|---------|-------------|---------|
| `Ref_Ticket` | Référence interne (sert à lier les coûts) | `TK-001` |
| `Titre` | Titre du ticket (`name`) | `Panne disque dur` |
| `Description` | Corps du ticket (`content`) | `Disque dur défaillant sur PC-ADM-001` |
| `Type` | `Incident` ou `Demande` (insensible à la casse) | `Incident` |
| `Status` | Voir tableau des statuts ci-dessous | `Résolu` |
| `Priority` | Voir tableau des priorités ci-dessous | `Haute` |
| `Date` | Date au format `DD/MM/YYYY` | `15/01/2024` |
| `Heure` | Heure au format `HH:MM` | `09:30` |
| `Items` | JSON array des noms de matériels à lier | `["PC-ADM-001","MON-001"]` |

**Statuts acceptés (insensibles à la casse) :**

| Valeur CSV | Code GLPI |
|------------|-----------|
| `Nouveau`, `New` | 1 |
| `En cours`, `En cours (assigné)`, `In progress`, `Assigned` | 2 |
| `En cours (planifié)`, `Planned` | 3 |
| `En attente`, `Pending`, `Waiting` | 4 |
| `Résolu`, `Resolu`, `Solved`, `Resolved` | 5 |
| `Clos`, `Closed` | 6 |

**Priorités acceptées (insensibles à la casse) :**

| Valeur CSV | Code GLPI |
|------------|-----------|
| `Très basse`, `Very low` | 1 |
| `Basse`, `Low` | 2 |
| `Moyenne`, `Medium` | 3 — valeur par défaut |
| `Haute`, `High` | 4 |
| `Très haute`, `Very high`, `Critique`, `Critical` | 5 |
| `Majeure`, `Major` | 6 |

### Feuille 3 — Coûts

| Colonne | Description | Exemple |
|---------|-------------|---------|
| `Num_Ticket` | Référence ticket (doit correspondre à un `Ref_Ticket` de la feuille 2) | `TK-001` |
| `Duration_second` | Durée en secondes (entier) | `3600` |
| `Time_Cost` | Coût horaire (décimal, virgule ou point) | `45,50` |
| `Fixed_Cost` | Coût fixe (décimal, virgule ou point) | `120` |

---

## Séquence d'exécution

```
1. Validation des colonnes (avant toute écriture GLPI)
2. Matériels  →  déduplication  →  création par lot
3. Tickets    →  création unitaire  →  liens Item_Ticket par lot  →  statut final
4. Coûts      →  création par lot
5. Images     →  upload  →  liaison Document_Item
```

### Particularité des tickets Résolu/Clos

GLPI interdit d'associer un item à un ticket déjà Résolu (5) ou Clos (6). La stratégie appliquée :
1. Le ticket est créé en statut **Nouveau** (1).
2. Les liens `Item_Ticket` sont créés.
3. Le statut final est appliqué via un `PUT` séparé.

---

## Routage API v1 / v2

La plupart des types utilisent l'API REST v1 (`apirest.php`). Certains types absents de v1 sont routés vers l'API v2 (`api.php/v2`) via OAuth2.

| Type | API | Endpoint v2 | Classe GLPI (pour Item_Ticket) |
|------|-----|-------------|-------------------------------|
| `Socket` | v2 | `/Assets/Socket` | `Glpi\Socket` |
| Tous les autres | v1 | `/{ItemType}` | identique au type |

La classe GLPI complète (`Glpi\Socket`) est requise dans `Item_Ticket.itemtype` sous GLPI 11+ : le nom court `Socket` provoque un crash PHP 500.

**Types sans endpoint Type en v1** (catégorie ignorée silencieusement) : `Enclosure`, `Software`, `Socket`.

**Types sans endpoint Model en v1** (modèle ignoré silencieusement) : `Cable`, `Software`, `Appliance`, `Certificate`, `SoftwareLicense`, `Socket`.

---

## Déduplication des matériels

Avant toute création, chaque matériel est recherché par son `Name` exact dans GLPI :
- S'il existe déjà → ignoré, son id est enregistré dans le registre interne pour les liens de tickets et d'images.
- S'il n'existe pas → ajouté à la liste de création.

La recherche exacte utilise l'ancrage `^valeur$` sur le paramètre `searchText[name]` de l'API v1 (sans ancrage, GLPI fait un `contains` et peut retourner de faux positifs).

---

## Résolution des données de référence

Les entités de référence (fabricant, lieu, modèle, catégorie, utilisateur, statut matériel) sont résolues avec un cache partagé sur toute la durée de l'import :

- Si l'entité existe dans GLPI → son id est mis en cache.
- Si elle n'existe pas → elle est créée, son id est mis en cache.
- Toute occurrence suivante du même nom retourne directement depuis le cache, sans appel réseau.

Ces entités de référence **ne sont pas annulées lors d'un rollback** car elles peuvent être réutilisées ailleurs dans GLPI.

---

## Création par lot (batch)

Pour les types v1, les matériels et les coûts sont créés via `POST input:[…]` qui retourne une réponse `207 Multi-Status`. Chaque résultat individuel est vérifié. Les lots sont plafonnés à 50 éléments par requête.

Les types v2 (ex : `Socket`) ne supportent pas le format batch : ils sont créés individuellement.

---

## Transactions et rollback

Chaque entité créée est immédiatement enregistrée dans la transaction (`importTransaction.js`). En cas d'erreur sur n'importe quelle phase, le rollback supprime toutes les entités dans l'ordre inverse :

```
Document_Item → Document → TicketCost → Item_Ticket → Ticket → Matériel
```

La suppression utilise `DELETE` avec `force_purge: true` (suppression définitive, pas de corbeille GLPI).

---

## Images

Les images sont extraites du ZIP, filtrées (extensions `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`), puis converties en JPEG via la Canvas API avant upload (GLPI stocke nativement du JPEG).

La correspondance image ↔ matériel se fait sur le **nom de fichier sans extension** = `Name` du matériel.

Exemple : `PC-ADM-001.png` dans le ZIP → matériel dont le `Name` est `PC-ADM-001`.

Les artefacts macOS (`__MACOSX/`, `._`) sont ignorés automatiquement.

---

## Keepalive de session

Pour les imports longs, la session GLPI est vérifiée toutes les 10 entités via `GET /getFullSession`. Si la session a expiré, l'import s'arrête immédiatement avec un message explicite plutôt que de produire des erreurs de droits trompeuses.

---

## Retry réseau

Les requêtes GET, HEAD et DELETE sont relancées automatiquement jusqu'à 2 fois en cas d'erreur réseau ou de réponse HTTP 5xx (délai exponentiel : 300 ms, 600 ms). Les POST/PUT ne sont jamais relancés pour éviter les doublons.

---

## Progression et rapport

L'interface affiche en temps réel :
- La phase en cours (Matériels / Tickets / Coûts / Images / Annulation / Terminé)
- Le nombre d'éléments traités sur le total
- Le pourcentage global
- Le statut de chaque phase (en attente / actif / terminé / erreur / ignoré)

À la fin, un rapport détaillé est disponible pour chaque phase :

| Champ | Description |
|-------|-------------|
| `total` | Nombre de lignes traitées |
| `created` | Nombre d'éléments créés dans GLPI |
| `skipped` | Matériels ignorés car déjà existants |
| `noMatch` | Images sans matériel correspondant |
| `errors` | Nombre d'erreurs |
| `details` | Tableau ligne par ligne avec statut et id |

---

## Fichiers du flux

| Fichier | Rôle |
|---------|------|
| `src/pages/import/ImportPage.vue` | Page utilisateur de l'import |
| `src/composables/import/useFileImport.js` | Orchestration UI, validation, previews, progression |
| `src/services/import/importOrchestrator.js` | Séquenceur transactionnel |
| `src/services/import/importTransaction.js` | Suivi des créations et rollback |
| `src/services/import/csvParser.js` | Parsing CSV, validation des colonnes, conversion décimale |
| `src/services/import/glpiHelpers.js` | fetch retry, exactSearch, batchCreate, caches |
| `src/services/import/materialApi.js` | Création matériels, routing v1/v2, payload resolution |
| `src/services/import/ticketApi.js` | Création tickets, status/priority/type maps |
| `src/services/import/ticketCostApi.js` | Création coûts par lot |
| `src/services/import/imageApi.js` | Upload images, liaison Document_Item, lecture ZIP |
| `src/services/import/categoryApi.js` | Résolution types/catégories (find-or-create) |
| `src/services/import/modelApi.js` | Résolution modèles (find-or-create) |
| `src/services/import/manufacturerApi.js` | Résolution fabricants (find-or-create) |
| `src/services/import/locationApi.js` | Résolution lieux (find-or-create) |
| `src/services/import/userApi.js` | Résolution utilisateurs (find-or-create) |
| `src/services/auth/authSessionV2.js` | OAuth2 Bearer token pour l'API GLPI v2 |
