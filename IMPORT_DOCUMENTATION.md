# Documentation technique - Système d'import de données (GLPI)

Date: 2026-06-07

Résumé: ce document décrit en détail l'architecture, le pipeline, les règles
de validation, la gestion des erreurs, le traitement des images et la
conversion JPEG pour l'import de données vers GLPI tel qu'implémenté
dans le projet. Toutes les règles documentées sont tracées vers leur
implémentation dans le code source (fichiers et fonctions).

---

Table des matières
1. Introduction
2. Architecture générale
3. Pipeline d'import (étapes détaillées)
4. Fichiers impliqués (liste et rôle)
5. Services et appels GLPI
6. Parsing et normalisation des CSV
7. Règles de validation (CSV1 / CSV2 / CSV3)
8. Gestion des doublons et cohérences croisées
9. Gestion des erreurs et mécanisme de rollback
10. Traitement des images
11. Conversion vers JPEG (paramètres précis)
12. Stockage et nommage des images dans GLPI
13. Bonnes pratiques observées
14. Points d'attention et limitations (comportements non déterminables)
15. Fichiers critiques — résumé

---

## 1. Introduction

Objectif: documenter exhaustivement le mécanisme d'import du projet en
se basant sur le code existant, sans supposer de comportements non
explicités par le code. Le périmètre principal est `src/lib/import`,
complété par les composants UI et les modules d'API GLPI.

## 2. Architecture générale

- Frontend upload & validation:
  - UI upload & preview: [src/components/GlpiImport/FileUploadZone.tsx](src/components/GlpiImport/FileUploadZone.tsx)
  - Page orchestration: [src/pages/BackOffice/GlpiImport.tsx](src/pages/BackOffice/GlpiImport.tsx)
  - Rapport de validation: [src/components/GlpiImport/ValidationReport.tsx](src/components/GlpiImport/ValidationReport.tsx)

- Librairie d'import (logic core): [src/lib/import/*](src/lib/import)
  - Parsing CSV: `parseCsvText()` — [src/lib/import/csvParser.ts](src/lib/import/csvParser.ts)
  - Normalisation: [src/lib/import/normalizers.ts](src/lib/import/normalizers.ts)
  - Dictionnaire d'en-têtes: `COLUMN_SYNONYMS` — [src/lib/import/columnSynonyms.ts](src/lib/import/columnSynonyms.ts)
  - Validation: `validateCsv1`, `validateCsv2`, `validateCsv3`, `validateImages` — [src/lib/import/validators.ts](src/lib/import/validators.ts)
  - Extraction d'images ZIP & conversion: `extractImagesFromZip()` — [src/lib/import/imageExtractor.ts](src/lib/import/imageExtractor.ts)
  - Résolution dropdowns / création utilisateurs: `DropdownResolver` — [src/lib/import/dropdownResolver.ts](src/lib/import/dropdownResolver.ts)
  - Orchestrateur d'import (exécution, rollback): `runImport()` — [src/lib/import/importOrchestrator.ts](src/lib/import/importOrchestrator.ts)

- API GLPI: wrappers HTTP → [src/api/glpi.ts](src/api/glpi.ts) et documents → [src/api/glpiDocuments.ts](src/api/glpiDocuments.ts)

Diagramme textuel (flux principal):

```mermaid
flowchart TD
  U[Utilisateur UI] -->|Choisit fichiers| GLPI_UI[GlpiImport page]
  GLPI_UI --> CSV_PARSE[parseCsvText()]
  CSV_PARSE --> VALID[validateCsv1/2/3]
  GLPI_UI --> ZIP_EXTRACT[extractImagesFromZip()]
  VALID --> VALID_IMG[validateImages()]
  VALID_IMG --> ORCH[runImport()]
  ORCH --> GLPI_API[api/glpi.ts & api/glpiDocuments.ts]
  GLPI_API --> GLPI_SERVER[Serveur GLPI REST]
  ORCH -->|rollback| GLPI_API
```

## 3. Pipeline d'import (étapes détaillées)

