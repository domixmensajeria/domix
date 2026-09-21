#!/usr/bin/env bash
# Igual que aplicar.sh, pero apuntado al proyecto de Supabase nuevo e
# independiente ("Domix Mensajería", org Domix), no al que se usó para
# EasyPanel. El token se lee de .supabase-token-nuevo (ignorado por
# git) y nunca se imprime.
#
#   ./database/aplicar_nuevo.sh database/migracion_02_sedes_tracking_turbo.sql
set -euo pipefail

PROJECT_REF="pwgofasontumxgzahuph"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOKEN_FILE="$ROOT/.supabase-token-nuevo"
SQL_FILE="${1:?Uso: aplicar_nuevo.sh <archivo.sql>}"

[ -f "$TOKEN_FILE" ] || { echo "Falta $TOKEN_FILE"; exit 1; }
[ -f "$SQL_FILE" ]   || { echo "No existe $SQL_FILE"; exit 1; }

TOKEN="$(tr -d ' \t\r\n' < "$TOKEN_FILE")"

BODY="$(python -c "
import json,sys
print(json.dumps({'query': open(sys.argv[1], encoding='utf-8').read()}))
" "$SQL_FILE")"

RESPONSE="$(curl -sS -w $'\n%{http_code}' \
  -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$BODY")"

STATUS="$(printf '%s' "$RESPONSE" | tail -n1)"
printf '%s' "$RESPONSE" | sed '$d'
echo
echo "HTTP $STATUS"
[ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]
