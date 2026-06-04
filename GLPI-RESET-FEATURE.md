# Fonctionnalité de Réinitialisation GLPI

## 📋 Vue d'ensemble

La fonctionnalité de **réinitialisation GLPI** permet aux administrateurs de purger entièrement les données de test dans une ou plusieurs entités GLPI de manière sécurisée et ordonnée. Cette opération supprime définitivement les objets via l'API DELETE de GLPI avec résolution automatique des dépendances entre objets.

## 🎯 Objectif

- Nettoyer les données de test dans GLPI
- Réinitialiser une ou plusieurs entités GLPI
- Résoudre automatiquement les dépendances lors de la suppression
- Fournir un retour d'exécution détaillé à l'utilisateur

## 🏗️ Architecture

### Frontend (Vue.js 3)

#### Pages
- **[src/pages/dataReset/DataResetPage.vue](../newApp/src/pages/dataReset/DataResetPage.vue)**
  - Page conteneur principal avec onglets (GLPI / SQLite)
  - Bascule entre les deux modes de réinitialisation

#### Composants
- **[src/components/dataReset/DataResetPanel.vue](../newApp/src/components/dataReset/DataResetPanel.vue)**
  - Panel GLPI : sélection des entités et des types de données
  - Affichage du journal d'exécution et du résumé
  - Bouton de lancement du processus

- **[src/components/dataReset/GlpiEntitySelector.vue](../newApp/src/components/dataReset/GlpiEntitySelector.vue)**
  - Sélecteur arborescent des entités GLPI
  - Boutons de sélection/désélection globale
  - Option pour inclure les sous-entités (récursion)

#### Composables (Logique métier)
- **[src/composables/dataReset/useDataReset.js](../newApp/src/composables/dataReset/useDataReset.js)**
  - Gestion de l'état de la réinitialisation
  - Chargement des entités GLPI
  - Orchestration du processus de purge
  - Suivi des logs et du résumé final

#### Services (API Client)
- **[src/services/dataReset/glpiResetApi.js](../newApp/src/services/dataReset/glpiResetApi.js)**
  - Wrapper API pour les endpoints GLPI Reset
  - Listage des entités GLPI
  - Changement d'entité active
  - Listage des IDs d'objets (avec pagination)
  - Suppression d'objets par lots

- **[src/services/dataReset/resetConfig.js](../newApp/src/services/dataReset/resetConfig.js)**
  - Configuration des types d'objets purgeables (itemtypes)
  - Ordre de suppression (weight) basé sur les dépendances
  - Constantes de configuration (taille des lots, nombre de passes)

### Backend (Java Spring Boot)

#### Contrôleur
- **[back-sqlite/src/main/java/com/example/backsqlite/controller/reset/SqliteTableResetController.java](../back-sqlite/src/main/java/com/example/backsqlite/controller/reset/SqliteTableResetController.java)**
  - Endpoint `GET /api/sqlite/tables` : liste des tables SQLite
  - Endpoint `POST /api/sqlite/tables/reset` : réinitialise les tables sélectionnées

#### Service
- **[back-sqlite/src/main/java/com/example/backsqlite/service/reset/SqliteTableResetService.java](../back-sqlite/src/main/java/com/example/backsqlite/service/reset/SqliteTableResetService.java)**
  - Logique métier de réinitialisation SQLite
  - Validation des tables
  - Suppression des lignes par table
  - Transaction managée

#### Repository
- **[back-sqlite/src/main/java/com/example/backsqlite/repository/reset/SqliteTableResetRepository.java](../back-sqlite/src/main/java/com/example/backsqlite/repository/reset/SqliteTableResetRepository.java)**
  - Accès direct à la base de données SQLite
  - Listage des tables
  - Suppression des lignes

## 📊 Modèle de données

### DTOs (Data Transfer Objects)

#### GLPI Reset
```typescript
// Aucun DTO backend pour GLPI (communication directe via API REST externe)
// Client utilise directement les endpoints GLPI
```

#### SQLite Reset
```typescript
// SqliteTableResetRequest
{
  tableNames: string[]
}

// SqliteTableResetResponse
{
  success: boolean,
  message: string,
  totalDeleted: number,
  resetTables: string[]
}

// SqliteTableDto
{
  name: string,
  rowCount: number
}
```

