# Import — Différences avec le projet de référence

> Ce document liste ce qui nous différencie du projet de référence (`import-validation.md`).  
> La structure suit la même organisation pour faciliter la comparaison.

---

## URLs et configuration API

| Variable | Projet de référence | Notre projet |
|---|---|---|
| Base API | `VITE_API_BASE_URL` (`/api` proxifiée) | `VITE_GLPI_BASE_URL` (URL complète, ex. `http://localhost:8080`) |
| API locale | `VITE_LOCAL_API_URL` (serveur Express Node.js séparé) | — (pas de serveur intermédiaire) |
| Auth | OAuth via `VITE_OAUTH_CLIENT_ID` + `VITE_OAUTH_CLIENT_SECRET` | Session token GLPI classique (`VITE_GLPI_SESSION_TOKEN`) + OAuth V2 (`VITE_GLPI_V2_CLIENT_ID/SECRET`) |
| Upload d'images | `VITE_GLPI_USER_TOKEN` requis (API legacy `/api/v1`) | Session token standard suffisant (API REST v1 proxifiée) |
| Code d'accès | `VITE_GLPI_USERNAME` / `VITE_GLPI_PASSWORD` (affiché sur formulaire) | `VITE_GLPI_DEFAULT_USERNAME` (interne, non exposé) |

**Différence clé** : notre projet n'a pas de serveur Express intermédiaire — toutes les requêtes passent directement par le proxy Vite vers GLPI.

---

## Pipeline de validation à l'import

```
Fichiers CSV + ZIP
       │
       ▼
validateImport()                    ← point d'entrée
       │
       ├─ validateCsv1()            ← Inventaire
       │       └─ par ligne + doublon Name/inventory_number
       │
       ├─ validateCsv2()            ← Tickets
       │       └─ par ligne (ref_ticket, date+heure, titre)
       │
       ├─ validateCsv3()            ← Coûts
       │       └─ num_ticket → ref_ticket (CSV2)
       │
       └─ validateImages()          ← ZIP (avertissements)
               ├─ doublons de basename
               ├─ images sans asset correspondant
               └─ assets sans image correspondante
```

**Différence** : pas de vérification inter-feuilles `Items (F2) → noms connus (F1 ou GLPI)` à la validation — cette vérification est déplacée à l'**exécution** (phase 4, lors de la création des tickets).

---

## Fichiers CSV — Nommage des colonnes

### Synonymes multilingues (absent du projet de référence)

Notre projet accepte des alias **FR, EN et malgache** pour chaque colonne :

| Colonne canonique | Exemples d'alias acceptés |
|---|---|
| `name` | `nom`, `anarana`, `designation`, `label` |
| `item_type` | `karazana`, `type_objet`, `asset_type` |
| `status` | `statut`, `toetry`, `état` |
| `location` | `localisation`, `toerana`, `salle` |
| `user` | `utilisateur`, `mpampiasa`, `assigned_to` |
| `ref_ticket` | `nifankaiky`, `num`, `ticket_ref` |
| `date` | `daty`, `daty_namorana`, `creation_date` |
| `heure` | `hora`, `fotoana`, `time_created` |
| `titre` | `lohateny`, `subject`, `objet` |
| `items` | `fitaovana`, `equipements`, `linked_items` |

### Feuille 2 — Différences de colonnes

| Colonne | Projet de référence | Notre projet |
|---|---|---|
| Type ticket | `Type` | `ticket_type` (alias : `type`, `type_ticket`, `karazana_taratasy`) |
| Valeurs `Type` | `incident` / `request` / `demande` | `1` (incident) / `2` (demande) — libellés FR acceptés aussi |
| `Description` | requise | optionnelle (defaults à `""`) |
| `Status` | enum texte étendu | enum entier 1–6 ou libellés FR/EN |
| `Priority` | `1`–`5` ou libellés | idem + `laharam-pony` (malgache) |

---

## Règles de validation par cellule

| Règle | Projet de référence | Notre projet |
|---|---|---|
| `date` | `JJ/MM/AAAA` uniquement | Multiple formats : `YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY`, `01 January 2026`, noms de mois FR/EN/malgache |
| `heure` | `HH:MM` uniquement | `HH:MM:SS`, `08h30`, `08h30min`, `8:30 PM`, `8 PM` |
| `nombre-fr` | virgule FR acceptée | virgule **et** point acceptés |
| `ref_ticket` | texte requis (libre) | doit être un entier > 0 **ou** format `PREFIXE-CHIFFRES` (ex. `TK-001`) |
| `inventory_number` | optionnel, pas de règle | optionnel mais **avertissement** si vide ; doit être **unique** si fourni |
| `status` (asset) | optionnel, pas de règle | **avertissement** si vide |

---

## Types de matériel (`Item_Type`)

### Présent chez nous, absent du projet de référence

| Type GLPI | Nos alias |
|---|---|
| `ConsumableItem` | `consumable`, `consommable`, `consommables` |

### Présent dans le projet de référence, absent chez nous

| Type GLPI | Raison |
|---|---|
| `CartridgeItem` | Non implémenté (pas de route High-Level ni legacy dans notre orchestrateur) |
| `Unmanaged` | Non implémenté |

### Différence de routage

