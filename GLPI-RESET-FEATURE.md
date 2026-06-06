Analyse Détaillée : Flux API et Mapping des Données (Reset & Import)
Ce document explique en détail et techniquement quelles API sont appelées, pour quelles données (CSV par CSV), et comment les données sont associées (Mapping) dans l'application.

1. Processus de Réinitialisation (/reset)
La réinitialisation est divisée en deux moteurs distincts selon l'onglet choisi.

A. Reset GLPI (Purge via API REST GLPI)
Géré par GlpiResetPanel.tsx et la fonction purgeAllItems dans src/api/glpi.ts. Il cible 17 types d'objets GLPI (Tickets, Computers, Monitors, Users, etc.).

Séquence des appels API pour les équipements standards :

Lister les éléments existants : GET /apirest.php/{ItemType}?range=0-9999
Purger par lot (Batch de 50) : L'application extrait les IDs existants et utilise la méthode de suppression de masse GLPI en forçant la purge définitive (pas de corbeille). DELETE /apirest.php/{ItemType}?force_purge=1
Payload (Body) : { "input": [ {"id": 1}, {"id": 2} ] }
Séquence des appels API pour les Utilisateurs (Exception) : La fonction purgeNonAdminUsers est conçue pour ne supprimer que les utilisateurs standards, préservant les administrateurs.

GET /apirest.php/Profile : Récupère tous les profils et isole ceux dont le nom contient "admin".
GET /apirest.php/Profile_User : Récupère les liaisons Utilisateur ↔ Profil pour identifier les IDs des utilisateurs admins.
GET /apirest.php/User : Récupère tous les utilisateurs.
DELETE /apirest.php/User?force_purge=1 : Purge uniquement les IDs non-admins identifiés. (L'ID 1 de GLPI est toujours préservé en dur).
B. Reset SQLite (Purge locale)
Géré par SqliteResetPanel.tsx et src/api/sqliteReset.ts. Il communique avec un backend custom (Node/Express/autre) qui gère la base de données locale du projet frontend.

Lister les tables : GET /api/sqlite/tables
Vider les tables : POST /api/sqlite/tables/reset avec le payload { "tableNames": ["table1", "table2"] }
2. Processus d'Importation (/import)
Géré par importOrchestrator.ts. L'importation s'exécute de façon séquentielle stricte car les données dépendent les unes des autres.

Pré-requis (Phase 1) : Les Listes Déroulantes (Dropdowns)
Avant d'importer les fichiers, l'orchestrateur parse les colonnes de catégories (Status, Location, Manufacturer, Model) du CSV 1. Il appelle GET /apirest.php/State, Location, Manufacturer, ComputerModel, etc. Si une valeur (ex: Fabricant "Dell") du CSV n'existe pas dans GLPI, l'orchestrateur la crée à la volée via POST /apirest.php/Manufacturer avec le payload { "input": { "name": "Dell" } } et récupère son ID.

A. CSV 1 : Inventaire des Équipements (test-feuille1.csv)
Colonnes CSV : Name, Status, Location, Manufacturer, Item_Type, Model, Inventory_Number, User

1. Vérification des utilisateurs

GLPI a besoin de la clé étrangère de l'utilisateur (users_id). Le script extrait la colonne User, vérifie si l'utilisateur existe dans GLPI via GET /apirest.php/User et le crée si nécessaire (POST /apirest.php/User).
2. Création de l'équipement

Selon la colonne Item_Type, l'API appelée sera POST /apirest.php/Computer ou POST /apirest.php/Monitor.
Mapping CSV → GLPI (Payload JSON) :
Name ➔ input.name
Inventory_Number ➔ input.otherserial
Status ➔ input.states_id (ID GLPI récupéré en phase 1)
Location ➔ input.locations_id (ID GLPI)
Manufacturer ➔ input.manufacturers_id (ID GLPI)
Model ➔ input.computermodels_id (ou monitormodels_id) (ID GLPI)
User ➔ input.users_id (ID GLPI)
B. L'Archive ZIP (Images / Photos)
Les images sont extraites du ZIP en mémoire. L'orchestrateur fait correspondre le nom du fichier (ex: PC-ADM-001.png) avec le champ Name du CSV 1. S'il y a correspondance, il a l'ID GLPI de l'équipement.

Séquence des appels API :

Upload du document (seul) : POST /apirest.php/Document
Le payload est un "multipart/form-data" contenant un fichier binaire et un JSON manifest manifestant le nom du fichier. Il retourne l'ID du document GLPI (docId).
Liaison du document à l'équipement : POST /apirest.php/Document_Item
Payload : { "input": { "documents_id": docId, "items_id": AssetId, "itemtype": "Computer" } }
C. CSV 2 : Tickets d'Incidents (test-feuille2.csv)
Colonnes CSV : Ref_Ticket, Date, Heure, Type, Titre, Description, Status, Priority, Items

1. Création du Ticket

API : POST /apirest.php/Ticket
Mapping CSV → GLPI (Payload JSON) :
Titre ➔ input.name
Description ➔ input.content
Type ➔ input.type (Converti en int : 1 pour Incident, 2 pour Request)
Status ➔ input.status (Converti en int : 1 pour New, 2 pour Assigned, 5 pour Solved, etc.)
Priority ➔ input.priority (Converti en int de 1 à 5)
Date + Heure ➔ input.date (Reformaté en YYYY-MM-DD HH:MM:SS)
L'API retourne un TicketId GLPI natif. Le code garde en mémoire un dictionnaire associant votre Ref_Ticket (du CSV) au nouveau TicketId généré par GLPI.

2. Liaison des équipements impliqués

La colonne Items contient un tableau JSON de noms d'équipements (ex: ["PC-ADM-001", "MN-DIR-002"]).
Pour chaque équipement mentionné, le script retrouve l'ID GLPI de l'équipement (créé grâce au CSV 1).
API : POST /apirest.php/Item_Ticket
Payload : { "input": { "tickets_id": TicketId, "itemtype": "Computer", "items_id": AssetId } }
D. CSV 3 : Coûts des Tickets (test-feuille3.csv)
Colonnes CSV : Num_Ticket, Duration_second, Time_Cost, Fixed_Cost

L'orchestrateur utilise le Num_Ticket de votre CSV, cherche dans son dictionnaire (créé à l'étape précédente) pour retrouver le vrai TicketId GLPI associé.

API : POST /apirest.php/TicketCost
Mapping CSV → GLPI (Payload JSON) :
(Généré) ➔ input.name = "Coût d'intervention"
(Dictionnaire) ➔ input.tickets_id = TicketId GLPI
Duration_second ➔ input.actiontime (durée en secondes)
Time_Cost ➔ input.cost_time (valeur financière du temps passé)
Fixed_Cost ➔ input.cost_fixed (coût matériel / forfaitaire fixe)
Résumé de la mécanique (Rollback)
L'intégralité du code (dans importOrchestrator.ts) gère ces appels dans un bloc try/catch. Si n'importe laquelle de ces requêtes GLPI venait à échouer (erreur 400 ou 500) au milieu de l'import, la fonction de rollback() est exécutée et lance des requêtes DELETE (identiques à la mécanique de reset GLPI) pour détruire tout ce qui a été partiellement importé, garantissant l'intégrité de GLPI.

