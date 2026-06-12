# MODULES.md — Documentation technique détaillée du projet NewGLPI

> Document généré par analyse complète du code source (frontend React/Vite + backend Spring Boot).
> Objectif : donner une vue exhaustive de chaque module, son rôle, ses dépendances et son fonctionnement.

---

## 1. Vue d'ensemble

**NewGLPI** (`glpi-inventaire`) est une application web qui sert de portail/back-office au-dessus d'un serveur **GLPI** (gestion de parc IT / helpdesk), avec en plus deux modules métier additionnels :

- un **module d'import** massif (CSV + ZIP d'images) qui peuple GLPI avec des équipements, tickets et coûts ;
- un **module de reset** (remise à zéro) de GLPI et d'une base SQLite annexe, pour réinitialiser un environnement de démo/test.

### Stack technique

| Couche | Techno |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, React Router 7, Zustand 5, TailwindCSS 4 |
| Communication GLPI | API REST GLPI v1 (legacy, `/apirest.php`) via Axios/fetch + API GLPI v2.3 (OAuth2 password grant) |
| Backend annexe | Spring Boot 3.3.5 / Java 17, Spring Data JPA + JDBC, SQLite (`./data/glpi.db`) |
| Build/Dev | `npm run dev` (Vite, proxy `/api` → `localhost:8081`), `npm run build` (tsc + vite build) |

### Arborescence principale

```
src/
  api/            -> clients bas niveau vers GLPI (v1, v2), documents, settings Kanban, reset SQLite
  services/       -> glpiService.ts : service métier haut niveau (tickets, dashboard)
  hooks/          -> hooks React réutilisables (tickets, dashboard, computer form/list, kanban settings, connexion)
  lib/            -> utilitaires transverses (sessionToken, ticketStatus) + sous-module lib/import (pipeline d'import)
  store/          -> store Zustand (tokens GLPI)
  types/          -> types partagés (glpi.ts)
  layouts/        -> layouts FrontOffice / BackOffice / Dashboard
  pages/
    FrontOffice/  -> Home, CreateTicket, KanbanTickets (portail public)
    BackOffice/   -> Login, Dashboard, Tickets, TicketsList, TicketDetail, Inventory, Settings,
                     Reset, GlpiImport, ImportVerify, KanbanSetting
  components/     -> composants réutilisables (StatusBadge, ConfirmModal, CsvImporter, GlpiImport/*,
                     dataReset/*, ResetReport, ComputerForm, ChecklistPanel, SummaryPanel, TopBar, ...)
  routes/         -> appRoutes.tsx (table de routes alternative, non utilisée par App.tsx)
backend/          -> service Spring Boot annexe (settings, assets, reset SQLite)
import/, 120/     -> fichiers CSV d'exemple pour le module d'import
```

---

## 2. Point d'entrée et configuration globale

### `src/main.tsx`
Bootstrap React : monte `<App />` dans `#root`, encapsulé dans `<StrictMode>` et `<BrowserRouter>` (React Router).

### `src/App.tsx`
Déclare l'arbre de routes **réellement utilisé** par l'application (via `<Routes>/<Route>`) :

- **Zone publique** (`FrontOfficeLayout`) :
  - `/` → `Home`
  - `/create-ticket` → `CreateTicket`
  - `/kanban` → `KanbanTickets`
- **Authentification** : `/admin/login` → `Login`
- **Zone admin protégée** par `ProtectedRoute`, sous `DashboardLayout` (`/admin`) :
  - `dashboard`, `tickets`, `tickets/:id`, `inventory`, `users` (stub "Coming soon"), `settings`, `reset`, `import`, `verify-import`, `kanban-settings`
- **Fallback** : toute route inconnue redirige vers `/`.

