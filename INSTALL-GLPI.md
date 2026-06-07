# Installer GLPI 11 en local sur Ubuntu (sans Docker, reproductible hors ligne)

Guide pas à pas pour réinstaller GLPI 11.0.7 de zéro, basé sur l'installation
réellement effectuée. Pile **native** : PHP + MySQL (pas de XAMPP, pas de Docker).

> ⚠️ « Hors ligne » : les paquets système (`php8.3-*`, `mysql-server`) doivent être
> déjà présents ou récupérés à l'avance (voir §0). Le reste ne nécessite aucun réseau.

---

## 0. Prérequis (à installer une fois, nécessite Internet)

```bash
sudo apt update
sudo apt install -y \
  php8.3-cli php8.3-mysql php8.3-curl php8.3-gd php8.3-intl php8.3-mbstring \
  php8.3-xml php8.3-zip php8.3-bcmath php8.3-bz2 \
  mysql-server
```

> 💡 **Piège vécu** : si `apt install` renvoie une erreur **404** sur un paquet,
> l'index est périmé → relancer `sudo apt update` puis réessayer.

> 💡 **Extension obligatoire oubliée fréquemment** : `bcmath`. Sans elle,
> `db:install` s'arrête sur « bcmath extension is missing ».

Vérifier :

```bash
php -v                          # PHP 8.3.x
php -m | grep -E 'mysqli|gd|intl|mbstring|curl|zip|bcmath'   # toutes présentes
systemctl is-active mysql       # active
```

---

## 1. Récupérer et extraire GLPI

Télécharger `glpi-11.0.7.tgz` depuis https://glpi-project.org/fr/downloads/
(à faire pendant qu'on a Internet ; ensuite l'archive suffit).

```bash
tar -xzf ~/Téléchargements/glpi-11.0.7.tgz -C ~/
# → GLPI est maintenant dans ~/glpi
php ~/glpi/bin/console --version     # doit afficher : GLPI CLI 11.0.7
```

---

## 2. Créer la base de données et l'utilisateur MySQL

