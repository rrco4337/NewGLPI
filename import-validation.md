# Import — Validation & URLs

## URLs et configuration API

Toutes les URLs sont lues depuis les variables d'environnement Vite (`.env`).

| Variable | Défaut | Rôle |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | Base de l'API GLPI High-Level (proxifiée en dev) |
| `VITE_LOCAL_API_URL` | `http://localhost:3001/api` | Serveur Express local (Node.js) |
| `VITE_OAUTH_CLIENT_ID` | — | Client OAuth GLPI |
| `VITE_OAUTH_CLIENT_SECRET` | — | Secret OAuth GLPI |
| `VITE_OAUTH_SCOPES` | `api user email` | Scopes OAuth demandés au login |
| `VITE_GLPI_USER_TOKEN` | — | Jeton d'API personnel (requis pour upload d'images via `/api/v1`) |
| `VITE_GLPI_APP_TOKEN` | — | App-Token GLPI (optionnel) |
| `VITE_GLPI_USERNAME` | `glpi` | Identifiant pour la connexion par code unique |
| `VITE_GLPI_PASSWORD` | `glpi` | Code d'accès affiché sur le formulaire |

> `VITE_GLPI_USER_TOKEN` est obligatoire uniquement pour l'upload d'images (documents).  
> L'API OAuth ne gère pas l'envoi de fichiers — l'API REST legacy `/api/v1` est utilisée à la place.

---

## Pipeline de validation à l'import

```
Fichiers CSV + ZIP
       │
       ▼
validerImport()                 ← point d'entrée
       │
       ├─ validerFichier()      ← par CSV (Feuille 1, 2, 3)
       │       │
       │       └─ validerCellule()   ← par cellule
       │
       ├─ cohérence inter-feuilles
       │       ├─ doublons Name / Ref_Ticket
       │       ├─ Items (F2) → noms connus (F1 ou GLPI)
       │       └─ Num_Ticket (F3) → Ref_Ticket (F2)
       │
       └─ validation ZIP images (avertissements)
               ├─ images sans asset correspondant
               └─ assets sans image correspondante
```

---

## Fichiers CSV attendus

### Feuille 1 — Inventaire (`SCHEMA_INVENTAIRE`)

| Colonne | Règle | Notes |
|---|---|---|
| `Name` | texte (requis) | Clé primaire — doit être unique dans le fichier |
| `Status` | texte-optionnel | Ignoré si le type ne l'expose pas |
| `Location` | texte-optionnel | |
| `Manufacturer` | texte-optionnel | |
| `Item_Type` | enum | Voir table des types ci-dessous |
| `Model` | texte-optionnel | |
| `Inventory_Number` | texte-optionnel | |
| `User` | texte-optionnel | |

### Feuille 2 — Tickets (`SCHEMA_TICKETS`)

| Colonne | Règle | Notes |
|---|---|---|
| `Ref_Ticket` | texte (requis) | Clé interne (ex. `TK-001`) — jamais envoyée à GLPI |
| `Date` | date `JJ/MM/AAAA` | Converti en `AAAA-MM-JJ` |
| `Heure` | heure `HH:MM` | Converti en `HH:MM:SS` |
| `Type` | enum | `incident` / `request` / `demande` |
| `Titre` | texte (requis) | |
| `Description` | texte (requis) | |
| `Status` | enum | `new`, `assigned`, `planned`, `pending`, `solved`, `closed` + variantes FR |
| `Priority` | enum | `1`–`5` ou libellés FR/EN (`low`, `haute`…) |
| `Items` | json-array | Ex. `["PC-ADM-001"]` — chaque nom doit exister en F1 ou dans GLPI |

### Feuille 3 — Coûts (`SCHEMA_COUTS`)

| Colonne | Règle | Notes |
|---|---|---|
| `Num_Ticket` | texte (requis) | Doit correspondre à un `Ref_Ticket` de la F2 |
| `Duration_second` | nombre ≥ 0 | Décimal virgule FR accepté — arrondi à l'entier (GLPI stocke des secondes entières) |
| `Time_Cost` | nombre ≥ 0 | |
| `Fixed_Cost` | nombre ≥ 0 | |

---

## Règles de validation par cellule