1. L'utilisateur choisit 3 CSV + 1 ZIP via l'UI — composant:
   - [src/components/GlpiImport/FileUploadZone.tsx](src/components/GlpiImport/FileUploadZone.tsx)
2. Lecture des fichiers (FileReader) et parsing CSV:
   - `readFileAsText()` dans [src/pages/BackOffice/GlpiImport.tsx](src/pages/BackOffice/GlpiImport.tsx)
   - `parseCsvText()` dans [src/lib/import/csvParser.ts](src/lib/import/csvParser.ts)
3. Validation logique côté client:
   - `validateCsv1()`, `validateCsv2()`, `validateCsv3()` dans [src/lib/import/validators.ts](src/lib/import/validators.ts)
   - `extractImagesFromZip()` pour obtenir `ParsedImage[]` — [src/lib/import/imageExtractor.ts](src/lib/import/imageExtractor.ts)
   - `validateImages()` pour lien→actifs, doublons, corrupt — [src/lib/import/validators.ts](src/lib/import/validators.ts)
4. Si aucune erreur bloquante (hasHardErrors), `canImport` = true et l'utilisateur peut lancer l'import.
5. Orchestrateur `runImport()` exécute l'import réel vers GLPI —
   - précharge des dropdowns (`DropdownResolver.preloadAll`) — [src/lib/import/dropdownResolver.ts](src/lib/import/dropdownResolver.ts)
   - création des utilisateurs manquants (`ensureUsersExist`)
   - création assets (Computers / Monitors) avec `createItem()` — [src/api/glpi.ts](src/api/glpi.ts)
   - upload images (séquentiel), via `uploadDocumentToGlpi()` et `linkDocumentToItem()` — [src/api/glpiDocuments.ts](src/api/glpiDocuments.ts)
   - création tickets, liens Item_Ticket, puis coûts (TicketCost)
   - rollback partiel en cas d'erreur critique (suppression des entités créées) — [src/lib/import/importOrchestrator.ts::rollback]

## 4. Fichiers impliqués (liste et rôle)

- [src/lib/import/csvParser.ts](src/lib/import/csvParser.ts): parsing CSV, détection séparateur, gestion des guillemets et BOM.
- [src/lib/import/columnSynonyms.ts](src/lib/import/columnSynonyms.ts): dictionnaire de synonymes pour normaliser les en-têtes.
- [src/lib/import/normalizers.ts](src/lib/import/normalizers.ts): parseDecimal, parseStrictInteger, normalizeDatetime, mappages Ticket/Item.
- [src/lib/import/validators.ts](src/lib/import/validators.ts): règles de validation des CSV1/CSV2/CSV3 et validation des images.
- [src/lib/import/imageExtractor.ts](src/lib/import/imageExtractor.ts): extraction d'images depuis ZIP et conversion vers JPEG via Canvas.
- [src/lib/import/dropdownResolver.ts](src/lib/import/dropdownResolver.ts): résout/crée les valeurs de dropdown (State, Location, Manufacturer, Models, Users).
- [src/lib/import/importOrchestrator.ts](src/lib/import/importOrchestrator.ts): orchestration, progression, création/rollback et uploads.
- [src/api/glpi.ts](src/api/glpi.ts): wrapper REST GLPI (createItem, listItems, deleteItems, fetchDocumentBlob, etc.).
- [src/api/glpiDocuments.ts](src/api/glpiDocuments.ts): upload des documents multipart/form-data et liaison Document_Item (fallback PUT).
- UI: [src/pages/BackOffice/GlpiImport.tsx](src/pages/BackOffice/GlpiImport.tsx) et composants `FileUploadZone`, `ValidationReport`.

De plus: dossier `import/` (script Python `generate_csv.py`) contient outils auxiliaires pour générer des CSV d'exemple — [import/generate_csv.py](import/generate_csv.py).

## 5. Services et appels GLPI

