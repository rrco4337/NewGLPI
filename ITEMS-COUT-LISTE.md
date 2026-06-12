# Fonctionnalité : Liste des coûts par item

## Résumé

Une nouvelle page Back Office `/admin/items-cost` affiche, pour chaque équipement (item) lié à un ticket, la répartition des coûts :
- **Coût fixe / item** = `cost_fixed` GLPI ÷ nombre d'items liés au ticket
- **Coût horaire / item** = `cost_time` GLPI ÷ nombre d'items liés au ticket
- **Nouveau prix / item** = valeur SQLite (`ticket_cost_{id}`) ÷ nombre d'items liés
- **Total / item** = somme des trois valeurs ci-dessus
- **Total général** = somme de tous les totaux par item

---

## Fichiers modifiés

| Fichier | Nature |
|---|---|
| `src/services/glpiService.ts` | Modifié — ajout de `listItemsCosts()` |
| `src/routes/appRoutes.tsx` | Modifié — ajout route `/admin/items-cost` |
| `src/layouts/DashboardLayout.tsx` | Modifié — ajout entrée nav "Coûts Items" |

## Fichiers créés

| Fichier | Nature |
|---|---|
| `src/pages/BackOffice/ItemsCostList.tsx` | Créé — nouvelle page |

---

## Détail des modifications

---

### 1. `src/services/glpiService.ts`

**Lignes ajoutées** : avant `searchAssets()` (environ ligne 332)

**Code ajouté** :
```typescript
async listItemsCosts(): Promise<{
  tickets: GlpiTicket[]
  costs: { id: number; tickets_id: number; cost_fixed: number; cost_time: number }[]
  items: { id: number; tickets_id: number; itemtype: string; items_id: number }[]
}> {
  const [ticketsRes, costsRes, itemsRes] = await Promise.allSettled([
    api.get('/Ticket?range=0-999&order=DESC&sort=id'),
    api.get('/TicketCost?range=0-9999'),
    api.get('/Item_Ticket?range=0-9999'),
  ])

  const tickets: GlpiTicket[] = ticketsRes.status === 'fulfilled' && Array.isArray(ticketsRes.value.data)
    ? ticketsRes.value.data as GlpiTicket[]
    : []

  const costs = costsRes.status === 'fulfilled' && Array.isArray(costsRes.value.data)
    ? (costsRes.value.data as any[]).map(c => ({
        id: Number(c.id),
        tickets_id: Number(c.tickets_id),
        cost_fixed: Number(c.cost_fixed) || 0,
        cost_time: Number(c.cost_time) || 0,
      }))
    : []

  const items = itemsRes.status === 'fulfilled' && Array.isArray(itemsRes.value.data)
    ? (itemsRes.value.data as any[]).map(i => ({
        id: Number(i.id),
        tickets_id: Number(i.tickets_id),
        itemtype: String(i.itemtype),
        items_id: Number(i.items_id),
      }))
    : []

  return { tickets, costs, items }
},
```

**Rôle** : Récupère en 3 appels parallèles tous les tickets, tous les coûts GLPI et toutes les liaisons items-tickets. Utilise le même pattern `Promise.allSettled` que `getTicket()`. Retourne des tableaux vides si un appel échoue.

---

### 2. `src/routes/appRoutes.tsx`

**Avant** (ligne 13) :
```tsx
import KanbanSetting from '@/pages/BackOffice/KanbanSetting'
```

**Après** :
```tsx
import KanbanSetting from '@/pages/BackOffice/KanbanSetting'
import { ItemsCostList } from '@/pages/BackOffice/ItemsCostList'
```

**Avant** (dans le bloc `/admin`) :
```tsx
<Route path="kanban-settings" element={<KanbanSetting />} />
```

**Après** :
```tsx
<Route path="kanban-settings" element={<KanbanSetting />} />
<Route path="items-cost" element={<ItemsCostList />} />
```

**Rôle** : Enregistre la nouvelle page à l'URL `/admin/items-cost`, protégée par le layout `DashboardLayout`.

---

### 3. `src/layouts/DashboardLayout.tsx`

**Avant** (dans le tableau `NAV`) :
```typescript
{ to: '/admin/kanban-settings', icon: 'bi-sliders', label: 'Kanban Settings' },
```

**Après** :
```typescript
{ to: '/admin/kanban-settings', icon: 'bi-sliders',    label: 'Kanban Settings' },
{ to: '/admin/items-cost',      icon: 'bi-calculator', label: 'Coûts Items' },
```