Sur Ubuntu, `root` MySQL utilise l'**authentification par socket** → on passe par
`sudo mysql` (pas de mot de passe MySQL, c'est le mot de passe **Linux** qui est demandé).

Créer un fichier `glpi-setup.sql` :

```sql
CREATE DATABASE IF NOT EXISTS glpidb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'glpi'@'localhost' IDENTIFIED BY 'glpi';
GRANT ALL PRIVILEGES ON glpidb.* TO 'glpi'@'localhost';
GRANT SELECT ON mysql.time_zone_name TO 'glpi'@'localhost';
FLUSH PRIVILEGES;
```

L'exécuter, puis charger les **fuseaux horaires** (GLPI les exige) :

```bash
sudo mysql < glpi-setup.sql
sudo mysql_tzinfo_to_sql /usr/share/zoneinfo | sudo mysql mysql
```

Vérifier l'accès avec le compte applicatif :

```bash
mysql -u glpi -pglpi -e "SHOW DATABASES LIKE 'glpidb'; SELECT COUNT(*) FROM mysql.time_zone_name;"
```

---

## 3. Installer le schéma GLPI (en ligne de commande, sans navigateur)

```bash
cd ~/glpi
php bin/console db:install \
  -H localhost -d glpidb -u glpi -p glpi \
  -L fr_FR --no-telemetry --no-interaction --force
```

→ Doit se terminer par **« Installation done. »** (≈ 442 tables créées).

Vérifier :

```bash
mysql -u glpi -pglpi -D glpidb -e \
  "SELECT COUNT(*) AS tables FROM information_schema.tables WHERE table_schema='glpidb';"
```

---

## 4. Démarrer GLPI (serveur PHP intégré — méthode la plus simple)

GLPI 11 a pour racine web le dossier `public/` et utilise `public/index.php`
comme contrôleur frontal (routeur). Lancer :

```bash
cd ~/glpi
php -S localhost:8080 -t public/ public/index.php
```

→ Ouvrir **http://localhost:8080** (laisser ce terminal ouvert).

### Comptes par défaut

| Identifiant | Mot de passe | Rôle |
|---|---|---|
| glpi | glpi | Super-admin |
| tech | tech | Technicien |
| normal | normal | Utilisateur |
| post-only | postonly | Post-only |

> 🔒 GLPI affiche un bandeau demandant de changer ces mots de passe et de supprimer
> le dossier `install/`. Pour un usage local/éval on peut l'ignorer ; en « vrai » :
> `rm -rf ~/glpi/install` et changer les mots de passe.

---

## 5. Activer l'API REST + générer les tokens

Deux façons : **(A)** par l'interface, **(B)** en base. La A est la plus sûre.

### (A) Par l'interface (recommandé)

1. *Configuration → Générale → onglet API* → **Activer l'API REST** = Oui.
2. *Configuration → Générale → API → Clients d'API* → ouvrir
   « full access from localhost » → un **app_token** est affiché (le copier).
3. Profil utilisateur (en haut à droite) → *Préférences → onglet « Jetons d'accès distant »*
   → générer le **jeton d'API** (api_token) → le copier.

### (B) En base (ce qu'on a fait en CLI)

> ⚠️ **PIÈGE MAJEUR GLPI 11** : `app_token` (table `glpi_apiclients`) et `api_token`
> (table `glpi_users`) sont stockés **chiffrés** (sodium xchacha20poly1305, clé
> `config/glpicrypt.key`). Insérer un token en clair échoue avec
> `ERROR_WRONG_APP_TOKEN_PARAMETER` ou `ERROR_GLPI_LOGIN_USER_TOKEN`.
> Il faut **chiffrer** la valeur avant de la stocker, et envoyer le **clair** dans les requêtes.

Activer l'API + corriger l'URL :

```sql
UPDATE glpi_configs SET value='1' WHERE name='enable_api';
UPDATE glpi_configs SET value='1' WHERE name='enable_api_login_external_token';
UPDATE glpi_configs SET value='http://localhost:8080' WHERE name='url_base';
```

Chiffrer un token avec la clé GLPI (script jetable `encrypt-token.php` à la racine de `~/glpi`) :

```php
<?php
$key = file_get_contents(__DIR__.'/config/glpicrypt.key');
$nonce = random_bytes(SODIUM_CRYPTO_AEAD_XCHACHA20POLY1305_IETF_NPUBBYTES);
echo base64_encode($nonce . sodium_crypto_aead_xchacha20poly1305_ietf_encrypt($argv[1], $nonce, $nonce, $key));
```

Puis :

```bash
cd ~/glpi
APP=$(openssl rand -hex 20);  USER=$(openssl rand -hex 20)
APP_ENC=$(php encrypt-token.php "$APP");  USER_ENC=$(php encrypt-token.php "$USER")
mysql -u glpi -pglpi -D glpidb <<SQL
UPDATE glpi_apiclients SET app_token='$APP_ENC', ipv4_range_start=0, ipv4_range_end=4294967295, ipv6=NULL, is_active=1 WHERE id=1;
UPDATE glpi_users SET api_token='$USER_ENC' WHERE name='glpi';
SQL
echo "APP_TOKEN (clair) = $APP"
echo "USER_TOKEN (clair) = $USER"
rm encrypt-token.php          # ne pas laisser traîner (il lit la clé)
php bin/console cache:clear   # IMPORTANT : recharger la config
```

> 💡 Après toute modif directe en base, faire `php bin/console cache:clear`
> **et** redémarrer le serveur (`php -S ...`), sinon l'ancienne config reste en cache.

---

## 6. Tester l'API REST

```bash
APP=...; USER=...   # les valeurs EN CLAIR
# Ouvrir une session
RESP=$(curl -s "http://127.0.0.1:8080/apirest.php/initSession" \
  -H "App-Token: $APP" -H "Authorization: user_token $USER")
echo "$RESP"
SESS=$(echo "$RESP" | grep -o '"session_token":"[^"]*"' | cut -d'"' -f4)
# Lister les ordinateurs
curl -s "http://127.0.0.1:8080/apirest.php/Computer?range=0-9" \
  -H "App-Token: $APP" -H "Session-Token: $SESS"
# Fermer la session
curl -s "http://127.0.0.1:8080/apirest.php/killSession" \
  -H "App-Token: $APP" -H "Session-Token: $SESS" -o /dev/null
```

→ `initSession` doit renvoyer un `session_token`. ✅

---

## 7. Dépannage (problèmes réellement rencontrés)

| Symptôme | Cause | Solution |
|---|---|---|
| `bcmath extension is missing` | extension PHP absente | `sudo apt install php8.3-bcmath` |
| `apt install` → **404** | index apt périmé | `sudo apt update` puis réessayer |
| `Access denied for user 'root'@'localhost'` (MySQL) | root en auth_socket | utiliser `sudo mysql` |
| `ERROR_WRONG_APP_TOKEN_PARAMETER` | app_token en clair / IP hors plage | stocker le token **chiffré** ; élargir `ipv4_range` ; `cache:clear` |
| `ERROR_GLPI_LOGIN_USER_TOKEN` | api_token en clair, ou login token désactivé | stocker chiffré ; `enable_api_login_external_token=1` |
| Modif en base sans effet | config en cache | `php bin/console cache:clear` + redémarrer le serveur |
| API injoignable depuis le front (CORS) | — | GLPI 11 renvoie déjà `Access-Control-Allow-Origin: *` ; sinon passer par un proxy |

---

## Récap express (si tout est déjà installé)

```bash
tar -xzf ~/Téléchargements/glpi-11.0.7.tgz -C ~/
sudo mysql < glpi-setup.sql
sudo mysql_tzinfo_to_sql /usr/share/zoneinfo | sudo mysql mysql
cd ~/glpi && php bin/console db:install -H localhost -d glpidb -u glpi -p glpi -L fr_FR --no-telemetry --no-interaction --force
php -S localhost:8080 -t public/ public/index.php   # → http://localhost:8080 (glpi/glpi)
```
