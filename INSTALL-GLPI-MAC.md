# Installer GLPI 11 en local sur macOS (Homebrew + MySQL Server, sans Docker, sans XAMPP)

Guide adapté pour macOS depuis le guide Ubuntu d'un collègue.
Pile **native** : PHP + MySQL via Homebrew (pas de XAMPP, pas de Docker).

> **Ton environnement actuel** (détecté sur cette machine) :
> - Homebrew 5.1.9 ✅
> - PHP 8.5.5 avec toutes les extensions requises ✅
> - MySQL 9.2.0 installé, **non démarré** ⚠️
>
> → Tu peux sauter les sections §0 et §1 et aller directement au §2.

---

## 0. Prérequis (à installer une fois si pas encore fait)

### Homebrew
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/brew.sh/install.sh)"
```

### PHP + MySQL Server
```bash
brew install php mysql
```

> **Différence clé macOS vs Ubuntu** : pas d'`apt install php8.3-*` séparés.
> Homebrew compile PHP avec la quasi-totalité des extensions incluses
> (`bcmath`, `curl`, `gd`, `intl`, `mbstring`, `mysqli`, `zip`, `bz2`…).

Vérifier :
```bash
php -v                                                       # PHP 8.x
php -m | grep -E 'mysqli|gd|intl|mbstring|curl|zip|bcmath'  # toutes présentes
brew services list | grep mysql                              # doit exister
```

---

## 1. Récupérer et extraire GLPI

Télécharger `glpi-11.0.7.tgz` depuis https://glpi-project.org/fr/downloads/

```bash
# Sur macOS le dossier de téléchargement est ~/Downloads
# (ou ~/Téléchargements si ton macOS est en français)
tar -xzf ~/Downloads/glpi-11.0.7.tgz -C ~/
php ~/glpi/bin/console --version   # doit afficher : GLPI CLI 11.0.7
```

---

## 2. Démarrer MySQL Server

> **Différence clé macOS vs Ubuntu** : on utilise `brew services` au lieu de `systemctl`.

```bash
brew services start mysql
brew services list | grep mysql   # doit afficher : mysql   started
```

### Vérifier que MySQL répond
```bash
mysql -u root -e "SELECT VERSION();"
```

> **Différence clé macOS vs Ubuntu** : sur macOS avec Homebrew, le `root` MySQL
> n'utilise **pas** l'auth socket → on se connecte avec `mysql -u root` directement,
> sans `sudo`. Pas de mot de passe root par défaut à la première installation.
>
> Si MySQL te demande un mot de passe root que tu ne connais pas, reset-le :
> ```bash
> brew services stop mysql
> mysqld_safe --skip-grant-tables &
> mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY ''; FLUSH PRIVILEGES;"
> kill %1
> brew services start mysql
> ```

---

## 3. Créer la base de données et l'utilisateur MySQL

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
# macOS : même commande que Linux, /usr/share/zoneinfo existe bien sur macOS
mysql -u root < glpi-setup.sql
mysql_tzinfo_to_sql /usr/share/zoneinfo | mysql -u root mysql
```

> **Différence clé macOS vs Ubuntu** : pas de `sudo` devant `mysql` ni `mysql_tzinfo_to_sql`.

Vérifier l'accès avec le compte applicatif :

```bash
mysql -u glpi -pglpi -e "SHOW DATABASES LIKE 'glpidb'; SELECT COUNT(*) FROM mysql.time_zone_name;"
```

---

## 4. Installer le schéma GLPI (CLI, sans navigateur)

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

## 5. Démarrer GLPI (serveur PHP intégré)

GLPI 11 a pour racine web le dossier `public/` et utilise `public/index.php` comme contrôleur frontal.

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

---

## 6. Activer l'API REST + générer les tokens

### (A) Par l'interface (recommandé)

1. *Configuration → Générale → onglet API* → **Activer l'API REST** = Oui.
2. *Configuration → Générale → API → Clients d'API* → ouvrir
   « full access from localhost » → copier le **app_token**.
3. Profil utilisateur (en haut à droite) → *Préférences → Jetons d'accès distant*
   → générer le **jeton d'API** (api_token) → le copier.

