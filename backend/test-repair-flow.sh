#!/bin/bash
# ============================================================
# GuardianShield — Per-User Repair Flow E2E Test
# ============================================================
# Prerequisites:
#   1. Backend running on localhost:4000
#   2. A SUPER_ADMIN user exists  (email/password below)
#   3. At least one non-admin user with a LOCKED ledger + APPROVED incident
#
# Usage:
#   chmod +x test-repair-flow.sh
#   ./test-repair-flow.sh
# ============================================================

BASE="http://localhost:4000"
ADMIN_EMAIL="admin@guardian.com"
ADMIN_PASS="Admin@123"

echo ""
echo "========================================="
echo "  GuardianShield Per-User Repair Test"
echo "========================================="

# ── 1. Login as SUPER_ADMIN ──────────────────────────────────
echo ""
echo "[1/7] Logging in as SUPER_ADMIN..."
LOGIN=$(curl -s -c /tmp/gs_cookies.txt -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")
echo "       Response: $LOGIN" | head -c 200
echo ""

# ── 2. Admin overview (see locked users) ────────────────────
echo ""
echo "[2/7] Fetching admin overview (shows locked users)..."
OVERVIEW=$(curl -s -b /tmp/gs_cookies.txt "$BASE/api/admin/overview")
echo "       Locked users: $(echo $OVERVIEW | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',{}).get('lockedUsers',[])))" 2>/dev/null)"

# ── Extract first locked userId ───────────────────────────────
LOCKED_USER=$(echo $OVERVIEW | python3 -c "
import sys, json
d = json.load(sys.stdin)
locked = d.get('data', {}).get('lockedUsers', [])
if locked:
    print(locked[0]['userId'])
else:
    print('')
" 2>/dev/null)

if [ -z "$LOCKED_USER" ]; then
  echo ""
  echo "⚠️  No locked users found. Run the verificationWorker first to create a LOCKED user."
  echo "    You can tamper a SecurityLog record directly in the DB and then run verification."
  echo ""
  echo "    Example (psql):"
  echo "      UPDATE \"SecurityLog\" SET \"currentHash\" = 'tampered-hash' WHERE id = 1;"
  echo "      POST /api/admin/users/1/verify"
  echo ""
  exit 0
fi

echo "       Found locked userId: $LOCKED_USER"

# ── 3. Ledger status for that user ───────────────────────────
echo ""
echo "[3/7] Checking ledger status for user $LOCKED_USER..."
LEDGER=$(curl -s -b /tmp/gs_cookies.txt "$BASE/api/admin/users/$LOCKED_USER/ledger-status")
echo "       Status: $(echo $LEDGER | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('status','?'))" 2>/dev/null)"

# ── 4. Approve the incident (via incident route) ─────────────
echo ""
echo "[4/7] Fetching incidents for user $LOCKED_USER..."
INCIDENTS=$(curl -s -b /tmp/gs_cookies.txt "$BASE/api/admin/users/$LOCKED_USER/incidents")
OPEN_INC=$(echo $INCIDENTS | python3 -c "
import sys, json
incs = json.load(sys.stdin).get('data', [])
open_incs = [i for i in incs if i['status'] == 'OPEN']
if open_incs:
    print(open_incs[0]['id'])
" 2>/dev/null)

if [ -n "$OPEN_INC" ]; then
  echo "       Approving incident $OPEN_INC..."
  APPROVE=$(curl -s -b /tmp/gs_cookies.txt -X PATCH "$BASE/api/incident/$OPEN_INC/status" \
    -H "Content-Type: application/json" \
    -d '{"status":"APPROVED"}')
  echo "       Approval response: $(echo $APPROVE | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message','?'))" 2>/dev/null)"
else
  echo "       No OPEN incident found — checking for APPROVED..."
fi

# ── 5. Trigger repair for user ────────────────────────────────
echo ""
echo "[5/7] Triggering repair for user $LOCKED_USER..."
REPAIR=$(curl -s -b /tmp/gs_cookies.txt -X POST "$BASE/api/admin/users/$LOCKED_USER/repair")
echo "       Response: $REPAIR" | head -c 300
echo ""

sleep 3  # Give the worker a moment to process

# ── 6. Check ledger status — should be UNDER_REPAIR ─────────
echo ""
echo "[6/7] Checking ledger status after repair (expecting UNDER_REPAIR)..."
LEDGER2=$(curl -s -b /tmp/gs_cookies.txt "$BASE/api/admin/users/$LOCKED_USER/ledger-status")
STATUS2=$(echo $LEDGER2 | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('status','?'))" 2>/dev/null)
echo "       Status: $STATUS2"

if [ "$STATUS2" != "UNDER_REPAIR" ]; then
  echo "       ℹ️  Worker may still be processing. Wait a few seconds and check again via the API."
fi

# ── 7. Unlock the ledger ──────────────────────────────────────
echo ""
echo "[7/7] Unlocking ledger for user $LOCKED_USER (SUPERADMIN explicit unlock)..."
UNLOCK=$(curl -s -b /tmp/gs_cookies.txt -X POST "$BASE/api/admin/users/$LOCKED_USER/unlock")
echo "       Response: $UNLOCK" | head -c 300
echo ""

FINAL=$(curl -s -b /tmp/gs_cookies.txt "$BASE/api/admin/users/$LOCKED_USER/ledger-status")
FINAL_STATUS=$(echo $FINAL | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('status','?'))" 2>/dev/null)

echo ""
echo "========================================="
echo "  Final ledger status: $FINAL_STATUS"
if [ "$FINAL_STATUS" = "ACTIVE" ]; then
  echo "  ✅ PASS — Ledger successfully repaired and unlocked"
else
  echo "  ⚠️  Status is $FINAL_STATUS — check worker logs"
fi
echo "========================================="
echo ""

# Clean up cookies
rm -f /tmp/gs_cookies.txt