- Appels principaux (fonctions):
  - `createItem(itemType, data)` — [src/api/glpi.ts](src/api/glpi.ts)
  - `listItems(type, range)` — [src/api/glpi.ts](src/api/glpi.ts)
  - `deleteItems(type, ids)` — [src/api/glpi.ts](src/api/glpi.ts)
  - `uploadDocumentToGlpi(name, blob, filename)` — [src/api/glpiDocuments.ts](src/api/glpiDocuments.ts)
  - `linkDocumentToItem(documentId, itemtype, itemsId)` — [src/api/glpiDocuments.ts](src/api/glpiDocuments.ts)

Les fonctions utilisent l'`App-Token` (VITE_GLPI_APP_TOKEN) et le `Session-Token`
(stocké en localStorage ou via `VITE_GLPI_SESSION_TOKEN`). Voir [src/api/glpi.ts](src/api/glpi.ts) et [src/lib/sessionToken.ts](src/lib/sessionToken.ts).

## 6. Parsing et normalisation des CSV

- `parseCsvText(csvText)` — [src/lib/import/csvParser.ts](src/lib/import/csvParser.ts):
  - supprime BOM UTF-8
  - détecte séparateur `;` ou `,` à partir de la première ligne
  - découpe en respectant les guillemets (fonction `splitRespectingQuotes`)
  - normalise les en-têtes via `normalizeHeader()` de [src/lib/import/columnSynonyms.ts](src/lib/import/columnSynonyms.ts); les en-têtes inconnues sont conservées et listées dans `unknownHeaders`.

- Extrait de code représentatif (parsing + normalisation des en-têtes):

```ts
// src/lib/import/csvParser.ts
const rawHeaders = splitRespectingQuotes(firstLine, separator)
const canonicalHeaders = rawHeaders.map(h => {
  const raw = h.trim().replace(/^["']|["']$/g, '')
  const canonical = normalizeHeader(raw)
  if (!canonical) unknownHeaders.push(raw)
  return canonical ?? raw
})
```

## 7. Règles de validation (détaillées, avec traçabilité)

Important: pour chaque règle ci-dessous je référence la fonction et le fichier qui l'implémente.

- CSV1 — Inventaire: `validateCsv1(rows)` — [src/lib/import/validators.ts](src/lib/import/validators.ts)
  - Colonnes obligatoires (contrôlées si le CSV possède au moins une ligne): `REQUIRED_CSV1 = ['name','status','item_type','inventory_number']` (implémenté au début de `validateCsv1`).
    - Message: `Colonne obligatoire manquante : "<col>"`
  - Pour chaque ligne:
    - `name` non vide — sinon erreur: `Nom vide`
    - `inventory_number` non vide — sinon erreur: `Numéro d'inventaire vide`
    - `status` vide → avertissement: `Statut vide — sera ignoré`
    - `item_type` mappé via `mapItemType()` ([src/lib/import/normalizers.ts](src/lib/import/normalizers.ts)) ; si inconnu → erreur: `Type d'objet inconnu : "..." — attendus : Computer, Monitor, Printer, NetworkEquipment, Peripheral, Phone, Software`
    - Doublons détectés (insensibles à la casse):
      - `name` en doublon → erreur: `Doublon détecté : "<name>"`
      - `inventory_number` doublon → erreur: `Numéro d'inventaire en doublon : "<inv>"`
  - Résultat: `Csv1ValidationResult` contient `parsed`, `errors`, `hasHardErrors`.

- CSV2 — Tickets: `validateCsv2(rows)` — [src/lib/import/validators.ts](src/lib/import/validators.ts)
  - Colonnes obligatoires: `REQUIRED_CSV2 = ['ref_ticket','date','heure','titre']`.
  - `ref_ticket`:
    - doit être un entier strict (`parseStrictInteger`) — sinon: `Ref_Ticket invalide : "..." — doit être un entier`.
    - doit être > 0 — sinon: `Ref_Ticket doit être > 0, reçu : <n>`.
    - doublon → erreur: `Doublon Ref_Ticket : <n>`.
  - `date`+`heure` normalisées via `normalizeDatetime(date, heure)` — si invalide → `Date/heure non reconnu : "<date> <heure>"`.
  - `titre` non vide — sinon: `Titre vide`.
  - `type`, `status`, `priority` mappés via `mapTicketType`, `mapTicketStatus`, `mapTicketPriority` (valeurs par défaut appliquées si non reconnues: type=1, status=1, priority=3).
  - `items` parsé via `parseItemsField` (JSON array ou fallback CSV string) — [src/lib/import/normalizers.ts](src/lib/import/normalizers.ts).