### (B) En base (CLI)

> ⚠️ **PIÈGE MAJEUR GLPI 11** : `app_token` et `api_token` sont stockés **chiffrés**
> (sodium xchacha20poly1305). Insérer un token en clair échoue silencieusement.
> Il faut chiffrer la valeur avant de la stocker, et envoyer le **clair** dans les requêtes.

Activer l'API + corriger l'URL :
```sql
UPDATE glpi_configs SET value='1' WHERE name='enable_api';
UPDATE glpi_configs SET value='1' WHERE name='enable_api_login_external_token';
UPDATE glpi_configs SET value='http://localhost:8080' WHERE name='url_base';
```

Script de chiffrement (fichier jetable `encrypt-token.php` à la racine de `~/glpi`) :
```php
<?php
$key = file_get_contents(__DIR__.'/config/glpicrypt.key');
$nonce = random_bytes(SODIUM_CRYPTO_AEAD_XCHACHA20POLY1305_IETF_NPUBBYTES);
echo base64_encode($nonce . sodium_crypto_aead_xchacha20poly1305_ietf_encrypt($argv[1], $nonce, $nonce, $key));
```

Générer et stocker les tokens :
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
rm encrypt-token.php
php bin/console cache:clear
```

---

## 7. Tester l'API REST

```bash
APP=...; USER=...   # les valeurs EN CLAIR copiées à l'étape précédente
RESP=$(curl -s "http://127.0.0.1:8080/apirest.php/initSession" \
  -H "App-Token: $APP" -H "Authorization: user_token $USER")
echo "$RESP"
SESS=$(echo "$RESP" | grep -o '"session_token":"[^"]*"' | cut -d'"' -f4)
curl -s "http://127.0.0.1:8080/apirest.php/Computer?range=0-9" \
  -H "App-Token: $APP" -H "Session-Token: $SESS"
curl -s "http://127.0.0.1:8080/apirest.php/killSession" \
  -H "App-Token: $APP" -H "Session-Token: $SESS" -o /dev/null
```

---

## 8. Arrêter / redémarrer proprement

```bash
# Arrêter le serveur PHP : Ctrl+C dans le terminal concerné

# Arrêter MySQL (si tu n'en as plus besoin)
brew services stop mysql

# Redémarrer MySQL
brew services restart mysql

# Relancer GLPI
cd ~/glpi && php -S localhost:8080 -t public/ public/index.php
```

---

## 9. Dépannage macOS

| Symptôme | Cause | Solution |
|---|---|---|
| `mysql: command not found` | MySQL pas dans le PATH | `export PATH="/opt/homebrew/bin:$PATH"` (Apple Silicon) ou `/usr/local/bin` (Intel) |
| `Can't connect to MySQL server` | MySQL non démarré | `brew services start mysql` |
| `Access denied for user 'root'` | Mot de passe root inconnu | Voir §2 procédure reset |
| `bcmath extension is missing` | — | Déjà inclus dans Homebrew PHP, vérifier `php -m | grep bcmath` |
| `ERROR_WRONG_APP_TOKEN_PARAMETER` | app_token en clair | Chiffrer le token (§6B) ; `php bin/console cache:clear` |
| `ERROR_GLPI_LOGIN_USER_TOKEN` | api_token en clair | Idem ; vérifier `enable_api_login_external_token=1` |
| Modif en base sans effet | Config en cache | `php bin/console cache:clear` + relancer `php -S ...` |
| Port 8080 déjà utilisé | Autre process | `lsof -i :8080` pour identifier ; changer le port : `php -S localhost:8081 ...` |

---

## Récap express (ton Mac : tout est déjà installé)

```bash
brew services start mysql
mysql -u root < glpi-setup.sql
mysql_tzinfo_to_sql /usr/share/zoneinfo | mysql -u root mysql
tar -xzf ~/Downloads/glpi-11.0.7.tgz -C ~/
cd ~/glpi && php bin/console db:install -H localhost -d glpidb -u glpi -p glpi -L fr_FR --no-telemetry --no-interaction --force
php -S localhost:8080 -t public/ public/index.php   # → http://localhost:8080 (glpi/glpi)
```
