# Changelog — Import de Mouvements (Mvt Import)

> Date : 2026-06-16  
> Branche : `FitaAlea`

---

## Objectif

Créer une fonctionnalité complète d'import de mouvements (open / close / cancel) sur des tickets,
et permettre de voir l'historique détaillé de ces mouvements directement depuis la page **Coûts Items**.

---

## Résumé des changements

| Fichier | Type | Description |
|---|---|---|
| `server/api.ts` | Modifié | Nouvelle table SQL + 2 endpoints REST |
| `src/pages/BackOffice/MvtImport.tsx` | Créé | Nouvelle page d'import |
| `src/pages/BackOffice/ItemsCostList.tsx` | Modifié | Tickets cliquables + panneau de détail |
| `src/App.tsx` | Modifié | Ajout de la route `/admin/mvt-import` |
| `src/layouts/DashboardLayout.tsx` | Modifié | Ajout de l'entrée "Import Mvt" dans la sidebar |

---

## 1. `server/api.ts` — Modifié

### 1.1 Nouvelle table SQLite : `ticket_movements`

Ajoutée dans le bloc `db.exec(...)` au démarrage du serveur.

```sql
CREATE TABLE IF NOT EXISTS ticket_movements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id  INTEGER NOT NULL,
  mvt        TEXT    NOT NULL,
  valeur     TEXT,
  statut     TEXT    NOT NULL DEFAULT 'ok',
  message    TEXT,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)
```

| Colonne | Rôle |
|---|---|
| `ticket_id` | ID du ticket concerné |
| `mvt` | Type de mouvement : `open`, `close`, `cancel` |
| `valeur` | Valeur associée (ex : `150`, `5%`, vide pour cancel) |
| `statut` | Résultat de l'opération : `ok` ou `error` |
| `message` | Message de détail (ex : "SuperCost 150€ enregistré") |
| `created_at` | Horodatage UTC automatique |

---

### 1.2 Nouveau endpoint : `POST /api/ticket-movements`

Enregistre un mouvement en base après exécution.

**Body attendu :**
```json
{
  "ticketId": 2,
  "mvt": "close",
  "valeur": "150",
  "statut": "ok",
  "message": "SuperCost 150€ enregistré — 2 item(s) suivi(s)"
}
```

**Réponse :**
```json
{ "id": 42 }
```

---

### 1.3 Nouveau endpoint : `GET /api/ticket-movements/:ticketId`

Retourne l'historique complet des mouvements pour un ticket donné,
trié du plus récent au plus ancien.

**Exemple :** `GET /api/ticket-movements/2`

**Réponse :**
```json
[
  {
    "id": 3,
    "ticket_id": 2,
    "mvt": "open",
    "valeur": "5%",
    "statut": "ok",
    "message": "Frais de réouverture: 5%",
    "created_at": "2026-06-16T10:30:00Z"
  },
  ...
]
```

---

## 2. `src/pages/BackOffice/MvtImport.tsx` — Créé

Nouvelle page complète accessible via `/admin/mvt-import`.

### 2.1 Structure de la page

```
┌── Saisie manuelle ─────────────────────────────┐
│  [Ticket ID]  [Mvt ▼]  [Valeur]   [Traiter]    │
└────────────────────────────────────────────────┘
┌── Importation fichier ─────────────────────────┐
│  Format: ticketId_mvt_valeur                   │
│  Exemples: 2_close_150 · 2_open_5% · 2_cancel_ │
│  [Choisir fichier .csv / .txt]                 │
└────────────────────────────────────────────────┘
┌── Résultats ────────────────────────────────────┐
│  Ticket │ Mvt │ Valeur │ Statut │ Message       │
│  #2     │close│ 150    │ ✓ OK   │ SuperCost...  │
└────────────────────────────────────────────────┘
```

---

### 2.2 Format d'import supporté

Le parser (`parseLine`) détecte automatiquement le séparateur utilisé dans le fichier :

| Séparateur | Exemple |
|---|---|
| Underscore `_` (format natif) | `2_close_150` |
| Virgule `,` (CSV standard) | `2,close,150` |
| Point-virgule `;` | `2;close;150` |
| Tabulation `\t` (export Excel) | `2[TAB]close[TAB]150` |

Les lignes d'en-tête (`ticket,mvt,valeur`) sont ignorées automatiquement.  
Les lignes vides sont ignorées.

---

### 2.3 Mouvements supportés

| Mvt | Valeur | Action exécutée |
|---|---|---|
| `close` | Montant en € (ex: `150`) | `addSuperCost(ticketId, amount, items)` — récupère les items GLPI liés au ticket, distribue le montant |
| `open` | Pourcentage (ex: `5%` ou `5`) | `addReopenCost(ticketId, percent)` — frais de réouverture = % du dernier batch |
| `cancel` | *(vide)* | `cancelLastBatch(ticketId)` — supprime le dernier batch de supercost |

---

### 2.4 Pattern architectural utilisé

