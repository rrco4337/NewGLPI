# Migration Spring Boot → TypeScript

## 1. Endpoints Spring Boot

| Méthode | Path | Fichier Spring Boot | Action |
|---------|------|---------------------|--------|
| GET | `/api/item-supercosts` | `ItemSuperCostController.java` | Agrégation supercost + reopencost par itemtype |
| POST | `/api/item-supercosts` | `ItemSuperCostController.java` | Crée un batch de supercost |
| POST | `/api/item-supercosts/reopen` | `ItemSuperCostController.java` | Enregistre frais de réouverture |
| POST | `/api/item-supercosts/cancel` | `ItemSuperCostController.java` | Annule le dernier batch |
| GET | `/api/item-supercosts/:ticketId/last-batch-total` | `ItemSuperCostController.java` | Total du dernier batch |
| POST | `/api/item-supercosts/reset` | `ItemSuperCostController.java` | Vide les deux tables |
| GET | `/api/backoffice/settings` | `SettingController.java` | Liste tous les paramètres |
| GET | `/api/backoffice/settings/:key` | `SettingController.java` | Retourne la valeur d'un paramètre |
| PUT | `/api/backoffice/settings/:key` | `SettingController.java` | Met à jour un paramètre |
| GET | `/api/assets` | `AssetController.java` | Liste tous les assets |
| GET | `/api/assets/:id` | `AssetController.java` | Retourne un asset par ID |
| POST | `/api/assets` | `AssetController.java` | Crée un asset |
| PUT | `/api/assets/:id` | `AssetController.java` | Met à jour un asset |
| DELETE | `/api/assets/:id` | `AssetController.java` | Supprime un asset |
| GET | `/api/sqlite/tables` | `SqliteTableResetController.java` | Liste les tables SQLite avec row count |
| POST | `/api/sqlite/tables/reset` | `SqliteTableResetController.java` | Vide les tables demandées |

## 2. Entités

| Entité Java | Table SQLite | Champs |
|-------------|-------------|--------|
| `TicketSupercost` | `ticket_supercosts` | id, ticket_id, batch, itemtype, items_id, amount |
| `TicketReopenCost` | `ticket_reopen_costs` | id, ticket_id, batch, itemtype, items_id, amount |
| `Setting` | `settings` | key, value |
| `Asset` | `assets` | id, name, type, serial_number, location, status |

## 3. Schéma SQLite réel

```sql
CREATE TABLE ticket_supercosts (
  id integer PRIMARY KEY,
  amount float,
  batch integer,
  items_id bigint,
  itemtype varchar(255),
  ticket_id bigint
);

CREATE TABLE ticket_reopen_costs (
  id integer PRIMARY KEY,
  amount float,
  batch integer,
  items_id bigint,
  itemtype varchar(255),
  ticket_id bigint
);

CREATE TABLE settings (
  key varchar(255) PRIMARY KEY,
  value varchar(255) NOT NULL
);

CREATE TABLE assets (
  id integer PRIMARY KEY,
  location varchar(255),
  name varchar(255) NOT NULL,
  serial_number varchar(255),
  status varchar(255),
  type varchar(255)
);
```

> Hibernate `SpringPhysicalNamingStrategy` convertit camelCase → snake_case dans la DB.
> Les réponses JSON doivent conserver le camelCase (comme Jackson le faisait).

## 4. Requêtes SQL exécutées

### ItemSuperCost

```sql
-- findMaxBatch
SELECT MAX(batch) FROM ticket_supercosts WHERE ticket_id = ?

-- findByTicketIdAndBatch
SELECT * FROM ticket_supercosts WHERE ticket_id = ? AND batch = ?

-- deleteByTicketIdAndBatch
DELETE FROM ticket_supercosts WHERE ticket_id = ? AND batch = ?

-- sumByItemtype (supercosts)
SELECT itemtype, SUM(amount) FROM ticket_supercosts GROUP BY itemtype

-- sumByItemtype (reopencosts)
SELECT itemtype, SUM(amount) FROM ticket_reopen_costs GROUP BY itemtype

-- deleteAll
DELETE FROM ticket_supercosts
DELETE FROM ticket_reopen_costs
```

### Settings

```sql
SELECT key, value FROM settings
SELECT value FROM settings WHERE key = ?
INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
```

### Assets

```sql
SELECT * FROM assets
SELECT * FROM assets WHERE id = ?
INSERT INTO assets (name, type, serial_number, location, status) VALUES (?, ?, ?, ?, ?)
UPDATE assets SET name=?, type=?, serial_number=?, location=?, status=? WHERE id=?
DELETE FROM assets WHERE id = ?
```

### SQLite Reset

```sql
-- listTableNames
SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name

-- countRows
SELECT COUNT(*) FROM "<table>"

-- deleteAllRows
DELETE FROM "<table>"
```

## 5. Règles métier détectées

1. **TRACKED_TYPES** : seuls `Computer`, `Phone`, `Monitor` sont tracés dans les supercosts.
2. **Partage du montant** : `amount / nombre_items_suivis` distribué à parts égales.
3. **Numérotation des batches** : `MAX(batch) + 1` par ticket.
4. **cancelLastBatch** : supprime uniquement `MAX(batch)` pour un ticket, sans toucher `ticket_reopen_costs`.
5. **addReopenCost** : calcule `amount * (percent / 100)` sur chaque ligne du dernier batch.
6. **Protection injection SQL (resetTables)** : seules les tables existantes dans `sqlite_master` sont acceptées.
7. **Initialisation settings** : valeurs par défaut insérées uniquement si la table est vide.
8. **Déduplication quotes JSON (updateSetting)** : si la valeur commence et finit par `"`, les guillemets sont supprimés.
9. **Validation Asset** : `name` est obligatoire (NotBlank).

## 6. Stratégie de migration TypeScript

### Architecture cible

```
Frontend (React/Vite :5173)
    ↓  proxy /api → :8087
server/api.ts (Express + better-sqlite3 :8087)
    ↓
backend/data/glpi.db (SQLite)
```

### Choix techniques

| Aspect | Choix | Raison |
|--------|-------|--------|
| Framework HTTP | Express | Simple, stable, pas de magic |
| Accès SQLite | better-sqlite3 | Synchrone, pas d'async/await, compatible native Node |
| Runner TypeScript | tsx | Exécute `.ts` directement sans compilation préalable |
| Orchestration dev | concurrently | Lance Vite + server en parallèle |

### Pas de couche Service

Toute la logique métier est inline dans les handlers Express de `server/api.ts`.

### Correspondances colonnes

| Java (camelCase) | SQLite (snake_case) | JSON retourné |
|------------------|---------------------|---------------|
| `ticketId` | `ticket_id` | `ticketId` |
| `itemsId` | `items_id` | `itemsId` |
| `serialNumber` | `serial_number` | `serialNumber` |

---

## 7. Fichiers créés / modifiés

| Fichier | Action | Origine Spring Boot |
|---------|--------|---------------------|
| `server/api.ts` | **Créé** | Tous les controllers |
| `package.json` | **Modifié** | — |
| `src/api/itemSuperCost.ts` | **Modifié** | URL absolue → relative |
| `src/api/kanbanSetting.ts` | **Modifié** | URL absolue → relative |