**Rôle** : Ajoute un lien "Coûts Items" dans la sidebar du Back Office.

---

### 4. `src/pages/BackOffice/ItemsCostList.tsx` (nouveau fichier)

**Chemin complet** : `src/pages/BackOffice/ItemsCostList.tsx`

**Code complet** :
```tsx
import { useState, useEffect } from 'react'
import { glpiTicketService } from '@/services/glpiService'
import { KanbanSettingApi } from '@/api/kanbanSetting'
import type { GlpiTicket } from '@/types/glpi'

interface ItemRow {
  ticketId: number
  ticketName: string
  itemtype: string
  items_id: number
  nbItems: number
  coutFixed: number
  coutHoraire: number
  nouveauPrix: number
  total: number
}

const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

export const ItemsCostList = () => {
  const [rows, setRows] = useState<ItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [bulk, settingsMap] = await Promise.all([
          glpiTicketService.listItemsCosts(),
          KanbanSettingApi.getSettingsMap(),
        ])

        const { tickets, costs, items } = bulk

        // ticketId → total cost_fixed + cost_time
        const costByTicket = new Map<number, { cost_fixed: number; cost_time: number }>()
        for (const c of costs) {
          const existing = costByTicket.get(c.tickets_id) ?? { cost_fixed: 0, cost_time: 0 }
          existing.cost_fixed += c.cost_fixed
          existing.cost_time += c.cost_time
          costByTicket.set(c.tickets_id, existing)
        }

        // ticketId → nouveau prix SQLite
        const sqlitePriceByTicket = new Map<number, number>()
        for (const [key, value] of Object.entries(settingsMap)) {
          const match = key.match(/^ticket_cost_(\d+)$/)
          if (match) {
            sqlitePriceByTicket.set(Number(match[1]), parseFloat(value) || 0)
          }
        }

        // ticketId → liste items
        const itemsByTicket = new Map<number, typeof items>()
        for (const item of items) {
          if (!itemsByTicket.has(item.tickets_id)) itemsByTicket.set(item.tickets_id, [])
          itemsByTicket.get(item.tickets_id)!.push(item)
        }

        // ticketId → ticket
        const ticketById = new Map<number, GlpiTicket>()
        for (const t of tickets) ticketById.set(t.id, t)

        const result: ItemRow[] = []
        for (const [ticketId, ticketItems] of itemsByTicket.entries()) {
          const ticket = ticketById.get(ticketId)
          const glpiCost = costByTicket.get(ticketId) ?? { cost_fixed: 0, cost_time: 0 }
          const nouveauPrixTotal = sqlitePriceByTicket.get(ticketId) ?? 0
          const nbItems = ticketItems.length

          for (const item of ticketItems) {
            const coutFixed = nbItems > 0 ? glpiCost.cost_fixed / nbItems : 0
            const coutHoraire = nbItems > 0 ? glpiCost.cost_time / nbItems : 0
            const nouveauPrix = nbItems > 0 ? nouveauPrixTotal / nbItems : 0
            result.push({
              ticketId,
              ticketName: ticket?.name || `Ticket #${ticketId}`,
              itemtype: item.itemtype,
              items_id: item.items_id,
              nbItems,
              coutFixed,
              coutHoraire,
              nouveauPrix,
              total: coutFixed + coutHoraire + nouveauPrix,
            })
          }
        }

        result.sort((a, b) => b.ticketId - a.ticketId)
        setRows(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  if (loading) return <div style={{ padding: 24 }}>Chargement...</div>
  if (error) return <div style={{ padding: 24, color: 'red' }}>Erreur : {error}</div>

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0)

  return (
    <div style={{ padding: 24 }}>
      <h2>Coûts par items</h2>
      {rows.length === 0 ? (
        <p>Aucun item avec coût trouvé.</p>
      ) : (
        <>
          <p>Total général : <strong>{fmt(grandTotal)}</strong> — {rows.length} item(s)</p>
          <table border={1} cellPadding={6} cellSpacing={0}
            style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                <th>Ticket</th>
                <th>Type item</th>
                <th>ID item</th>
                <th>Nb items liés</th>
                <th>Coût fixe / item</th>
                <th>Coût horaire / item</th>
                <th>Nouveau prix / item</th>
                <th>Total / item</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>#{row.ticketId} — {row.ticketName}</td>
                  <td>{row.itemtype}</td>
                  <td>#{row.items_id}</td>
                  <td style={{ textAlign: 'center' }}>{row.nbItems}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(row.coutFixed)}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(row.coutHoraire)}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(row.nouveauPrix)}</td>
                  <td style={{ textAlign: 'right' }}><strong>{fmt(row.total)}</strong></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f0f0f0', fontWeight: 'bold' }}>
                <td colSpan={7} style={{ textAlign: 'right' }}>Total général</td>
                <td style={{ textAlign: 'right' }}>{fmt(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
    </div>
  )
}
```

**Rôle** :
- Charge en parallèle les données GLPI (tickets + coûts + items) et SQLite (nouveau prix)
- Calcule pour chaque item sa part de chaque coût (division par `nbItems`)
- Affiche un tableau HTML natif, tri DESC par ticketId
- Affiche le total général en pied de tableau

---

## Sources de données

| Colonne | Source | Endpoint / Clé |
|---|---|---|
| Coût fixe | GLPI API | `TicketCost.cost_fixed` via `/TicketCost?range=0-9999` |
| Coût horaire | GLPI API | `TicketCost.cost_time` via `/TicketCost?range=0-9999` |
| Nouveau prix | SQLite Backend | `settings.key = ticket_cost_{ticketId}` via `GET /api/backoffice/settings` |
| Items liés | GLPI API | `Item_Ticket.itemtype` + `items_id` via `/Item_Ticket?range=0-9999` |

---

## Formule de calcul

Pour un ticket ayant `N` items liés :

```
coutFixed_par_item   = cost_fixed_total / N
coutHoraire_par_item = cost_time_total  / N
nouveauPrix_par_item = sqlite_value     / N
total_par_item       = coutFixed + coutHoraire + nouveauPrix
```

Si un ticket a plusieurs entrées TicketCost, leurs montants sont sommés avant division.

---

## Ordre des modifications

1. `src/services/glpiService.ts` → ajouter `listItemsCosts()` avant `searchAssets()`
2. `src/pages/BackOffice/ItemsCostList.tsx` → créer le fichier complet
3. `src/routes/appRoutes.tsx` → ajouter l'import et la `<Route path="items-cost" .../>`
4. `src/layouts/DashboardLayout.tsx` → ajouter l'entrée dans le tableau `NAV`

---

## Dépendances

- Backend Spring Boot doit tourner sur `http://localhost:8087`
- GLPI doit tourner et être accessible (session token valide)
- Aucune nouvelle dépendance npm