Basé sur le pattern "une seule fonction métier" (montré dans les exemples de la demande) :

```
executeLine(line)          ← fonction métier centrale
      ↑                           ↑
handleManual()             handleFileImport()
(saisie 3 champs)          (lecture fichier → split lignes)
      └──────── processLines(lines) ────────┘
                     (boucle + recordMovement)
```

- `parseLine()` — extrait `ticketId`, `mvt`, `valeur` depuis une ligne brute
- `executeLine()` — applique le mouvement (ne sait pas d'où viennent les données)
- `processLines()` — orchestre l'exécution et l'enregistrement
- `recordMovement()` — persiste le résultat via `POST /api/ticket-movements`

---

### 2.5 Gestion des erreurs

Chaque ligne est traitée indépendamment. Si une ligne échoue :
- Le traitement continue sur les lignes suivantes
- La ligne en erreur apparaît en rouge dans le tableau de résultats
- L'erreur est quand même enregistrée dans `ticket_movements` avec `statut: 'error'`

---

## 3. `src/pages/BackOffice/ItemsCostList.tsx` — Modifié

### 3.1 Tickets cliquables

**Avant :** Les tickets étaient de simples `<div>` affichant `#id — nom (item #x)`.

**Après :** Chaque ticket est cliquable (curseur pointer, hover violet, icône lien).  
Au clic → ouverture du panneau de détail.

```tsx
// Avant
<div className="items-cost-ticket-line">
  #{t.ticketId} — {t.ticketName} (item #{t.items_id})
</div>

// Après
<div
  className="items-cost-ticket-line"
  onClick={() => handleTicketClick(t.ticketId, t.ticketName)}
  style={{ cursor: 'pointer', ... }}
>
  <span style={{ color: '#4f46e5', fontWeight: 600 }}>#{t.ticketId}</span>
  {' — '}{t.ticketName}
  <i className="bi bi-box-arrow-up-right" />
</div>
```

---

### 3.2 Nouveau panneau de détail (drawer)

**Déclenché par :** clic sur un ticket dans la table.  
**Fermé par :** clic sur `×` ou clic sur l'overlay sombre.

**Contenu du panneau :**
- En-tête : numéro et nom du ticket
- Historique des mouvements depuis `GET /api/ticket-movements/:ticketId`
- Pour chaque mouvement :
  - Badge coloré du type (close = bleu, open = jaune, cancel = rose)
  - Date et heure
  - Valeur associée
  - Badge statut (vert OK / rouge Erreur) + message

**Nouveaux états ajoutés :**
```tsx
const [selectedTicket, setSelectedTicket] = useState<{ id: number; name: string } | null>(null)
const [movements, setMovements] = useState<Movement[]>([])
const [loadingMvt, setLoadingMvt] = useState(false)
```

**Nouvelle interface TypeScript ajoutée :**
```tsx
interface Movement {
  id: number
  ticket_id: number
  mvt: string
  valeur: string | null
  statut: string
  message: string | null
  created_at: string
}
```

---

## 4. `src/App.tsx` — Modifié

### Ajouts

```tsx
// Import ajouté
import { MvtImport } from './pages/BackOffice/MvtImport'

// Route ajoutée dans le bloc /admin (protégé)
<Route path="mvt-import" element={<MvtImport />} />
```

---

## 5. `src/layouts/DashboardLayout.tsx` — Modifié

### Ajout dans la constante NAV

```tsx
// Entrée ajoutée après "Coûts Items"
{ to: '/admin/mvt-import', icon: 'bi-arrow-left-right', label: 'Import Mvt' },
```

---

## Flux complet d'utilisation

```
1. Utilisateur va sur "Import Mvt" (sidebar)
2. Il saisit manuellement OU importe un fichier
   └─ Fichier accepté : .csv, .txt
   └─ Séparateurs acceptés : _ , ; [TAB]
3. Le frontend exécute chaque mouvement :
   close → appel GLPI pour les items liés → addSuperCost
   open  → addReopenCost (% du dernier batch)
   cancel→ cancelLastBatch
4. Chaque résultat est enregistré dans ticket_movements (SQLite)
5. Un tableau de résultats s'affiche en temps réel

6. Utilisateur va sur "Coûts Items"
7. Il clique sur un ticket dans la table
8. Un panneau s'ouvre sur la droite
9. Il voit l'historique complet des mouvements du ticket
   (mvt, valeur, date, statut, message)
```

---

## Fix appliqué après test

**Problème :** Toutes les lignes retournaient "Format invalide" lors de l'import.

**Cause :** Le parser original ne gérait que le séparateur `_`.
Si le fichier utilisait `,` (CSV) ou `;` ou `\t`, le split donnait un seul élément → échec.

**Correction dans `parseLine` :**  
Ajout de la fonction `detectSeparator()` qui teste les séparateurs dans l'ordre
`_` → `,` → `;` → `\t` et choisit le premier qui produit un ticket ID valide (entier > 0).