| Règle | Format attendu | Comportement en erreur |
|---|---|---|
| `texte` | Non vide | `valeur requise` |
| `texte-optionnel` | Libre | Toujours valide |
| `entier` | `/^\d+$/` | `entier positif attendu` |
| `nombre-fr` | Décimal, virgule FR acceptée | `nombre positif attendu` |
| `date-ddmmyyyy` | `JJ/MM/AAAA` + date existante | `format attendu JJ/MM/AAAA` ou `date inexistante` |
| `heure-hhmm` | `HH:MM` (00-23, 00-59) | `format attendu HH:MM` ou `heure invalide` |
| `enum` | Valeur dans la table (insensible à la casse) | Liste des valeurs acceptées dans le message |
| `json-array` | Tableau JSON de chaînes ou vide | `tableau JSON invalide` ou `tableau de chaînes attendu` |

---

## Types de matériel (`Item_Type`)

Les libellés FR et EN sont acceptés (insensible à la casse) :

| Codes acceptés | ItemType GLPI | Endpoint High-Level |
|---|---|---|
| `computer`, `ordinateur`, `pc`, `laptop`, `server`… | `Computer` | `/Assets/Computer` |
| `monitor`, `moniteur`, `écran`, `screen` | `Monitor` | `/Assets/Monitor` |
| `networkequipment`, `switch`, `router`, `réseau`… | `NetworkEquipment` | `/Assets/NetworkEquipment` |
| `peripheral`, `périphérique`, `device` | `Peripheral` | `/Assets/Peripheral` |
| `phone`, `téléphone`, `smartphone`, `mobile` | `Phone` | `/Assets/Phone` |
| `printer`, `imprimante` | `Printer` | `/Assets/Printer` |
| `rack`, `baie` | `Rack` | `/Assets/Rack` |
| `enclosure`, `chassis`, `châssis` | `Enclosure` | `/Assets/Enclosure` |
| `pdu`, `bandeau de prises` | `PDU` | `/Assets/PDU` |
| `passivedcequipment`, `équipement passif`… | `PassiveDCEquipment` | `/Assets/PassiveDCEquipment` |
| `software`, `logiciel` | `Software` | `/Assets/Software` |
| `softwarelicense`, `licence`… | `SoftwareLicense` | `/Assets/SoftwareLicense` |
| `certificate`, `certificat` | `Certificate` | `/Assets/Certificate` |
| `cable`, `câble` | `Cable` | `/Assets/Cable` |
| `socket`, `prise` | `Socket` | `/Assets/Socket` |
| `appliance`, `applicatif`, `appareil` | `Appliance` | `/Assets/Appliance` |
| `unmanaged`, `matériel non géré`… | `Unmanaged` | `/Assets/Unmanaged` |
| `cartouche`, `cartridgeitem`… | `CartridgeItem` | via API legacy `/apirest.php` |
| `consommable`, `consumableitem`… | `ConsumableItem` | via API legacy `/apirest.php` |

> `CartridgeItem` et `ConsumableItem` n'ont pas de route High-Level dans GLPI —  
> ils sont créés via l'API REST legacy et nécessitent `VITE_GLPI_USER_TOKEN`.

---

## Structure des erreurs retournées

```ts
interface ErreurValidation {
  fichier: string       // ex. "Feuille 1 (Inventaire)"
  ligne: number | null  // numéro de ligne CSV (1-based), null = erreur d'en-tête
  colonne: string       // nom de la colonne, ou "—"
  valeur: string        // valeur fautive (tronquée à 40 chars)
  message: string       // description de l'erreur
}
```

```ts
interface ResultatValidation {
  ok: boolean               // false si au moins une erreur bloquante
  erreurs: ErreurValidation[]
  donnees: DonneesImport    // données parsées et normalisées (assets, tickets, coûts, images)
}
```

---

## Validation des images ZIP

La validation du ZIP est non-bloquante (avertissements uniquement) :

- **`imagesSansAsset`** : images du ZIP sans asset de même nom (base sans extension) en Feuille 1 — image ignorée à l'import.
- **`assetsSansImage`** : assets de la Feuille 1 sans image correspondante dans le ZIP — asset importé sans photo.

La détection du format réel (magic bytes) prime sur l'extension déclarée dans le ZIP :  
un JPEG nommé `.png` est ré-étiqueté `.jpg` avant l'upload, car GLPI rejette les fichiers dont le contenu ne correspond pas à l'extension.

---

## Cas d'import partiel

Chaque feuille peut être importée seule. Les dépendances ne s'appliquent que si les feuilles sont présentes ensemble :

- F3 sans F2 → chaque ligne de F3 produit une erreur (`Feuille 2 non fournie`).
- F2 avec des `Items` absents de F1 et absents de GLPI → lignes bloquées.
- Si GLPI est injoignable (`assetsBddNoms = null`), seule la F1 fait foi pour valider les `Items`.