## 🔄 Processus de purge GLPI

### Étapes du processus

1. **Sélection des entités**
   - L'utilisateur sélectionne une ou plusieurs entités GLPI
   - Option pour inclure les sous-entités (récursion)

2. **Sélection des types de données**
   - Sélection des itemtypes à purger (coché par défaut)
   - Les types disponibles : Tickets, Problèmes, Changements, Ordinateurs, etc.

3. **Activation du contexte**
   - Pour chaque entité sélectionnée, activation via `/changeActiveEntities`
   - Cette opération limite les suppressions à l'entité active uniquement

4. **Purge par itemtype**
   - Récupération des IDs d'objets (pagination par lots de 200)
   - Suppression par lots de 100 IDs avec `force_purge: true`
   - Logging détaillé de chaque opération

5. **Résolution des dépendances**
   - Jusqu'à 4 passes de suppression (`MAX_PASSES`)
   - Chaque pass réessaie les itemtypes ayant échoué
   - Ordre intelligent basé sur le `weight` des itemtypes

### Itemtypes purgeables

| Catégorie | Itemtype | Label | Weight |
|-----------|----------|-------|--------|
| **ITIL** | Ticket | Tickets | 10 |
| | Problem | Problèmes | 11 |
| | Change | Changements | 12 |
| **Actifs** | Computer | Ordinateurs | 30 |
| | Monitor | Écrans | 31 |
| | NetworkEquipment | Équipements réseau | 32 |
| | Peripheral | Périphériques | 33 |
| | Phone | Téléphones | 34 |
| | Printer | Imprimantes | 35 |
| **Logiciels** | SoftwareLicense | Licences logicielles | 40 |
| | Software | Logiciels | 41 |
| **Gestion** | Document | Documents | 50 |
| | Contract | Contrats | 51 |
| | Supplier | Fournisseurs | 52 |
| | Contact | Contacts | 53 |
| | Budget | Budgets | 54 |

### Ordre de suppression

Les itemtypes sont triés par **weight ascendant** :
- Les plus bas (10-12) : objets ITIL dépendants
- Puis (30-35) : actifs (assets)
- Puis (40-41) : logiciels et licences
- Les plus hauts (50-54) : données de référence

Cette hiérarchie évite les erreurs de contrainte de clé étrangère.

## 🔐 Authentification et autorisation

- Accès limité aux utilisateurs authentifiés GLPI
- Session GLPI obligatoire (Session-Token)
- Toutes les requêtes incluent le Session-Token de l'utilisateur connecté
- Pas de proxy backend pour les resets GLPI (appels directs depuis le client)

## ⚙️ Configuration

### Variables d'environnement
```env
# Frontend (.env)
VITE_GLPI_API_BASE_URL=/glpi           # URL de base de l'API GLPI
VITE_GLPI_API_KEY=YOUR_GLPI_API_KEY    # App-Token GLPI
```

### Constantes de configuration
```javascript
// resetConfig.js
DELETE_CHUNK_SIZE = 100    // IDs supprimés par requête DELETE
MAX_PASSES = 4             // Nombre maximal de passes de retry
PAGE_SIZE = 200            // IDs listés par requête GET
```

## 📝 Routes et endpoints

### Frontend
```
/reset                    // Redirection vers /reset/glpi
/reset/glpi              // Réinitialisation GLPI
/reset/sqlite            // Réinitialisation SQLite
```

### Backend API
```
GET  /api/sqlite/tables                // Liste les tables SQLite
POST /api/sqlite/tables/reset          // Réinitialise les tables
```

### API GLPI (endpoints utilisés)
```
GET    /Entity                         // Liste les entités
POST   /changeActiveEntities           // Active une entité
GET    /{itemtype}?only_id=true       // Liste les IDs d'objets
DELETE /{itemtype}                     // Supprime les objets
```

## 💾 Flux de données

### Réinitialisation GLPI