### `src/routes/appRoutes.tsx`
Table de routes **alternative/obsolète** (n'est importée nulle part dans `App.tsx`). Elle ressemble à une version antérieure de l'arbre de routes : pas de `ProtectedRoute`, `inventory`/`users` en stub, pas de routes `import`/`verify-import`. À considérer comme du code mort ou un brouillon — ne pas s'y fier pour le routing réel.

### `vite.config.ts`
Configuration Vite : plugins `@vitejs/plugin-react` + `@tailwindcss/vite`, alias `@` → `./src`, et proxy de dev `/api` → `http://localhost:8081`.

> ⚠️ **Incohérence relevée** : le proxy Vite pointe vers le port **8081**, alors que le backend Spring Boot (voir section 7) écoute sur le port **8087**, et que `src/api/kanbanSetting.ts` / `src/api/sqliteReset.ts` appellent directement `http://localhost:8087/...`. Le proxy `/api` semble donc ne pas être utilisé par le code actuel (les appels backend passent par une URL absolue codée en dur).

### Variables d'environnement (`.env.local`)
- `VITE_GLPI_BASE_URL` — URL de base de l'API GLPI v1 (défaut `http://localhost:8080`)
- `VITE_GLPI_APP_TOKEN` — App-Token GLPI (legacy API)
- `VITE_GLPI_SESSION_TOKEN` — session token de secours (lu par `lib/sessionToken.ts`)
- `VITE_GLPI_DEFAULT_USERNAME` — utilisateur par défaut
- `VITE_GLPI_V2_CLIENT_ID`, `VITE_GLPI_V2_CLIENT_SECRET`, `VITE_GLPI_V2_PASSWORD` — credentials OAuth2 pour l'API GLPI v2.3

---

## 3. Types partagés — `src/types/glpi.ts`

Définit les types de base utilisés dans toute l'app :
- `ComputerFormData` — champs du formulaire de création d'ordinateur (assetTag, displayName, manufacturer, model, serialNumber, type, status, location, owner, purchaseDate, notes)
- `AsyncState` = `'idle' | 'loading' | 'success' | 'error'`
- `FormErrors` = `Partial<Record<keyof ComputerFormData, string>>`
- `TicketStatus` / `TicketPriority` — unions de statuts/priorités
- `GlpiTicket` — modèle de ticket (id, name, status, priority, requester/technician, dates, category, type, content, description, solution, etc.)
- `TicketCostEntry` — entrée de coût (actiontime, cost_time, cost_fixed, begin_date)
- `LinkedItem` — équipement lié à un ticket (itemtype, items_id, itemName résolu)
- `TicketDetail` = `GlpiTicket` enrichi avec `comments`, `history`, `documents`, `costs`, `linkedItems`
- `DashboardMetric` — `{ label, value, accent, detail }`

---

## 4. Store global — `src/store/glpiStore.ts`

Store **Zustand** minimaliste pour les tokens GLPI :
- `sessionToken` — initialisé depuis `localStorage['glpi_session_token']`, persisté à chaque `setSessionToken`
- `appToken` — initialisé depuis `VITE_GLPI_APP_TOKEN` (immuable après boot, sauf `setAppToken`)
- `clearTokens()` — supprime le token de session du localStorage et réinitialise le store (utilisé à la déconnexion)

---

## 5. Couche API / Services / Hooks / Lib (cœur d'accès aux données)

### 5.1 `src/api/glpi.ts`
Client principal pour la **GLPI REST API v1 (legacy)**.

- `GLPI_BASE_URL`, `GLPI_APP_TOKEN` — constantes issues des variables d'env
- `testSession(token?, appToken?)` — GET `/getMyProfiles`, vérifie la validité d'une session
- `initSession(code, appToken?)` — GET `/initSession` avec `Authorization: Basic <base64(user:pass)>`, retourne `session_token`
- `createComputer(formData, ...)` — POST `/Computer` (mappe les champs du formulaire vers `input{name, serial, otherserial, comment}`, les détails non-mappés sont concaténés dans `comment`)
- `listItems(itemType, range?, token?, appToken?, expandDropdowns?)` — GET `/{itemType}?range=...&expand_dropdowns=...`, retourne toujours un tableau
- `countItems(itemType, ...)` — compte les éléments d'un type
- `deleteItems(itemType, ids, ...)` — DELETE en masse avec `force_purge=1`
- `purgeAllItems(itemType, ...)` — purge **tous** les éléments d'un type par lots de 50, retourne `{deleted, errors[]}`
- `purgeNonAdminUsers(...)` — supprime les utilisateurs non-admin (préserve l'ID 1 et tout profil contenant "admin", via `Profile_User`)
- `updateItem(itemType, id, data, ...)` — PUT `/{itemType}/{id}`
- `createItem(itemType, data, ...)` — POST `/{itemType}` générique
- `fetchDocumentBlob(docId, ...)` — GET `/Document/{id}?alt=media`, retourne une URL `Blob` (images uniquement)
- `fetchDocumentItems(...)` — GET `/Document_Item?range=0-9999`, pour mapper documents ↔ actifs

**Points notables** : la résolution du token se fait en cascade (paramètre explicite → localStorage → `sessionTokenFromFile`). Les purges sont batchées pour éviter les timeouts/erreurs réseau.

### 5.2 `src/api/glpiV2.ts`
Connecteur pour la **GLPI REST API v2.3** (OAuth2 *password grant*), utilisée pour les types non disponibles en v1 (ex. `Socket`).

- `isV2Configured()` — vrai si `VITE_GLPI_V2_CLIENT_ID/SECRET/PASSWORD` sont définis
- token Bearer mis en cache avec expiration (`expires_in - 30s`)
- `createItemV2(itemType, data, namespace = 'Assets'|'Assistance')` — POST `/{namespace}/{itemType}` (payload direct, sans wrapper `{input:}`)
- `deleteItemV2(itemType, id)` — DELETE `/Assets/{itemType}/{id}` (tolère 404)
- `listItemsV2(itemType, namespace?)` — GET `/{namespace}/{itemType}?range=0-9999`
- `purgeAllItemsV2(itemType, namespace?)` — purge en parallèle via `Promise.all`

### 5.3 `src/api/glpiDocuments.ts`
Gestion de l'upload/liaison de documents (images) à des actifs GLPI.

- `ensureImageDocumentTypes(token?)` — vérifie/crée les `DocumentType` PNG/JPEG/WebP/GIF avec `is_uploadable=1`
- `uploadDocumentToGlpi(name, imageBlob, filename, ...)` — upload multipart (`uploadManifest` + `filename[0]`) vers `/Document`, retourne l'ID créé
- `linkDocumentToItem(documentId, itemtype, itemsId, token?)` — POST `/Document_Item` avec fallback `PUT /Document/{id}` si la création directe échoue (compatibilité versions GLPI)

### 5.4 `src/api/kanbanSetting.ts`
Client pour le **backend Spring Boot annexe** (`http://localhost:8087`, URL codée en dur) :
- `KanbanSettingApi.getAllSettings()` — GET `/api/backoffice/settings` → `{key, value}[]`
- `KanbanSettingApi.getSettingsMap()` — transforme en `Record<string,string>`
- `KanbanSettingApi.updateSetting(key, value)` — PUT `/api/backoffice/settings/{key}`

### 5.5 `src/api/sqliteReset.ts`
Client pour le reset de la base SQLite annexe :
- `listSqliteTables()` — GET `/api/sqlite/tables` → `{name, rowCount}[]`
- `resetSqliteTables(tableNames)` — POST `/api/sqlite/tables/reset` → `{success, message, totalDeleted, resetTables[]}`

### 5.6 `src/services/glpiService.ts` (751 lignes — service central)
Service métier haut niveau basé sur **Axios** (avec intercepteurs request/response ajoutant `App-Token`/`Session-Token` et loggant les erreurs 400).

**`glpiAuthService`**
- `initSession(username, password)` — POST `/initSession` (Basic auth)
- `getProfile()` — GET `/getMyProfiles`

**`glpiTicketService`**
- `listTickets()` — GET `/Ticket?range=0-999&order=DESC&sort=id`
- `getTicket(id)` — agrégation parallèle (`Promise.allSettled`) de `Ticket` + `TicketCost` + `Item_Ticket`, avec résolution des noms d'items liés
- `setTicketCosts(ticketId, timeCost?, fixedCost?, duration?)` — POST `/TicketCost`
- `createTicket(payload)` — POST `/Ticket` avec **fallback mock** si l'appel échoue
- `createTicketWithCosts(...)` — crée le ticket puis ajoute les coûts
- `updateTicket(id, payload)` — PUT `/Ticket/{id}`
- `createSolution(ticketId, content)` — POST `/ITILSolution` (itemtype=Ticket) → passe le ticket en "résolu"
- `getTicketSolution(ticketId)` — GET `/Ticket/{id}/ITILSolution`
- `associateItemToTicket(tickets_id, itemtype, items_id)` — POST `/Item_Ticket` (fallback mock)
- `searchAssets(query)` — recherche sur Computer/Monitor/Printer/Phone/NetworkEquipment/Software (range 0-50), filtrée côté client

**`glpiDashboardService`**
- `getOverview()` — agrégation massive (~17 appels parallèles) : total d'actifs par type, tickets récents/par statut, coûts totaux, détection de **session expirée** (401 répété), inclusion des `Socket` (v2) si configuré
- `getAssetsByType(type)` — GET `/{type}?range=0-999`
- `getAdvancedStats()` — âge moyen des tickets ouverts, nb tickets ouverts, ratio actifs/tickets, etc.

**Points notables** : coûts = `cost_time * (actiontime/3600) + cost_fixed` ; mapping des codes statut GLPI (1=new, 2/3=processing, 4=waiting, 5=solved, 6=closed) ; `assetBreakdown` ne garde que les types avec count > 0.

### 5.7 Hooks (`src/hooks/`)

| Hook | Rôle |
|---|---|
| `useGlpiConnection.ts` | Teste la connexion GLPI (`testSession`), expose `connectionState`, `hasToken`, `hasAppToken`, `apiUrl`, `testConnection()` |
| `useComputerList.ts` | Charge la liste des ordinateurs (`listItems('Computer'...)`), expose `{computers, loading, error, refresh}` |
| `useComputerForm.ts` | Gère l'état/validation/soumission du formulaire `ComputerFormData` (création via `createComputer`), valide `displayName`, `assetTag`, `serialNumber` |
| `useDashboardMetrics.ts` | Charge `glpiDashboardService.getOverview()` au montage, expose `{data, loading, error}` |
| `useKanbanSetting.ts` (export `useSettings`) | Charge les réglages Kanban (couleurs/labels) via `KanbanSettingApi.getSettingsMap()`, avec valeurs par défaut (FR) |
| `useTickets.ts` | Liste + filtre (texte/status/priorité) + trie (id/date/priorité) + pagine (8/page) les tickets via `glpiTicketService.listTickets()` et `lib/ticketStatus` |

### 5.8 `src/lib/sessionToken.ts`
Exporte `sessionTokenFromFile` = `VITE_GLPI_SESSION_TOKEN` (trim), utilisé comme dernier recours dans la cascade de résolution de token.

### 5.9 `src/lib/ticketStatus.ts`
Normalisation multilingue (FR / malgache / codes numériques GLPI) des statuts et priorités de tickets :
- `normalizeTicketStatus(value)` → `'new' | 'in-progress' | 'pending' | 'closed' | 'unknown'`
- `getTicketStatusLabel(value)` → libellé FR ("Nouveau", "In progress", "En attente", "Closed")
- `getTicketStatusVariant(value)` → `'open' | 'pending' | 'closed'` (pour `StatusBadge`)
- `normalizeTicketPriority(value)` → `'low' | 'medium' | 'high' | 'unknown'`
- `getTicketPriorityLabel(value)` / `getTicketPriorityVariant(value)` → libellés/variants FR

---

## 6. Module FrontOffice (portail public)

### `src/layouts/FrontOfficeLayout.tsx` (+ `.css`)
Layout public : barre de navigation sticky avec logo "NewGLPI" et 3 liens (`Mes tickets` → `/kanban`, `Créer un ticket` → `/create-ticket`, `Admin` → `/admin/login`). Affiche `<Outlet/>` pour la page enfant. Composant stateless, pur affichage.

### `src/pages/FrontOffice/Home.tsx` (780 lignes)
Page d'accueil = **catalogue public des équipements GLPI**.

- **Chargement** : appels parallèles à `listItems()` pour 8 types d'actifs (Computer, Monitor, Printer, Phone, NetworkEquipment, Peripheral, Software, Appliance), + `fetchDocumentItems()` pour mapper les images disponibles (`docMap`).
- **Filtrage/tri** (`useMemo`) : recherche texte (nom/type/série/inventaire), filtre par type, par plage de dates de création, tri multi-colonnes (collation fr-FR).
- **Pagination** : 24 items/page, contrôles avec ellipsis intelligent.
- **Chargement d'images** : pour les items de la page affichée, fetch des blobs via `fetchDocumentBlob()`, gestion des `Object URL` avec nettoyage (`useRef` + `revokeObjectURL`) pour éviter les fuites mémoire.
- **Rendu** : hero/recherche + stats globales, filtres par type (pills), barre d'outils (recherche, filtres avancés, reset, refresh, toggle vue cartes/tableau), grille de cartes ou tableau triable, pagination.
- Sous-composants internes : `AssetImage` (image + fallback icône), `SkeletonCard` (état de chargement).

### `src/pages/FrontOffice/CreateTicket.tsx` (337 lignes)
Formulaire public de création de ticket.

- Champs : titre*, description*, urgence, type, et section **coûts optionnels** (durée, coût temps, coût fixe — parsing des nombres au format français via `parseFrenchNumber`).
- **Recherche d'équipements** : `glpiTicketService.searchAssets()`, ajout à `selectedAssets`.
- **Soumission** : `glpiTicketService.createTicketWithCosts()` puis boucle `associateItemToTicket()` pour chaque équipement sélectionné. Affiche le succès avec l'ID du ticket créé et propose d'en créer un nouveau.

### `src/pages/FrontOffice/KanbanTickets.tsx` (862 lignes)
Vue **Kanban publique** des tickets (3 colonnes : Nouveau / En cours / Résolu), avec drag-and-drop natif HTML5.

- **Chargement** : `glpiTicketService.listTickets()`, répartition par colonne selon le statut (1→new, 2/3/4→progress, 5/6→closed).
- **Drag & drop** : `onDragStart/onDragOver/onDrop` — déplacement optimiste avec **rollback** en cas d'erreur API ; le drop sur "Résolu" ouvre une modale de clôture (note de solution optionnelle via `createSolution()`, sinon `updateTicket({status:5})`).
- **Modale de détails** : fetch parallèle `getTicket()` + `getTicketSolution()`, affiche badges, description, solution, méta-infos, commentaires, historique, documents.
- **Modale de création** : identique à `CreateTicket.tsx` (recherche d'actifs + soumission), avec auto-fermeture après succès et rafraîchissement de la liste.
- **i18n Kanban** : via `useKanbanSetting`, les libellés des colonnes peuvent être affichés en malgache ou en français selon les réglages backend.

### Composants partagés FrontOffice

- **`src/components/StatusBadge.tsx`** — badge générique (`label`, `variant` parmi `open|closed|pending|high|medium|low|incident|request`), styles Tailwind colorés par variante.
- **`src/components/StatusMessage/StatusMessage.tsx`** — bandeau de feedback (`state: AsyncState`, `message`), `role="alert" aria-live="polite"`.
- **`src/components/ConfirmModal/ConfirmModal.tsx` (+ .css)** — modale de confirmation générique exigeant la saisie exacte d'une phrase ("REINITIALISER") pour activer le bouton de confirmation ; utilisée pour les actions destructives (reset).

---

## 7. Module BackOffice (admin)

### Sécurité / Layout

#### `src/components/Security/ProtectedRoute.tsx`
Garde de route : vérifie `localStorage.getItem('glpi_session_token')`. Si absent → `<Navigate to="/admin/login" replace/>`, sinon → `<Outlet/>`.
> ⚠️ Vérification **naïve** (présence du token uniquement, pas de validation de validité/expiration côté serveur).

#### `src/layouts/DashboardLayout.tsx` (267 lignes, + `.css`)
Layout principal admin : sidebar collapsable (248px ↔ 68px) avec navigation (Dashboard, Tickets, Inventaire, Import, Vérification import, Utilisateurs, Réinitialisation, Paramètres, Paramètres Kanban) + bouton déconnexion (`clearTokens()` du store puis redirection `/admin/login`). Topbar avec toggle collapse, barre de recherche (stub) et avatar utilisateur statique.

#### `src/layouts/BackOfficeLayout.tsx`
Layout minimal alternatif (juste un `<div className="back-office-layout"><Outlet/></div>`) — **non référencé** dans `App.tsx` (probable reliquat).

#### `src/components/TopBar/TopBar.tsx`
Composant de présentation pure (contrôlé par le parent) affichant l'état de connexion GLPI : `apiUrl`, `hasToken`, `hasAppToken`, `connectionState`, et un bouton "Tester la connexion" (`onTestConnection`).

### Authentification

#### `src/pages/BackOffice/Login.tsx` (264 lignes, + `.css`)
Page de connexion admin : formulaire mot de passe (valeur par défaut pré-remplie `"glpi"`), appel `initSession(password)` (depuis `src/api/glpi.ts`), stockage du `session_token` retourné dans `localStorage['glpi_session_token']`, puis redirection vers `/admin/dashboard`. UI split-screen avec dégradé indigo, toggle afficher/masquer le mot de passe, spinner CSS pendant le chargement, bandeau d'erreur en cas d'échec.

### Tableau de bord

#### `src/pages/BackOffice/Dashboard.tsx` (120 lignes, + `.css`)
Affiche les métriques globales via `useDashboardMetrics()` : total d'actifs, total/ouverts de tickets, coûts (temps/fixe/total formatés en EUR `fr-FR`), répartition par type d'actif (barres de progression), tableau des tickets récents (`StatusBadge` pour statut/priorité). Lien vers `/admin/kanban-settings`. États loading (spinner) / error (bandeau).

### Tickets

#### `src/pages/BackOffice/Tickets.tsx` (151 lignes)
Liste des tickets pilotée par `useTickets()` : recherche texte (état local `searchText` validé par bouton/Enter avant `setQuery`), filtres statut/priorité, tri (id/date/priorité), tableau (ID/titre lien vers `/admin/tickets/:id`, statut, priorité, demandeur, technicien, date, catégorie via `StatusBadge` + `ticketStatus` helpers), pagination précédent/suivant.

#### `src/pages/BackOffice/TicketsList.tsx` (199 lignes, + `.css`)
Vue alternative/"Helpdesk" : charge **tous** les tickets via `listItems('Ticket')` (sans passer par `useTickets`), avec **sélection multiple** (checkbox "tout sélectionner", état `Set`), actions de masse (Assign / Change Status / Close — **stubs non implémentés**), boutons New Ticket / Export (**stubs**), Refresh fonctionnel. Beaucoup de redondance fonctionnelle avec `Tickets.tsx` mais orientée actions groupées.

#### `src/pages/BackOffice/TicketDetail.tsx` (393 lignes, + `.css`)
Détail d'un ticket (`useParams().id` → `glpiTicketService.getTicket(id)`). Affiche : header avec badges statut/priorité, description (**`dangerouslySetInnerHTML`** — ⚠️ pas de sanitization, risque XSS si le contenu vient de saisies utilisateurs non filtrées), historique, zone de réponse (toolbar formatage **stub**), sidebar (infos demandeur/technicien/dates, documents attachés, équipements liés avec icônes par type), commentaires, et — si présents — tableau détaillé des **coûts** (temps/fixe/total, durée formatée `fmtDuration()`, montants `fr-FR`).

### Inventaire

#### `src/pages/BackOffice/Invotentory.tsx` (218 lignes) *(nom de fichier avec coquille — composant exporté `Inventory`)*
Liste des ordinateurs via `useComputerList()`, recherche client-side (nom / `otherserial` / `serial`), bouton "Actualiser" (`refresh()`), bouton "Exporter" (**stub**). Table avec colonnes index, nom (icône+avatar), Asset Tag, N° série, statut (badge "En service" **codé en dur**). États : skeleton shimmer (loading), empty state (icône inbox).

### Paramètres / Reset rapide / Import CSV générique

#### `src/pages/BackOffice/Settings.tsx` (253 lignes, + `.css`)
Page "danger zone" combinant :
1. **Reset sélectif** : sélection de types GLPI purgeables (Computer, Monitor, etc. — exclut User/Profile/Entity/Config), `ConfirmModal`, boucle `purgeAllItems(type)` avec barre de progression, affichage via `ResetReport`.
2. **Import CSV générique** via `CsvImporter` : sélection d'un type GLPI, parsing CSV (preview 5 lignes), puis boucle `createItem(itemType, row)` ligne par ligne, comptage succès/erreurs.

> Ce composant est **distinct** du module d'import principal (section 8) : il s'agit d'un import CSV simple "1 type ↔ 1 fichier", sans validation avancée ni gestion d'images/tickets/coûts.

### Paramétrage Kanban

#### `src/pages/BackOffice/KanbanSetting.tsx` (287 lignes, + `.css`)
Édite les réglages persistés côté backend Spring Boot via `KanbanSettingApi` :
- **Couleurs** des 3 colonnes Kanban (Nouveau/En cours/Terminé) — sauvegarde immédiate à chaque changement (`handleColorChange`), avec restauration si l'appel échoue.
- **Libellés texte** (FR/malgache) — édition locale puis sauvegarde explicite par champ (`handleSaveText`) ou globale (`handleSaveAllTexts`, `Promise.all`).
- **Aperçu** statique du Kanban avec les couleurs/labels choisis.

### Composants réutilisables BackOffice

- **`src/components/ComputerForm/ComputerForm.tsx`** — formulaire contrôlé (props `formData`, `submitState`, `errors`, `onChange`, `onSubmit`, `hasToken`/`hasAppToken`) pour la création d'un ordinateur ; selects avec options hardcodées (type, statut, localisation) ; affichage `StatusMessage`.
- **`src/components/CsvImporter/CsvImporter.tsx` (+ .css)** — composant générique d'import CSV : détection auto du séparateur (`,`/`;`), preview 5 lignes, validations basiques (présence colonne `name`/`nom`), délègue la création via `onImport(itemType, rows)` (callback async fourni par le parent, ex. `Settings.tsx`).
- **`src/components/ChecklistPanel/ChecklistPanel.tsx`** — encart statique (checklist de contrôles + timeline 3 étapes), purement présentationnel, non interactif.
- **`src/components/SummaryPanel/SummaryPanel.tsx` + `StatusBadge.tsx`** — encart résumé d'un `ComputerFormData` (statut/type/localisation/date d'achat + sous-titre nom/série) ; `StatusBadge` local quasi-identique à `src/components/StatusBadge.tsx`.

---

## 8. Module Import (CSV + images → GLPI)

Pipeline complet permettant d'importer en masse des **équipements**, **tickets** et **coûts associés**, avec photos, dans GLPI. Architecture en deux parties : la **lib métier** (`src/lib/import/`) et l'**UI** (`pages/BackOffice/GlpiImport.tsx`, `ImportVerify.tsx`, `components/GlpiImport/*`).

### 8.1 Lib métier (`src/lib/import/`)

#### `types.ts` (149 lignes)
Types partagés du pipeline :
- `GlpiItemType` — union des 17 types d'équipements supportés (Computer, Monitor, Printer, NetworkEquipment, Peripheral, Phone, Software, Enclosure, PDU, PassiveDCEquipment, Cable, Appliance, SoftwareLicense, Certificate, Socket, Rack, ConsumableItem)
- `AssetRow`, `TicketRow` (avec `items: string[]`), `CostRow` — lignes normalisées des 3 CSV
- `ParsedImage`, `ImageValidationResult` — métadonnées/validation des images extraites du ZIP
- `ValidationSummary` — agrège les résultats CSV1/2/3 + images, avec flag global `canImport`
- `ProgressUpdate` — `{phase, message, current, total}` pour le suivi temps réel
- `ImportReport` — résultat final (succès/rollback, compteurs d'entités créées, erreurs/warnings)

#### `columnSynonyms.ts` (90 lignes)
Dictionnaire multilingue (FR/malgache) de **30+ synonymes d'en-têtes** CSV → nom canonique (ex. `asset_tag`/`otherserial` → `inventory_number`, `anarana` → `name`). `normalizeHeader(raw)` retourne la clé canonique ou `null`.

#### `csvParser.ts` (92 lignes)
`parseCsvText(csvText)` → `{rows, unknownHeaders}` :
- suppression du BOM UTF-8
- détection auto du séparateur (`;` vs `,`)
- découpe respectant les guillemets (`splitRespectingQuotes`)
- normalisation des en-têtes via `normalizeHeader`
- validation minimale : header + ≥1 ligne de données

#### `normalizers.ts` (251 lignes)
Conversion des chaînes brutes en types métier :
- `parseDecimal`, `parseStrictInteger`, `parseTicketRef` (accepte `"42"` ou `"TK-042"`)
- `normalizeDatetime(dateRaw, timeRaw)` → format GLPI `YYYY-MM-DD HH:MM:SS` (supporte plusieurs formats de date/heure FR/malgache)
- `mapTicketType/Status/Priority(raw)` → codes numériques GLPI (multilingue)
- `mapItemType(raw)` → `GlpiItemType | null`
- `parseItemsField(raw)` → `string[]` (JSON ou liste séparée par virgules, dédupliquée case-insensitive — important car GLPI rejette les `Item_Ticket` dupliqués)

#### `validators.ts` (278 lignes)
Validation détaillée avec erreurs/avertissements localisés par numéro de ligne :
- `validateCsv1(rows)` — équipements : requiert `name`, `item_type` ; détecte doublons (name/inventory_number), `item_type` non mappable, statut/localisation vides (warning)
- `validateCsv2(rows)` — tickets : requiert `ref_ticket`, `date`, `heure`, `titre` ; vérifie unicité de `ref_ticket`, format date/heure
- `validateCsv3(rows, validTicketRefs)` — coûts : requiert `num_ticket` existant dans CSV2, vérifie que durée/coûts sont numériques
- `validateImages(images, assetNames)` — vérifie format (jpg/jpeg/png/webp), décodabilité (`createImageBitmap`), classe les images en *linked* (basename matchant un asset), *orphans*, *missing*, *duplicates*, *corrupt*

Chaque résultat contient un flag `hasHardErrors` distinct des warnings, permettant un **import partiel** si seules des warnings sont présentes.

#### `dropdownResolver.ts` (236 lignes)
Classe `DropdownResolver` — cache et résout les listes déroulantes GLPI :
- `preloadAll(token?)` — charge en parallèle (`Promise.allSettled`) ~15 types (State, Location, Manufacturer, *Model par type d'actif, CableType, SocketModel — ces 2 derniers via l'API v2)
- `loadUsers(token?)` — index des utilisateurs par `firstname+realname`, `realname+firstname`, et `login`
- `resolve(type, label)` — lookup O(1) case-insensitive en cache
- `ensureValue(type, label, token?)` — résout ou **crée** la valeur manquante (avec `entities_id=0, is_recursive=1` pour Location/State), recharge le cache en cas de collision
- `ensureUsersExist(fullNames, token?)` — crée les utilisateurs manquants par lots de 5 ; convention malgache "Rakoto Jean" → `realname=Rakoto, firstname=Jean`, login généré (`rakoto.jean`, normalisation NFD, max 63 car.), mot de passe par défaut `"GlpiImport@2026"`

#### `imageExtractor.ts` (96 lignes)
`extractImagesFromZip(file)` — dézippe (JSZip), filtre les formats acceptés (jpg/jpeg/png/webp/gif), **convertit tout en JPEG** (qualité 0.92, via `<canvas>`, fond blanc pour la transparence) car GLPI valide strictement le MIME type ; conserve le *basename* (sans extension) pour le matching avec les équipements.

#### `importOrchestrator.ts` (469 lignes — cœur de l'orchestration)
`runImport(assets, tickets, costs, images, onProgress, token?)` → `ImportReport`, exécuté en **6 phases séquentielles** (avec callback de progression à chaque étape) :

1. **Dropdowns** — `DropdownResolver.preloadAll()`
2. **Users** — `ensureUsersExist()` par lots de 5 (warnings non bloquantes)
3. **Assets** — création par lots de 5, ordre Computer → Monitor → autres ; **rollback immédiat** en cas d'erreur
4. **Images** — upload séquentiel (contrainte de verrouillage PHP/GLPI), upload + liaison en 2 requêtes (`uploadDocumentToGlpi` + `linkDocumentToItem`)
5. **Tickets** — création avec `status=1` (Nouveau), puis `Item_Ticket` pour chaque équipement lié, puis mise à jour du statut final
6. **Costs** — `TicketCost` pour chaque ligne CSV3, résolution `ref_ticket → glpi_id`, rollback si référence absente

`countExistingAssets(token?)` — utilitaire pour compter Computer/Monitor existants (probablement pour pré-validation).

**Rollback** : suppression en cascade (TicketCost → Item_Ticket → Ticket → Documents → Assets par type), erreurs de rollback tracées séparément.

**Dépendances** : `@/api/glpi` (createItem/updateItem/deleteItems/listItems), `@/api/glpiV2` (Socket et types v2-only), `@/api/glpiDocuments` (upload/liaison images).

### 8.2 UI du module Import

#### `src/pages/BackOffice/GlpiImport.tsx` (226 lignes)
Page principale, machine à états à 5 phases : `upload → validating → validated → importing → done`.
- **upload** : 4 fichiers requis (CSV équipements, CSV tickets, CSV coûts, ZIP images)
- **validating** : parse les 3 CSV + extrait le ZIP, lance `validateCsv1/2/3` + `validateImages` en parallèle
- **validated** : affiche `ValidationReport` ; le bouton import n'est actif que si `canImport`
- **importing** : appelle `runImport()` avec abonnement `onProgress`, affiche `ImportProgress`
- **done** : affiche `ImportFinalReport`, possibilité de revenir à `upload`

#### `src/pages/BackOffice/ImportVerify.tsx` (469 lignes, + `.css`)
Page de **vérification post-import** : récupère en parallèle Computer/Monitor/Ticket/TicketCost/Document depuis GLPI, onglets `assets | tickets | costs | images`.
- `AssetTable`, `TicketTable`, `CostTable` (durée hh:mm, montants EUR), `ImageGrid` (lazy-load des blobs via `fetchDocumentBlob`, `URL.createObjectURL`/`revokeObjectURL` géré au changement d'onglet/démontage)
- `expand_dropdowns=true` pour afficher les libellés au lieu des IDs

#### `src/components/GlpiImport/FileUploadZone.tsx` (109 lignes)
Zone de dépôt de fichier réutilisable (drag&drop + clic), couleurs d'accent par type de fichier (indigo CSV1, cyan CSV2, vert CSV3, ambre ZIP), aperçu du fichier sélectionné + bouton effacer.

#### `src/components/GlpiImport/ImportProgress.tsx` (124 lignes)
Barre de progression globale (7 phases) + barre de progression de l'étape courante (si `total > 0`), liste des étapes avec icônes (en attente / en cours / terminé), bandeau spécifique si `phase === 'rollback'`.

#### `src/components/GlpiImport/ImportFinalReport.tsx` (92 lignes)
Récapitulatif final : bannière succès/échec/rollback, 8 cartes de statistiques (users, computers, monitors, otherAssets, tickets, documents, costs, itemLinks), listes d'erreurs bloquantes, d'avertissements et d'erreurs de rollback ; bouton `onReset`.

#### `src/components/GlpiImport/ValidationReport.tsx` (198 lignes)
Affiche le détail de validation pour CSV1/CSV2/CSV3 (compteurs valides/erreurs/warnings + liste des 8 premières erreurs) et pour les images (badges *found/linked/orphans/missing/duplicates/corrupt*). Bannière verte si `canImport`, rouge sinon.

### 8.3 Formats de fichiers attendus

| Fichier | Colonnes requises | Colonnes optionnelles |
|---|---|---|
| CSV1 (équipements) | `name`, `item_type` | `status`, `location`, `manufacturer`, `model`, `inventory_number`, `user` |
| CSV2 (tickets) | `ref_ticket`, `date`, `heure`, `titre` | `description`, `ticket_type`, `priority`, `status`, `items` (JSON/CSV) |
| CSV3 (coûts) | `num_ticket` | `duration_second`, `time_cost`, `fixed_cost` |
| ZIP images | fichiers `jpg/jpeg/png/webp/gif`, nommés selon `name` de CSV1 | — |

Des exemples sont fournis dans `import/` et `120/` (`A_equipements_modele.csv`, `B_tickets_modele.csv`, `C_.csv`, + `generate_csv.py`).

---

## 9. Module Reset (remise à zéro)

### `src/pages/BackOffice/Reset.tsx` (126 lignes, + `.css`)
Page conteneur avec 2 onglets : **GLPI** et **SQLite**. Bandeau "danger zone", description contextuelle, délègue à `GlpiResetPanel` ou `SqliteResetPanel` selon l'onglet actif.

### `src/components/dataReset/GlpiResetPanel.tsx` (164 lignes)
Reset des données GLPI :
- État machine `idle → confirming → resetting → done`
- ~25 types présélectionnés (Ticket, Problem, Change, Computer, Monitor, NetworkEquipment, Peripheral, Phone, Printer, Rack, Enclosure, PDU, PassiveDCEquipment, Cable, Appliance, SoftwareLicense, Software, Certificate, Socket, Document, Contract, Supplier, Contact, Budget, User non-admin)
- Sélection/désélection globale, `ConfirmModal` avant exécution
- Exécution : `purgeAllItems()` (et `purgeAllItemsV2()` pour `Socket`), `purgeNonAdminUsers()` pour les utilisateurs, avec barre de progression `current/total`
- **Préserve** : administrateurs, profils/rôles, permissions, entités, configuration système
- Résultat affiché via `ResetReport`

### `src/components/dataReset/SqliteResetPanel.tsx` (178 lignes)
Reset de la base SQLite annexe :
- État machine `loading → idle → confirming → resetting → done` (+ `error`)
- `listSqliteTables()` au chargement → liste `{name, rowCount}`, sélection multiple
- `ConfirmModal` puis `resetSqliteTables(selected)` → affichage `totalDeleted` + tables réinitialisées
- Gestion d'erreur avec bouton "Réessayer"

### `src/components/ResetReport/ResetReport.tsx` (152 lignes, + `.css`)
Rapport générique : cartes de synthèse (total supprimé, tables/types affectés, total erreurs), tableau détaillé par type (`itemType`, `deleted`, `skipped`, badge de statut, erreurs repliables), section optionnelle pour les résultats d'import CSV (`importResults`).

---

## 10. Backend Spring Boot (`backend/`)

Service annexe **Spring Boot 3.3.5 / Java 17**, port **8087**, base **SQLite** (`./data/glpi.db`, Hibernate `update`). Sert : paramètres Kanban (`KanbanSettingApi`), CRUD d'actifs basique, et reset de tables SQLite.

### 10.1 Configuration

- **`config/CorsConfig.java`** — autorise CORS sur `/api/**` pour `http://localhost:5173`, `http://localhost:3000`, `http://localhost:8080` (méthodes GET/POST/PUT/DELETE/PATCH, credentials activés), origines lues depuis `app.cors.allowed-origins`.
- **`config/SettingDataInitializer.java`** (`CommandLineRunner`) — au démarrage, si la table `settings` est vide, insère 9 réglages par défaut (couleurs Kanban `kanban_color_new/in_progress/done`, libellés `status_name_*` en FR/malgache, titres de colonnes).
- **`application.properties`** — `spring.datasource.url=jdbc:sqlite:./data/glpi.db`, driver `org.sqlite.JDBC`, dialect Hibernate `SQLiteDialect`, `ddl-auto=update`, `show-sql=false`.

### 10.2 Controllers

#### `AssetController` — `/api/assets`
| Méthode | Chemin | Description |
|---|---|---|
| GET | `/` | Liste tous les `Asset` |
| GET | `/{id}` | Un `Asset` ou 404 |
| POST | `/` | Crée un `Asset` |
| PUT | `/{id}` | Met à jour (name/type/serialNumber/location/status) ou 404 |
| DELETE | `/{id}` | Supprime (204) ou 404 |

#### `SettingController` — `/api/backoffice/settings`
| Méthode | Chemin | Description |
|---|---|---|
| GET | `/` | Liste tous les `Setting` |
| GET | `/{key}` | Valeur du paramètre (chaîne vide si absent) |
| PUT | `/{key}` | Crée/met à jour (nettoie les guillemets JSON entourants) |

> C'est cet endpoint que consomme `src/api/kanbanSetting.ts` (`KanbanSettingApi`).

#### `SqliteTableResetController` — `/api/sqlite`
| Méthode | Chemin | Description |
|---|---|---|
| GET | `/tables` | Liste les tables + `rowCount` (`SqliteTableDto[]`) |
| POST | `/tables/reset` | Vide les tables demandées (whitelistées) → `SqliteTableResetResponse` |

> Consommé par `src/api/sqliteReset.ts`.

### 10.3 Services

- **`SettingService`** — `getAllSettings()`, `getSettingsMap()` (→ `Map<String,String>`), `getSetting(key, default)`, `updateSetting(key, value)` (insert-or-update).
- **`SqliteTableResetService`** — `listTables()` (énumère via `sqlite_master`, compte les lignes) ; `resetTables(requestedTables)` (`@Transactional`, filtre par whitelist des tables existantes, `DELETE` de toutes les lignes, retourne le rapport).

### 10.4 Repositories

- **`AssetRepository`** — `JpaRepository<Asset, Long>` + `findByType`, `findByStatus`.
- **`SettingRepository`** — `JpaRepository<Setting, String>` (clé = `key`).
- **`SqliteTableResetRepository`** — accès `JdbcTemplate` brut : `listTableNames()` (depuis `sqlite_master`), `countRows(table)`, `deleteAllRows(table)` (nom de table entre guillemets doubles, protection par whitelist en amont).

### 10.5 Modèles / DTOs

- **`Asset`** (table `assets`) — `id`, `name` (`@NotBlank`), `type`, `serialNumber`, `location`, `status`.
- **`Setting`** (table `settings`) — `key` (PK), `value`. Exemples : `kanban_color_new/in_progress/done`, `status_name_new/in_progress/done`, `kanban_title_*`.
- **`SqliteTableDto`** — `{name, rowCount}`.
- **`SqliteTableResetRequest`** — `{tableNames: List<String>}` (`@NotEmpty`).
- **`SqliteTableResetResponse`** — `{success, message, totalDeleted, resetTables[]}`.

### 10.6 Sécurité / robustesse

- Protection contre l'injection SQL via **whitelist** des noms de table (issue de `sqlite_master`) avant toute opération `DELETE`.
- `resetTables()` est transactionnel (tout ou rien).
- Initialisation des settings **idempotente** (vérifie le count avant insertion).

---

## 11. Points d'attention transverses (dette technique / sécurité)

1. **`ProtectedRoute`** ne fait que vérifier la présence d'un token en `localStorage`, sans valider sa validité côté serveur ni gérer son expiration.
2. **`TicketDetail.tsx`** utilise `dangerouslySetInnerHTML` sans sanitization (risque XSS si le contenu provient de saisies utilisateur).
3. **Stockage des tokens en `localStorage`** (sessionToken, appToken) — exposé en cas de XSS ; pas de cookies `httpOnly`.
4. **Incohérence de ports** : `vite.config.ts` proxy `/api` → `8081`, mais le backend Spring Boot écoute sur `8087` et `src/api/kanbanSetting.ts` / `sqliteReset.ts` appellent `http://localhost:8087` en dur (le proxy `/api` ne semble pas utilisé).
5. **`src/routes/appRoutes.tsx`** semble être une version obsolète/non utilisée des routes (doublon de `App.tsx`, sans `ProtectedRoute`).
6. **Nombreux stubs UI** non implémentés : recherche topbar, export (Inventory/TicketsList/Settings), actions de masse sur tickets (`TicketsList`), toolbar de formatage dans `TicketDetail`, bouton "New Ticket".
7. **Duplication fonctionnelle** : `Tickets.tsx` et `TicketsList.tsx` couvrent un périmètre très proche (liste de tickets) avec deux implémentations différentes ; `SummaryPanel/StatusBadge.tsx` duplique `components/StatusBadge.tsx`.
8. **`Invotentory.tsx`** — faute de frappe dans le nom de fichier (composant exporté reste `Inventory`), statut "En service" codé en dur (non dynamique).
9. **`CsvImporter.tsx`** — parseur CSV naïf (pas de gestion avancée des guillemets/retours à la ligne dans les valeurs), à ne pas confondre avec le pipeline robuste `lib/import/`.
10. **Mot de passe par défaut codé en dur** pour les utilisateurs créés automatiquement lors de l'import (`"GlpiImport@2026"`, dans `dropdownResolver.ts`) et mot de passe pré-rempli `"glpi"` sur la page `Login.tsx`.
