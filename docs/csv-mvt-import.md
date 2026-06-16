# Page : Import CSV Mouvements (`/admin/csv-mvt`)

## Ce que ça fait

Cette page permet d'exécuter en masse des **mouvements de coût** sur des tickets GLPI à partir d'un fichier CSV. Un "mouvement" peut être :

- **`open`** — enregistrer des frais de réouverture (% du dernier batch)
- **`close`** — enregistrer un supercost (montant distribué sur les items liés au ticket)
- **`cancel`** — annuler le dernier batch de supercost d'un ticket

Au lieu de faire ces actions une par une depuis les pages de tickets, tu prépares un CSV et tu importes tout en une fois.

---

## Format CSV attendu

```
ticket,mvt,valeur
1042,close,15000
1043,open,30
1044,cancel,
1045,close,8500
```

| Colonne  | Type    | Obligatoire ? | Description |
|----------|---------|---------------|-------------|
| `ticket` | entier  | Oui           | ID du ticket GLPI |
| `mvt`    | string  | Oui           | Type de mouvement : `open`, `close`, ou `cancel` |
| `valeur` | nombre  | Selon le mvt  | Montant (pour `close`) ou pourcentage (pour `open`). Peut être vide pour `cancel`. |

Le parser accepte `,` ou `;` comme séparateur, et la première ligne peut être un en-tête (détecté automatiquement si elle commence par "ticket").

---

## Architecture — fichiers créés

```
src/
├── pages/BackOffice/
│   ├── CsvMvtImport.tsx      ← page principale (composant + logique)
│   └── CsvMvtImport.css      ← styles dédiés
├── api/
│   └── itemSuperCost.ts      ← appels API utilisés (existait déjà)
└── services/
    └── glpiService.ts        ← getTicketLinkedItems() utilisé pour `close`
```

La route est déclarée dans deux endroits (les deux sont actifs) :
- [src/App.tsx](../src/App.tsx) ligne 45 : `<Route path="csv-mvt" element={<CsvMvtImport />} />`
- [src/routes/appRoutes.tsx](../src/routes/appRoutes.tsx) ligne 36 : idem
- Le lien de navigation est dans [src/layouts/DashboardLayout.tsx](../src/layouts/DashboardLayout.tsx) ligne 16

---

## Comment ça marche — étape par étape

### 1. Lecture du fichier (`onChoixFichier`)

Quand l'utilisateur choisit un `.csv`, un `FileReader` lit le contenu en texte. La fonction `parseCSV()` (inline dans le fichier, indépendante du `csvParser.ts` de `src/lib/`) le parse :

```
texte brut → split par lignes → détection séparateur (; ou ,) → skip header si présent → tableau de { ticket, mvt, valeur }
```

La valeur est rejointe après le 2ème champ pour gérer les virgules décimales (`100,50` → `100.50`).

Le résultat est stocké dans `lignesCSV` et un **aperçu** s'affiche immédiatement (tableau avec ticket/mvt/valeur).

### 2. Import (`onImporter`)

Quand l'utilisateur clique "Importer", chaque ligne est traitée **séquentiellement** (boucle `for...of` avec `await`) :

#### Mouvement `close`
1. Appel `glpiTicketService.getTicketLinkedItems(ticketId)` → récupère les items GLPI liés au ticket
2. Si aucun item → skip avec message "aucun item GLPI trouvé"
3. Sinon → `ItemSuperCostApi.addSuperCost(ticketId, valeur, items)` → POST `/api/item-supercosts`
4. Le backend distribue le montant sur les items et retourne `{ saved: number }`

#### Mouvement `open`
1. `valeur` est obligatoire (% de réouverture) → skip si null
2. `ItemSuperCostApi.addReopenCost(ticketId, percent)` → POST `/api/item-supercosts/reopen`
3. Le backend calcule `percent%` du dernier batch et l'enregistre

#### Mouvement `cancel`
1. `ItemSuperCostApi.cancelLastBatch(ticketId)` → POST `/api/item-supercosts/cancel`
2. Retourne `{ removed: number }` → nombre de batchs supprimés

#### Erreurs
Chaque ligne est dans un `try/catch` indépendant : une ligne en erreur n'arrête pas les autres. L'erreur est capturée et affichée dans les résultats avec `status: 'erreur'`.

### 3. Affichage des résultats

Après l'import, `vokatra` (tableau de résultats) est affiché dans un second tableau avec :
- Les colonnes ticket / mvt / valeur
- **statut** coloré : `ok` (vert), `erreur` (rouge), `skip` (gris)
- **message** explicatif pour chaque ligne

---

## Types TypeScript

```ts
type LigneCSV = {
  ticket: number
  mvt: string
  valeur: number | null
}

type VokatraLigne = LigneCSV & {
  status: 'ok' | 'erreur' | 'skip'
  message: string
}
```

`VokatraLigne` étend `LigneCSV` en ajoutant le résultat après traitement.

---

## State React du composant

| State          | Type              | Rôle |
|----------------|-------------------|------|
| `fichierChoisi`| `File \| null`    | Fichier sélectionné (pour afficher le nom) |
| `lignesCSV`    | `LigneCSV[]`      | Lignes parsées avant import (aperçu) |
| `vokatra`      | `VokatraLigne[]`  | Résultats après import |
| `miasa`        | `boolean`         | `true` pendant l'import (désactive le bouton) |
| `inputFichier` | `ref<HTMLInputElement>` | Ref pour reset le `<input file>` après import |

---

## API backend utilisée

| Méthode                             | Route                          | Quand |
|-------------------------------------|--------------------------------|-------|
| `ItemSuperCostApi.addSuperCost()`   | POST `/api/item-supercosts`    | mvt `close` |
| `ItemSuperCostApi.addReopenCost()`  | POST `/api/item-supercosts/reopen` | mvt `open` |
| `ItemSuperCostApi.cancelLastBatch()`| POST `/api/item-supercosts/cancel` | mvt `cancel` |
| `glpiTicketService.getTicketLinkedItems()` | GET GLPI API | avant mvt `close` |

---

## Différence avec `CsvImporter` (composant générique)

Il existe aussi un composant `src/components/CsvImporter/CsvImporter.tsx` utilisé dans la page Settings pour importer des objets GLPI (computers, monitors…). Ce composant est **générique** : il reçoit `itemTypes` et un callback `onImport` en props.

`CsvMvtImport` est **spécifique aux mouvements de coût** : sa logique est autonome, directement dans la page, car les 3 types de mouvement ont des règles métier différentes (récupération des items GLPI, calcul backend, etc.).

---

## Exemple de fichier CSV valide

```csv
ticket,mvt,valeur
1042,close,15000
1043,close,8500
1044,open,30
1045,cancel,
1046,open,25
```

Résultat attendu :
- Tickets 1042 et 1043 : supercost enregistré, items récupérés depuis GLPI
- Tickets 1044 et 1046 : frais de réouverture (30% et 25% du dernier batch)
- Ticket 1045 : dernier batch annulé
