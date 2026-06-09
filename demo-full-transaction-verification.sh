#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="http://localhost:5000"
COOKIE_FILE="/tmp/guardian-demo-cookie.txt"
EMAIL="verify-demo-$(date +%s)@example.com"
PASSWORD='Password123'
TX_AMOUNT='250.00'
TX_ID_FILE="/tmp/guardian-demo-txn-id.txt"

function require_installed() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: $1 is required but not installed." >&2
    exit 1
  }
}

require_installed curl
require_installed python3
require_installed node

if ! curl -sf "$BASE_URL/health" >/dev/null; then
  echo "ERROR: Backend server is not reachable at $BASE_URL. Start it first." >&2
  exit 1
fi

rm -f "$COOKIE_FILE" "$TX_ID_FILE"

printf "\n[1] Signup\n"
curl -s -c "$COOKIE_FILE" -X POST "$BASE_URL/api/auth/signup" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Demo Verify","email":"'$EMAIL'","password":"'$PASSWORD'"}'

printf "\n[2] Login\n"
curl -s -b "$COOKIE_FILE" -c "$COOKIE_FILE" -X POST "$BASE_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"'$EMAIL'","password":"'$PASSWORD'"}'

printf "\n[3] Create transaction\n"
create_resp=$(curl -s -b "$COOKIE_FILE" -X POST "$BASE_URL/api/transaction/create" \
  -H 'Content-Type: application/json' \
  -d '{"amount":'$TX_AMOUNT',"type":"credit","description":"Demo verify deposit","metadata":{"source":"demo-verify"}}')
echo "$create_resp"

transaction_id=$(printf '%s' "$create_resp" | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data["data"]["transaction"]["id"])')
printf "\nTransaction ID: %s\n" "$transaction_id"

printf "\n⏳ Waiting 6s for outbox publisher + audit worker to create SecurityLog...\n"
sleep 6

printf "\n[4] Verify before tamper\n"
curl -s -b "$COOKIE_FILE" "$BASE_URL/api/security/verify" | python3 -m json.tool

printf "\n[5] Tamper transaction amount in DB\n"
cd "$SCRIPT_DIR"
TXN_ID="$transaction_id" node - <<'NODE'
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const tx = await prisma.transaction.update({
    where: { id: Number(process.env.TXN_ID) },
    data: { amount: new Prisma.Decimal('999.99') }
  });
  console.log('tampered', tx.id, tx.amount.toString());
  await prisma.$disconnect();
})();
NODE
cd - >/dev/null

printf "\n[6] Verify after tamper\n"
curl -s -b "$COOKIE_FILE" "$BASE_URL/api/security/verify" | python3 -m json.tool