- CSV3 — Coûts: `validateCsv3(rows, validTicketRefs)` — [src/lib/import/validators.ts](src/lib/import/validators.ts)
  - Colonnes obligatoires: `REQUIRED_CSV3 = ['num_ticket']`.
  - `num_ticket` doit être entier et référencer un `ref_ticket` présent dans CSV2 (contrôle via `validTicketRefs` fourni par l'appelant). Si pas trouvé → erreur: `Num_Ticket <n> ne correspond à aucun Ref_Ticket du CSV 2`.
  - `duration_second`, `time_cost`, `fixed_cost` parsés via `parseDecimal()` — erreur si format invalide.
  - `duration_second` non entier → avertissement: `Duration_second "<raw>" arrondi à <rounded> s`.

Extrait de messages (implémentation exacte):

```ts
errors.push({ rowIndex: idx, column: 'name', severity: 'error', message: 'Nom vide' })
errors.push({ rowIndex: idx, column: 'inventory_number', severity: 'error', message: "Numéro d'inventaire vide" })
errors.push({ rowIndex: idx, column: 'item_type', severity: 'error', message: `Type d'objet inconnu : "${itemTypeRaw}" — attendus : Computer, Monitor, Printer, NetworkEquipment, Peripheral, Phone, Software` })
```

## 8. Gestion des doublons et cohérences croisées

- Doublons CSV1: `validateCsv1` utilise `seenNames` et `seenInvNumbers` (Map/Set case-insensitive) pour détecter doublons (erreur).
- Doublons images: `validateImages` construit `seenBasenames` (Map) et remplit `duplicates` si plus d'une image a le même basename (liste retournée).
- Références croisées: CSV3 vérifie que `num_ticket` existe dans les refs de CSV2 (via `validTicketRefs`), sinon erreur.
- Liens ticket↔asset: lors de l'import, si un ticket référence un asset non trouvé, un avertissement est ajouté: `Ticket <ref>: actif "<name>" non trouvé — lien ignoré` (voir [src/lib/import/importOrchestrator.ts](src/lib/import/importOrchestrator.ts)).

## 9. Gestion des erreurs et mécanisme de rollback

- Trois types de traitement des erreurs:
  - Erreurs de validation (bloquantes) détectées avant import: empêchent l'import (`canImport = false`).
  - Erreurs durant l'exécution de `runImport()` pour étapes critiques (création d'actif, création de ticket, création de coût) → effectue `rollback()` et retourne `success: false, rolledBack: true`.
  - Erreurs liées aux images → traitées en `warnings` (upload best-effort). L'import continue même si certains uploads échouent.

- `rollback(registry)` — [src/lib/import/importOrchestrator.ts](src/lib/import/importOrchestrator.ts):
  - tente de supprimer dans l'ordre: `TicketCost`, `Item_Ticket`, `Ticket`, `Document`, `Monitor`, `Computer` en appelant `deleteItems()`.
  - les erreurs de rollback sont collectées et retournées.

- Décisions d'implémentation observées:
  - Upload des images: pas de rollback si l'upload échoue — les erreurs sont transformées en `warnings`.
  - Création d'un asset/ticket/coût qui échoue déclenche rollback (suppression des entités créées précédemment).

## 10. Traitement des images (extraction, validation, mise en correspondance)

- Extraction depuis ZIP: `extractImagesFromZip(file: File)` — [src/lib/import/imageExtractor.ts](src/lib/import/imageExtractor.ts)
  - Utilise `JSZip` pour parcourir les entrées non-dir
  - Filtre les fichiers par extension (ACCEPTED_EXTS = jpg, jpeg, png, webp, gif)
  - Pour chaque image:
    - lit le contenu `entry.async('arraybuffer')` → crée un `Blob` avec mime dérivé
    - si JPG/JPEG: conserve tel quel
    - sinon: convertit via `toJpeg(origBlob)` (Canvas)
    - si conversion échoue: garde le blob original et logue un warning
  - Retourne `ParsedImage[]` avec: `filename`, `basename`, `ext`, `blob`, `isValid: false` (sera validé ensuite), `sizeKB`

- Validation des images: `validateImages(images, assetNames)` — [src/lib/import/validators.ts](src/lib/import/validators.ts)
  - ACCEPTED_IMAGE_EXTS = new Set(['jpg','jpeg','png','webp']) — note: **'gif' est absent** ici (incohérence → voir section limitations)
  - Tente de `createImageBitmap(img.blob)` pour vérifier que le blob est lisible; si échec → `corrupt.push(img.filename)` et `img.isValid=false`
  - Construit listes:
    - `linked`: basenames d'images correspondant à un asset (match case-insensitive sur `assetNames`)
    - `orphans`: basenames qui n'ont pas d'asset correspondant
    - `duplicates`: fichiers avec même basename
    - `missing`: assets sans image (calculé en comparant `assetNames` et `seenBasenames`)

## 11. Conversion vers JPEG — paramètres précis

- Fonction: `toJpeg(source: Blob): Promise<Blob>` — [src/lib/import/imageExtractor.ts](src/lib/import/imageExtractor.ts)
  - Utilise `createImageBitmap(source)` → `canvas` → `drawImage(bitmap, 0,0)`.
  - Fond blanc appliqué avant le draw: `ctx.fillStyle = '#ffffff'; ctx.fillRect(...)` (plat la transparence PNG sur blanc).
  - Qualité JPEG: `canvas.toBlob(..., 'image/jpeg', 0.92)` — qualité fixe `0.92`.
  - Résolution / redimensionnement: **aucun** redimensionnement n'est effectué — la largeur/hauteur sont celles de l'image source (`canvas.width = bitmap.width`).
  - Métadonnées / EXIF: **aucun** traitement explicite (aucune lecture ni suppression d'EXIF, ni rotation basée sur orientation EXIF).
  - Rotation / orientation: **aucune** gestion explicite trouvée dans le code.

Extrait (implémentation):

```ts
const bitmap = await createImageBitmap(source)
const canvas = document.createElement('canvas')
canvas.width = bitmap.width; canvas.height = bitmap.height
const ctx = canvas.getContext('2d')!
ctx.fillStyle = '#ffffff'
ctx.fillRect(0,0,canvas.width,canvas.height)
ctx.drawImage(bitmap,0,0)
return new Promise((resolve,reject)=> canvas.toBlob(b=> b? resolve(b): reject(new Error('canvas.toBlob returned null')), 'image/jpeg', 0.92))
```

## 12. Stockage et nommage des images dans GLPI

- Lors de l'upload:
  - `importOrchestrator` appelle `uploadDocumentToGlpi(img.basename, img.blob, img.filename, token)` — [src/lib/import/importOrchestrator.ts](src/lib/import/importOrchestrator.ts)
  - `uploadDocumentToGlpi` construit un manifest JSON: `input: { name, entities_id: 0, is_recursive: 0, _filename: [filename] }` et envoie `filename[0]` dans `FormData` au endpoint `POST /Document` — [src/api/glpiDocuments.ts](src/api/glpiDocuments.ts)
  - Le `name` passé au Document GLPI est le `basename` (ex: `PC-ADM-001`), le fichier envoyé porte le `filename` (peut être converti en `.jpg`).
  - Liaisons asset↔document: tente `createItem('Document_Item', {...})`. Si création directe échoue, utilise fallback `PUT /Document/{id}` avec `itemtype` et `items_id` — implémenté dans [src/api/glpiDocuments.ts](src/api/glpiDocuments.ts).

Conséquence: le Document GLPI contient `name` = basename, et le fichier physique est l'upload multipart (nom de fichier = `filename`).

## 13. Bonnes pratiques observées

- Validation forte côté client avant l'appel réseau: réduit les erreurs côté serveur.
- Préchargement des listes (dropdowns) pour réduire les appels bloquants durant la phase de création (`DropdownResolver.preloadAll`).
- Création batchée et exécution en petits lots (`runBatch()` dans `importOrchestrator`) pour limiter des opérations massives et améliorer résilience.
- Upload des images en séquentiel pour éviter des problèmes de verrouillage PHP/GLPI (commentaire explicite dans le code).

## 14. Points d'attention et limitations (comportements non déterminables)

- Incohérence d'extensions acceptées:
  - `imageExtractor.ts` accepte `gif` (ACCEPTED_EXTS inclut `'gif'`), mais `validateImages()` n'inclut pas `'gif'` dans `ACCEPTED_IMAGE_EXTS`. Conclusion: le code peut extraire des GIF depuis l'archive mais les marquer ensuite comme corrompus/inacceptables (voir [src/lib/import/imageExtractor.ts](src/lib/import/imageExtractor.ts) et [src/lib/import/validators.ts](src/lib/import/validators.ts)).

- EXIF / orientation: aucun code ne gère explicitement l'orientation EXIF ni la conservation/suppression des métadonnées. Le comportement concret dépendra du navigateur (createImageBitmap) et de GLPI; **aucune** manipulation EXIF n'est implémentée (recherche: pas de librairie EXIF, pas d'appel explicite).

- Taille max des fichiers / limites GLPI: non déterminable uniquement à partir du code frontend — dépend de la configuration du serveur GLPI (PHP `upload_max_filesize`, GLPI settings). Le code ne limite pas la taille côté client.

- Gestion des formats Excel (XLS/XLSX): **non supporté** dans le code. L'UI et le parser attendent `.csv` (see [src/components/GlpiImport/FileUploadZone.tsx](src/components/GlpiImport/FileUploadZone.tsx) et [src/lib/import/csvParser.ts](src/lib/import/csvParser.ts)).

- Comportement exact des erreurs côté GLPI (codes d'erreur, rollback partiel) dépend de la version/implémentation GLPI; le code suppose que `createItem()` renverra un ID ou lèvera une exception.

## 15. Fichiers critiques — résumé et rôle

- `src/pages/BackOffice/GlpiImport.tsx` — point d'entrée UI pour l'utilisateur, orchestration lecture/validation/import.
- `src/lib/import/csvParser.ts` — parsing CSV robuste (BOM, séparateur, guillemets).
- `src/lib/import/columnSynonyms.ts` — dictionnaire d'en-têtes canonique → sujet central pour tolérance d'en-têtes multilingues.
- `src/lib/import/normalizers.ts` — transformeurs (dates, nombres, mappings d'énums).
- `src/lib/import/validators.ts` — règles métiers (obligatoires, formats, doublons, correspondances images).
- `src/lib/import/imageExtractor.ts` — extraction ZIP + conversion JPEG (qualité 0.92, fond blanc).
- `src/lib/import/dropdownResolver.ts` — assurance des dropdowns et création utilisateurs manquants.
- `src/lib/import/importOrchestrator.ts` — orchestration complète, upload séquentiel d'images, rollback en cas d'erreurs critiques.
- `src/api/glpi.ts` & `src/api/glpiDocuments.ts` — wrappers GLPI REST (createItem, uploadDocumentToGlpi, linkDocumentToItem, deleteItems, etc.).

---

Si vous souhaitez, je peux :
- ajouter des liens directs vers des extraits de lignes précises (L#) pour chaque règle,
- exécuter une passe automatique pour produire un fichier `IMPORT_CHECKLIST.md` listant les actions à réaliser pour rendre le flux plus robuste (ex: gestion EXIF, limite taille, support XLSX),
- ajouter des tests unitaires pour `parseCsvText`, `normalizeDatetime` et la conversion `toJpeg()`.

---

Fait par l'analyse du code source local — aucune supposition externe n'a été faite; tout comportement non explicitement implémenté a été signalé dans la section "Points d'attention et limitations".