```
┌─────────────────────┐
│  DataResetPage.vue  │ (Page conteneur)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│     DataResetPanel.vue                  │ (Composant GLPI)
│  - Sélection des entités               │
│  - Sélection des itemtypes             │
│  - Affichage des logs                  │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  useDataReset.js                        │ (Composable)
│  - runReset()                          │
│  - Orchestration du processus          │
│  - Logging                             │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  glpiResetApi.js                        │ (Service API)
│  - listEntities()                      │
│  - changeActiveEntities()              │
│  - listItemIds()                       │
│  - deleteItems()                       │
└──────────┬──────────────────────────────┘
           │
           ▼
     ┌─────────────┐
     │   API GLPI  │ (Endpoints REST)
     └─────────────┘
```

### Réinitialisation SQLite

```
┌─────────────────────┐
│  DataResetPage.vue  │ (Page conteneur)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│     SqliteResetPanel.vue                │ (Composant SQLite)
│  - Sélection des tables                │
│  - Affichage des résultats             │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  sqliteResetApi.js                      │ (Service API)
│  - listTables()                        │
│  - resetTables()                       │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  SqliteTableResetController.java        │ (Contrôleur Backend)
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  SqliteTableResetService.java           │ (Service Backend)
│  - listTables()                        │
│  - resetTables()                       │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  SqliteTableResetRepository.java        │ (Repository)
│  - listTableNames()                    │
│  - deleteAllRows()                     │
└──────────┬──────────────────────────────┘
           │
           ▼
     ┌──────────────┐
     │ BD SQLite    │ (Base de données)
     └──────────────┘
```

## 🛡️ Gestion des erreurs

### GLPI
- Détection d'erreurs au format GLPI : `["ERROR_xxx", "message"]`
- Récupération des messages d'erreur lisibles
- Retry automatique en cas d'erreurs de dépendances (jusqu'à `MAX_PASSES`)
- Logging complet de chaque tentative

### SQLite
- Validation des tables contre la liste réelle (injection SQL)
- Suppression conditionnelle (seulement les tables existantes)
- Transaction managée par Spring
- Logging des opérations

## 📊 Retours utilisateur

### Logs en temps réel
```
[14:23:01] info  Entité "Société A" : activation du contexte...
[14:23:02] info  Tickets : chargement des IDs...
[14:23:03] success Tickets : 45 item(s) supprimé(s), 0 echec(s).
[14:23:04] warning Ordinateurs : échec d'un lot (400) ...
[14:23:05] info  Pass 2/4 : Ordinateurs (retry)...
[14:23:06] success Ordinateurs : 12 item(s) supprimé(s), 8 echec(s).
```

### Résumé final
```
Entité "Société A"
├── Supprimé : 150 items
├── Échoué : 8 items
└── Temps : 2m 34s
```

## 🔄 État du développement

### ✅ Implémenté
- Sélection des entités GLPI
- Sélection des itemtypes
- Purge ordonnée avec résolution des dépendances
- Logging détaillé en temps réel
- Support SQLite (alternative)
- Gestion des erreurs GLPI

### ⚠️ À noter
- Pas de proxy backend pour GLPI (sécurité : clé API exposée au client)
- Session-Token GLPI nécessaire et actif
- Suppression définitive avec `force_purge: true`
- Pas de confirmation avant-après (à considérer pour sécurité)

## 🚀 Utilisation

### Interface utilisateur

1. Accéder à **Réinitialisation → GLPI**
2. Sélectionner une ou plusieurs entités
3. Cocher les types de données à purger
4. Cocher la case "J'ai compris..."
5. Cliquer sur "Lancer la réinitialisation"
6. Suivre les logs en temps réel
7. Consulter le résumé final

### Prérequis
- Utilisateur authentifié GLPI
- Session active dans GLPI
- Permissions administrateur GLPI (pour suppression)
- `VITE_GLPI_API_BASE_URL` et `VITE_GLPI_API_KEY` configurés

## 📚 Références

- [NEWAPP-CODE-OVERVIEW.md](NEWAPP-CODE-OVERVIEW.md#reinitialisation-de-donnees-glpi) - Section réinitialisation
- [GUIDE-PACKAGES-ET-FONCTIONNALITES.md](GUIDE-PACKAGES-ET-FONCTIONNALITES.md) - Configuration et sécurité
- [API GLPI Documentation](https://glpi-project.org/api/) - Endpoints GLPI