| Type | Projet de référence | Notre projet |
|---|---|---|
| `CartridgeItem`, `ConsumableItem` | API legacy `/apirest.php` + `VITE_GLPI_USER_TOKEN` | `ConsumableItem` via REST v1 standard ; `CartridgeItem` absent |
| `Socket` | `/Assets/Socket` (High-Level) | Route vers **API v2** (`/api.php/v2.3/Assets/Socket`) — la v1 n'expose pas ce type |

---

## Gestion des images ZIP

| Aspect | Projet de référence | Notre projet |
|---|---|---|
| Détection du format réel | Magic bytes (lecture header binaire) | `createImageBitmap()` (navigateur) |
| Action sur format incorrect | Ré-étiquetage de l'extension (JPEG nommé `.png` → `.jpg`) | **Conversion** : PNG / WebP / GIF convertis en JPEG via Canvas (qualité 0.92) avant upload |
| Formats acceptés | jpg, jpeg, png (+ tout format détecté comme JPEG) | jpg, jpeg, png, webp, gif |
| Doublons de basename | Non mentionné | Détectés et signalés comme avertissements |

---

## Structure des erreurs retournées

### Notre structure (différente)

```ts
interface ValidationError {
  rowIndex: number          // ligne 1-based ; -1 = erreur d'en-tête
  column: string            // nom de colonne canonique
  message: string           // message en français
  severity: 'error' | 'warning'   // ← sévérité explicite (absent du projet de référence)
}
```

**Différences vs projet de référence** :
- Pas de champ `fichier` (la feuille est portée par la structure parente `csv1/csv2/csv3`)
- Pas de champ `valeur` (valeur fautive non incluse dans l'erreur)
- Champ `severity` ajouté : distingue les erreurs bloquantes des avertissements au niveau cellule

### Notre résultat de validation

```ts
interface ValidationSummary {
  csv1: { parsed: Asset[];    errors: ValidationError[]; hasHardErrors: boolean }
  csv2: { parsed: Ticket[];   errors: ValidationError[]; hasHardErrors: boolean }
  csv3: { parsed: Cost[];     errors: ValidationError[]; hasHardErrors: boolean }
  images: ImageValidationResult
  canImport: boolean    // false si au moins un 'error' dans n'importe quelle feuille
}
```

**Différence** : résultat splitté par feuille (vs objet plat `{ ok, erreurs, donnees }` dans le projet de référence).

### Rapport d'import (absent du projet de référence)

```ts
interface ImportReport {
  success: boolean
  rolledBack: boolean           // vrai si l'import a échoué et a été annulé
  rollbackErrors: string[]
  created: {
    users: number
    computers: number
    monitors: number
    otherAssets: number
    tickets: number
    documents: number
    costs: number
    itemLinks: number
  }
  imageWarnings: string[]
  errors: string[]
}
```

---

## Fonctionnalités absentes du projet de référence

### 1. Création automatique de comptes utilisateurs

Si la colonne `user` référence un nom absent de GLPI, notre système **crée l'utilisateur à la volée** :
- Format attendu : `"Nom Prénom"` → login `nom.prenom`
- Mot de passe par défaut : `GlpiImport@2026`
- Création en lots de 5

### 2. Résolution et création automatique des listes déroulantes

Avant l'import, notre orchestrateur précharge et **crée si absents** :
- États (`State`)
- Localisations (`Location`)
- Fabricants (`Manufacturer`)
- Modèles (par type de matériel : `ComputerModel`, `MonitorModel`, etc.)
- Types de câble (`CableType`), modèles de prise (`SocketModel`)

Le projet de référence suppose que ces valeurs existent déjà dans GLPI.

### 3. Rollback transactionnel

En cas d'échec à n'importe quelle phase, notre système **supprime automatiquement** tout ce qui a été créé (ordre inverse) :
```
TicketCost → Item_Ticket → Ticket → Document_Item → Document → Assets
```
Utilise `force_purge=1` ; tolère les 404 (déjà supprimé).

### 4. Phases d'exécution explicites

Notre orchestrateur s'exécute en **6 phases** ordonnées :
1. Résolution des dropdowns
2. Création des utilisateurs manquants
3. Création des assets (Computer, Monitor, puis autres — par lots de 5)
4. Upload des images (séquentiel — verrou de session PHP GLPI)
5. Création des tickets + liens Item_Ticket
6. Création des coûts

### 5. Statut ticket en deux temps (phase 5)

Les tickets sont d'abord créés avec `status=1` (New) pour permettre la liaison des assets (`Item_Ticket`), puis **mis à jour** vers le statut final. GLPI interdit les liens sur certains statuts terminaux.

---

## Cas d'import partiel

| Cas | Projet de référence | Notre projet |
|---|---|---|
| CSV3 sans CSV2 | Chaque ligne → erreur `Feuille 2 non fournie` | Identique |
| CSV2 avec `Items` absents | Bloqué si GLPI injoignable | Avertissement à la validation ; tentative d'association à l'exécution |
| GLPI injoignable | Seule F1 fait foi | Validation locale uniquement (pas de vérification des assets existants) |
| CSV1 seul | Supporté | Supporté |
| CSV2 seul (sans CSV1) | Supporté | Supporté — les `items` référencés doivent exister dans GLPI |