---

## Étapes de test bout en bout

### Prérequis
```bash
# Terminal 1 — backend
cd backend
./mvnw spring-boot:run

# Terminal 2 — frontend
npm run dev
```

### Scénario 1 — Tickets avec items et coûts GLPI
1. Se connecter à GLPI et créer un ticket avec au moins 2 équipements liés et un TicketCost
2. Se connecter au Back Office : `http://localhost:5173/admin`
3. Cliquer sur **Coûts Items** dans la sidebar
4. Vérifier que la ligne apparaît avec les coûts divisés par le nombre d'items

### Scénario 2 — Ticket avec "Nouveau prix" SQLite
1. Sur la vue Kanban (`/kanban`), glisser un ticket avec items dans **Closed**
2. Saisir un coût (ex: `120`) dans le champ "Coût fixe"
3. Confirmer la clôture
4. Aller sur `/admin/items-cost`
5. Vérifier que la colonne **Nouveau prix / item** = `120 / nb_items`

### Vérification SQLite
```bash
sqlite3 backend/data/glpi.db "SELECT * FROM settings WHERE key LIKE 'ticket_cost_%';"
```

### Scénario 3 — Ticket sans item
- Les tickets sans item lié n'apparaissent pas dans la liste (normal : pas de ligne à afficher)

### Scénario 4 — Ticket sans coûts
- Un ticket avec items mais sans TicketCost et sans coût SQLite → apparaît avec `0,00 €` partout

---

## Points d'attention

- Si un ticket a plusieurs entrées TicketCost (plusieurs enregistrements), leurs `cost_fixed` et `cost_time` sont **additionnés** avant division
- Les items sans nom (GLPI ne retourne pas les noms dans `/Item_Ticket`) sont affichés avec leur type et ID uniquement — résoudre les noms nécessiterait N appels supplémentaires
- La page est accessible sans authentification supplémentaire (elle hérite de la protection `DashboardLayout`)
- Tickets clôturés et ouverts apparaissent tous : la liste n'est pas filtrée par statut
