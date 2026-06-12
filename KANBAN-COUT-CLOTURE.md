# Fonctionnalité : Coût fixe lors de la clôture Kanban

## Résumé

Quand un ticket est glissé-déposé dans la colonne **Closed** du Kanban, la boîte de dialogue de clôture existante affiche désormais un champ **Coût fixe (€)**. La valeur saisie est stockée dans SQLite via l'endpoint `PUT /api/backoffice/settings/{key}` déjà en place, avec la clé `ticket_cost_{ticketId}`.

---

## Fichiers modifiés

| Fichier | Nature |
|---|---|
| `src/api/kanbanSetting.ts` | Modifié — ajout de `saveTicketCost()` |
| `src/pages/FrontOffice/KanbanTickets.tsx` | Modifié — state + champ UI + logique de sauvegarde |

**Aucun nouveau fichier créé. Aucun changement backend.**

---

## Détail des modifications

---

### 1. `src/api/kanbanSetting.ts`

**Chemin complet :** `src/api/kanbanSetting.ts`

**Lignes impactées :** après la ligne 35 (fin de `updateSetting`)

**Avant :**
```ts
  // Mettre à jour un paramètre
  async updateSetting(key: string, value: string): Promise<KanbanSetting> {
    const response = await fetch(`${API_BASE_URL}/settings/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value)
    });
    if (!response.ok) throw new Error(`Erreur mise à jour ${key}`);
    return response.json();
  }
};
```

**Après :**
```ts
  // Mettre à jour un paramètre
  async updateSetting(key: string, value: string): Promise<KanbanSetting> {
    const response = await fetch(`${API_BASE_URL}/settings/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value)
    });
    if (!response.ok) throw new Error(`Erreur mise à jour ${key}`);
    return response.json();
  },

  // Sauvegarder le coût fixe d'un ticket clôturé
  async saveTicketCost(ticketId: number, amount: number): Promise<void> {
    await this.updateSetting(`ticket_cost_${ticketId}`, String(amount));
  }
};
```

**Rôle :** Encapsule la logique de clé `ticket_cost_{ticketId}` et délègue à `updateSetting` (endpoint déjà existant). Aucune duplication.

---

### 2. `src/pages/FrontOffice/KanbanTickets.tsx`

**Chemin complet :** `src/pages/FrontOffice/KanbanTickets.tsx`

#### 2a. Import ajouté — ligne 6

**Avant :**
```tsx
import { useSettings } from '@/hooks/useKanbanSetting'
```

**Après :**
```tsx
import { useSettings } from '@/hooks/useKanbanSetting'
import { KanbanSettingApi } from '@/api/kanbanSetting'
```

**Rôle :** Rendre `KanbanSettingApi.saveTicketCost()` accessible dans le composant.

---

#### 2b. Ajout du state `closeCost` — lignes ~97-100

**Avant :**
```tsx
  // Close dialog
  const [closeDialog, setCloseDialog] = useState<{ ticketId: number } | null>(null)
  const [closeNote,   setCloseNote]   = useState('')
  const [closeSaving, setCloseSaving] = useState(false)
```

**Après :**
```tsx
  // Close dialog
  const [closeDialog, setCloseDialog] = useState<{ ticketId: number } | null>(null)
  const [closeNote,   setCloseNote]   = useState('')
  const [closeCost,   setCloseCost]   = useState('')
  const [closeSaving, setCloseSaving] = useState(false)
```

**Rôle :** Stocke la valeur saisie dans le champ coût (string pour compatibilité avec `<input type="number">`).

---

#### 2c. Sauvegarde du coût dans `handleConfirmClose` — après `setCloseNote('')`

**Avant :**
```tsx
      setCloseDialog(null)
      setCloseNote('')
```

**Après :**
```tsx
      // Sauvegarder le coût si renseigné (indépendant — échec non bloquant)
      const costValue = parseFloat(closeCost)
      if (!isNaN(costValue) && costValue >= 0) {
        try {
          await KanbanSettingApi.saveTicketCost(ticketId, costValue)
        } catch (costErr) {
          console.error('Failed to save ticket cost:', costErr)
        }
      }

      setCloseDialog(null)
      setCloseNote('')
      setCloseCost('')
```

**Rôle :**
- `parseFloat(closeCost)` : convertit la saisie string en nombre
- Guard `!isNaN && >= 0` : ignore si le champ est vide ou invalide
- `try/catch` isolé : une erreur de sauvegarde du coût n'annule pas la clôture du ticket
- `setCloseCost('')` : réinitialise le champ après succès

---

#### 2d. Fonction helper `cancelCloseDialog` — après `handleConfirmClose`

**Code ajouté :**
```tsx
  const cancelCloseDialog = () => {
    setCloseDialog(null)
    setCloseNote('')
    setCloseCost('')
  }
```

**Rôle :** Centralise le reset du dialog (évite la duplication inline du reset `closeCost`).

---

#### 2e. Mise à jour du rendu du Close Dialog — section JSX

**Avant :**
```tsx
{closeDialog && (
  <div className="kb-overlay" onClick={() => { 
    if (!closeSaving) { 
      setCloseDialog(null)
      setCloseNote('')
    } 
  }}>
    <div className="kb-dialog" onClick={e => e.stopPropagation()}>
      ...
      <p className="kb-dialog-desc">
        Ce ticket sera marqué comme <strong>Résolu</strong> dans GLPI.
        Vous pouvez saisir une note de résolution (facultatif).
      </p>
      <div className="kb-field">
        <label>Note de résolution</label>
        <textarea ... />
      </div>
      <div className="kb-dialog-actions">
        <button ... onClick={() => { setCloseDialog(null); setCloseNote('') }}>
          Annuler
        </button>
        ...
      </div>
    </div>
  </div>
)}
```

**Après :**
```tsx
{closeDialog && (
  <div className="kb-overlay" onClick={() => { if (!closeSaving) cancelCloseDialog() }}>
    <div className="kb-dialog" onClick={e => e.stopPropagation()}>
      ...
      <p className="kb-dialog-desc">
        Ce ticket sera marqué comme <strong>Résolu</strong> dans GLPI.
        Vous pouvez saisir une note de résolution et le coût associé (facultatifs).
      </p>
      <div className="kb-field">
        <label>Note de résolution</label>
        <textarea ... />
      </div>
      <div className="kb-field">
        <label>Coût fixe (€)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={closeCost}
          onChange={e => setCloseCost(e.target.value)}
          placeholder="Ex : 150.00"
          disabled={closeSaving}
        />
      </div>
      <div className="kb-dialog-actions">
        <button ... onClick={cancelCloseDialog}>Annuler</button>
        ...
      </div>
    </div>
  </div>
)}
```

**Rôle :** Ajoute le champ "Coût fixe (€)" sous la note de résolution dans la boîte de dialogue existante. Utilise les classes CSS `.kb-field` déjà stylées.

---

## Stockage SQLite

| Clé | Valeur | Table |
|---|---|---|
| `ticket_cost_{ticketId}` | montant (ex: `"150.00"`) | `settings` |

Exemple : clôture du ticket #42 avec coût 75.50 → INSERT/UPDATE `settings` avec `key = "ticket_cost_42"`, `value = "75.5"`.

L'endpoint utilisé : `PUT http://localhost:8087/api/backoffice/settings/ticket_cost_42` avec body `"75.5"`.

---

## Ordre exact des modifications

1. `src/api/kanbanSetting.ts` → ajouter `saveTicketCost()` à la fin de l'objet `KanbanSettingApi`
2. `src/pages/FrontOffice/KanbanTickets.tsx` → ajouter l'import `KanbanSettingApi`
3. `src/pages/FrontOffice/KanbanTickets.tsx` → ajouter state `closeCost`
4. `src/pages/FrontOffice/KanbanTickets.tsx` → modifier `handleConfirmClose` pour sauvegarder le coût
5. `src/pages/FrontOffice/KanbanTickets.tsx` → ajouter `cancelCloseDialog()`
6. `src/pages/FrontOffice/KanbanTickets.tsx` → mettre à jour le JSX du Close Dialog

---

## Dépendances

- Backend Spring Boot doit tourner sur `http://localhost:8087`
- L'endpoint `PUT /api/backoffice/settings/{key}` doit être accessible (existant, aucune modification requise)
- Aucune nouvelle dépendance npm

---

## Étapes de test bout en bout

### Prérequis
```bash
# Terminal 1 — démarrer le backend
cd backend
./mvnw spring-boot:run
# ou : java -jar target/glpi-backend-1.0.0.jar

# Terminal 2 — démarrer le frontend
npm run dev
```

### Scénario 1 — Clôture avec coût
1. Ouvrir `http://localhost:5173` et naviguer vers la vue Kanban
2. Prendre un ticket de la colonne **New** ou **In Progress** et le glisser dans **Closed**
3. La boîte de dialogue s'ouvre — vérifier que le champ **Coût fixe (€)** est présent
4. Saisir une note optionnelle et un coût (ex: `150`)
5. Cliquer **Confirmer la clôture**
6. Vérifier que le ticket passe bien en Closed dans le Kanban

### Vérification SQLite
```bash
sqlite3 backend/data/glpi.db "SELECT * FROM settings WHERE key LIKE 'ticket_cost_%';"
```
Résultat attendu :
```
ticket_cost_42|150.0
```

### Scénario 2 — Clôture sans coût
1. Glisser un ticket vers Closed
2. Ne saisir ni note ni coût
3. Confirmer → ticket clôturé normalement, aucune entrée `ticket_cost_*` créée

### Scénario 3 — Annulation
1. Glisser un ticket vers Closed
2. Saisir un coût dans le champ
3. Cliquer **Annuler** (ou cliquer en dehors du dialog)
4. Vérifier que le ticket n'a pas changé de colonne et que le champ est vidé à la prochaine ouverture

### Scénario 4 — Erreur backend (robustesse)
1. Arrêter le backend
2. Glisser un ticket vers Closed, saisir un coût, confirmer
3. Le ticket doit quand même se clôturer dans GLPI (la sauvegarde du coût échoue silencieusement — message dans la console uniquement)

---

## Points d'attention

- Le coût est **optionnel** — laisser le champ vide ne bloque pas la clôture
- Le coût est stocké sous forme de string dans `settings` (cohérent avec l'architecture key-value existante)
- Si un ticket est clôturé plusieurs fois (ex: rollback puis re-clôture), la valeur est simplement mise à jour (`PUT` idempotent)
- Pour lire tous les coûts : `SELECT key, value FROM settings WHERE key LIKE 'ticket_cost_%';`
