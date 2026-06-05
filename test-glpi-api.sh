#!/bin/bash
# Script de test des endpoints GLPI
# Usage: ./test-glpi-api.sh [username] [password]
#   Par défaut: glpi / glpi

set -euo pipefail

BASE="http://localhost:8080/apirest.php"
APP_TOKEN="vQw71v2ciHOxJgq7P47W58KrufXpOBvbwQeLKULP"
USER="${1:-glpi}"
PASS="${2:-glpi}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass=0
fail=0
warn=0

log_ok()   { echo -e "  ${GREEN}✔${NC} $1"; ((pass++)) || true; }
log_fail() { echo -e "  ${RED}✗${NC} $1"; ((fail++)) || true; }
log_warn() { echo -e "  ${YELLOW}⚠${NC} $1"; ((warn++)) || true; }
log_info() { echo -e "  ${CYAN}→${NC} $1"; }

# ─── 1. Auth ──────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " GLPI API Test — $BASE"
echo " Compte : $USER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "[ Authentification ]"

AUTH_RESP=$(curl -s "$BASE/initSession" \
  -H "App-Token: $APP_TOKEN" \
  -H "Authorization: Basic $(echo -n "$USER:$PASS" | base64)")

TOKEN=$(echo "$AUTH_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('session_token',''))" 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
  log_fail "initSession → token absent (mauvais credentials ?)"
  echo "  Réponse: $AUTH_RESP"
  exit 1
fi
log_ok "initSession → token obtenu"
log_info "Token: ${TOKEN:0:20}..."

# Mise à jour auto du .env.local
if [ -f ".env.local" ]; then
  sed -i.bak "s|VITE_GLPI_SESSION_TOKEN=.*|VITE_GLPI_SESSION_TOKEN=$TOKEN|" .env.local
  echo "  → .env.local mis à jour"
fi

# ─── Fonction de test ─────────────────────────────────────────────────────────
test_endpoint() {
  local label="$1"
  local path="$2"
  local method="${3:-GET}"
  local body="${4:-}"

  if [ "$method" = "GET" ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
      "$BASE$path" \
      -H "App-Token: $APP_TOKEN" \
      -H "Session-Token: $TOKEN")
  else
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" \
      "$BASE$path" \
      -H "App-Token: $APP_TOKEN" \
      -H "Session-Token: $TOKEN" \
      -H "Content-Type: application/json" \
      ${body:+-d "$body"})
  fi

  if [[ "$HTTP_CODE" =~ ^2 ]]; then
    log_ok "$label → HTTP $HTTP_CODE"
  elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
    log_warn "$label → HTTP $HTTP_CODE (permission insuffisante)"
  else
    log_fail "$label → HTTP $HTTP_CODE"
  fi
}

# ─── 2. Session ───────────────────────────────────────────────────────────────
echo ""
echo "[ Session ]"
test_endpoint "getMyProfiles"   "/getMyProfiles"
test_endpoint "getActiveProfile" "/getActiveProfile"
test_endpoint "getMyEntities"   "/getMyEntities"
test_endpoint "getActiveEntities" "/getActiveEntities"

# ─── 3. Assets ────────────────────────────────────────────────────────────────
echo ""
echo "[ Assets ]"
test_endpoint "Computer (liste)"         "/Computer?range=0-1"
test_endpoint "Monitor (liste)"          "/Monitor?range=0-1"
test_endpoint "NetworkEquipment (liste)" "/NetworkEquipment?range=0-1"
test_endpoint "Peripheral (liste)"       "/Peripheral?range=0-1"
test_endpoint "Phone (liste)"            "/Phone?range=0-1"
test_endpoint "Printer (liste)"          "/Printer?range=0-1"
test_endpoint "Software (liste)"         "/Software?range=0-1"
test_endpoint "SoftwareLicense (liste)"  "/SoftwareLicense?range=0-1"

# ─── 4. ITIL ──────────────────────────────────────────────────────────────────
echo ""
echo "[ Assistance ITIL ]"
test_endpoint "Ticket (liste)"   "/Ticket?range=0-1"
test_endpoint "Problem (liste)"  "/Problem?range=0-1"
test_endpoint "Change (liste)"   "/Change?range=0-1"

# ─── 5. Administration ────────────────────────────────────────────────────────
echo ""
echo "[ Administration ]"
test_endpoint "User (liste)"   "/User?range=0-1"
test_endpoint "Group (liste)"  "/Group?range=0-1"
test_endpoint "Entity (liste)" "/Entity?range=0-1"
test_endpoint "Profile (liste)" "/Profile?range=0-1"

# ─── 6. Gestion ───────────────────────────────────────────────────────────────
echo ""
echo "[ Management ]"
test_endpoint "Document (liste)"  "/Document?range=0-1"
test_endpoint "Contract (liste)"  "/Contract?range=0-1"
test_endpoint "Supplier (liste)"  "/Supplier?range=0-1"
test_endpoint "Budget (liste)"    "/Budget?range=0-1"

# ─── 7. Consommables / Cartouches ─────────────────────────────────────────────
echo ""
echo "[ Consommables ]"
test_endpoint "CartridgeItem (liste)"   "/CartridgeItem?range=0-1"
test_endpoint "ConsumableItem (liste)"  "/ConsumableItem?range=0-1"

# ─── 8. Créer + Supprimer un Computer (test CRUD) ─────────────────────────────
echo ""
echo "[ CRUD (Computer test) ]"

CREATE_RESP=$(curl -s -X POST "$BASE/Computer" \
  -H "App-Token: $APP_TOKEN" \
  -H "Session-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"input":{"name":"TEST-API-SCRIPT","comment":"Créé par test-glpi-api.sh"}}')

CREATED_ID=$(echo "$CREATE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || echo "")

if [ -n "$CREATED_ID" ] && [ "$CREATED_ID" != "None" ]; then
  log_ok "POST /Computer → créé ID=$CREATED_ID"

  # Lecture
  GET_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/Computer/$CREATED_ID" \
    -H "App-Token: $APP_TOKEN" -H "Session-Token: $TOKEN")
  [[ "$GET_CODE" =~ ^2 ]] && log_ok "GET /Computer/$CREATED_ID → OK" || log_fail "GET /Computer/$CREATED_ID → HTTP $GET_CODE"

  # Suppression
  DEL_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
    "$BASE/Computer/$CREATED_ID?force_purge=1" \
    -H "App-Token: $APP_TOKEN" -H "Session-Token: $TOKEN")
  [[ "$DEL_CODE" =~ ^2 ]] && log_ok "DELETE /Computer/$CREATED_ID → purgé" || log_fail "DELETE /Computer/$CREATED_ID → HTTP $DEL_CODE"
else
  log_fail "POST /Computer → $CREATE_RESP"
fi

# ─── 9. Déconnexion ───────────────────────────────────────────────────────────
echo ""
echo "[ Déconnexion ]"
KILL_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET \
  "$BASE/killSession" \
  -H "App-Token: $APP_TOKEN" -H "Session-Token: $TOKEN")
[[ "$KILL_CODE" =~ ^2 ]] && log_ok "killSession → déconnecté" || log_warn "killSession → HTTP $KILL_CODE"

# ─── Résumé ───────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e " ${GREEN}✔ Succès : $pass${NC}   ${YELLOW}⚠ Avertissements : $warn${NC}   ${RED}✗ Échecs : $fail${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
