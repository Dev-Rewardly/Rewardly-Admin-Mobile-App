#!/usr/bin/env bash
# setup-keycloak-client.sh
#
# Creates this app's own PUBLIC Keycloak client in the existing coalition realm,
# then proves it works. Run once, by a person with master-realm admin.
#
# WHY A FILE AND NOT A PASTE
# The first attempt was pasted into MINGW64 and the multi-line JSON collided
# with the line after it. A file has nothing to mangle.
#
# NO jq. It is not installed on the Windows git-bash this gets run from, and
# its absence silently produced an EMPTY token on the first attempt -- while
# the guard, which tested for the literal string "null", printed "ok". A check
# that cannot fail in the way that matters is worse than no check. The token
# here is extracted with sed and validated by length and by a real API call.
#
# CREATES ONE CLIENT. No realm, no users, no roles, nothing deleted. Re-running
# is safe: an existing client is reported and left alone.
set -uo pipefail

KC="${KC:-https://auth.rwly.network}"
REALM="${REALM:-rewardlyprotocol-coalition}"
CLIENT_ID="${CLIENT_ID:-rewardlyprotocol-coalition-mobile}"
ADMIN_USER="${ADMIN_USER:-admin}"

say() { printf '%s\n' "$*"; }
die() { printf 'FAILED: %s\n' "$*" >&2; exit 1; }

# ── 1 · admin token ──────────────────────────────────────────────────────────
read -rsp "master admin password for '${ADMIN_USER}': " KCPW; echo
[ -n "$KCPW" ] || die "no password entered"

TOKEN_JSON=$(curl -s -X POST "$KC/realms/master/protocol/openid-connect/token" \
  -d grant_type=password -d client_id=admin-cli \
  -d "username=$ADMIN_USER" --data-urlencode "password=$KCPW")

# sed, not jq. Takes the first access_token value out of the JSON.
TOKEN=$(printf '%s' "$TOKEN_JSON" | sed -n 's/.*"access_token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

# Three ways this can be wrong, and the first attempt hit the one that looked
# like success: empty. Length is a sanity floor -- a real JWT is ~800+ chars.
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ] || [ "${#TOKEN}" -lt 100 ]; then
  say "Could not get an admin token. Keycloak said:"
  printf '%s\n' "$TOKEN_JSON" | head -c 400; echo
  die "authentication"
fi

# Prove the token actually works before trusting it -- a well-formed string is
# not an authorised one.
PROBE=$(curl -s -o /dev/null -w '%{http_code}' \
  "$KC/admin/realms/$REALM" -H "Authorization: Bearer $TOKEN")
[ "$PROBE" = "200" ] || die "token rejected by the admin API (HTTP $PROBE). Wrong account, or no rights on realm '$REALM'."
say "admin token OK"

# ── 2 · what the WORKING portal client maps ──────────────────────────────────
# The app refuses any session whose token carries no coalition_id / tenant_id /
# organization_id -- it reads that as "not a coalition admin". A new client
# without the same mapper authenticates fine and then rejects every login,
# which looks like a broken app rather than a missing mapper.
say ""
say "── mappers on the working portal client (copy these if coalition_id is here) ──"
PORTAL_JSON=$(curl -s "$KC/admin/realms/$REALM/clients?clientId=rewardlyprotocol-coalition-portal" \
  -H "Authorization: Bearer $TOKEN")
PORTAL_UUID=$(printf '%s' "$PORTAL_JSON" | sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)

if [ -n "$PORTAL_UUID" ]; then
  curl -s "$KC/admin/realms/$REALM/clients/$PORTAL_UUID/protocol-mappers/models" \
    -H "Authorization: Bearer $TOKEN" \
    | tr ',' '\n' | grep -Ei '"name"|coalition|tenant|organization' | head -40
else
  say "(portal client not found -- unexpected; check the clientId)"
fi

# ── 3 · create the mobile client ─────────────────────────────────────────────
say ""
EXISTS=$(curl -s "$KC/admin/realms/$REALM/clients?clientId=$CLIENT_ID" \
  -H "Authorization: Bearer $TOKEN")
if printf '%s' "$EXISTS" | grep -q "\"clientId\":\"$CLIENT_ID\""; then
  say "client '$CLIENT_ID' already exists -- leaving it alone"
else
  BODY=$(cat <<JSON
{
  "clientId": "$CLIENT_ID",
  "name": "Rewardly Admin Mobile",
  "enabled": true,
  "publicClient": true,
  "directAccessGrantsEnabled": true,
  "standardFlowEnabled": false,
  "implicitFlowEnabled": false,
  "serviceAccountsEnabled": false,
  "attributes": { "access.token.lifespan": "900" }
}
JSON
)
  CODE=$(curl -s -o /tmp/kc_create.out -w '%{http_code}' \
    -X POST "$KC/admin/realms/$REALM/clients" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    --data "$BODY")
  if [ "$CODE" = "201" ]; then
    say "created '$CLIENT_ID'"
  else
    say "create returned HTTP $CODE:"; head -c 400 /tmp/kc_create.out; echo
    die "client not created"
  fi
fi

# ── 4 · verify, WITH A CONTROL ───────────────────────────────────────────────
# invalid_grant  = client accepted, no secret needed, DAG on  -> success
# invalid_client = client missing, or it demands a secret     -> failure
# The control proves which of those a failure actually looks like, so a
# misread cannot pass as a pass.
say ""
say "── verification (fake user on purpose; only the error code matters) ──"
R="$KC/realms/$REALM/protocol/openid-connect/token"
for c in "$CLIENT_ID" "nonexistent-control-xyz"; do
  printf '%-42s ' "$c"
  curl -s -X POST "$R" -H 'Content-Type: application/x-www-form-urlencoded' \
    -d "grant_type=password&client_id=$c&username=probe%40invalid.test&password=wrong" \
    | head -c 200
  echo
done

say ""
say "Expected: '$CLIENT_ID' -> invalid_grant   (success)"
say "          nonexistent-control-xyz -> invalid_client  (the control)"
say ""
say "Then set in the app:  EXPO_PUBLIC_KEYCLOAK_CLIENT_ID=$CLIENT_ID"
