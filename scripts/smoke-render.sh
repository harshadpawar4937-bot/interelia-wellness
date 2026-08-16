#!/usr/bin/env bash
# Post-deploy smoke checks against Render public URLs.
# Set GitHub Actions variables (or export locally):
#   RENDER_API_URL, RENDER_STORE_URL, RENDER_ADMIN_URL
set -euo pipefail

API_URL="${API_URL:-${RENDER_API_URL:-}}"
STORE_URL="${STORE_URL:-${RENDER_STORE_URL:-}}"
ADMIN_URL="${ADMIN_URL:-${RENDER_ADMIN_URL:-}}"

if [[ -z "$API_URL" && -z "$STORE_URL" && -z "$ADMIN_URL" ]]; then
  echo "No RENDER_* URLs configured — skip smoke (set repo Variables after first Blueprint deploy)."
  echo "  RENDER_API_URL / RENDER_STORE_URL / RENDER_ADMIN_URL"
  exit 0
fi

check() {
  local name="$1" url="$2" expect="${3:-}"
  echo "→ $name  $url"
  local body code
  body="$(curl -fsS --retry 8 --retry-delay 15 --retry-all-errors -w '\n%{http_code}' "$url")"
  code="$(echo "$body" | tail -n1)"
  body="$(echo "$body" | sed '$d')"
  if [[ "$code" != "200" ]]; then
    echo "FAIL $name HTTP $code"
    exit 1
  fi
  if [[ -n "$expect" ]] && ! echo "$body" | grep -qi "$expect"; then
    echo "FAIL $name missing expected content: $expect"
    echo "$body" | head -c 400
    exit 1
  fi
  echo "  OK ($code)"
}

[[ -n "$API_URL" ]] && check "API health" "${API_URL%/}/health" "ok"
[[ -n "$STORE_URL" ]] && check "Store" "${STORE_URL%/}/" ""
[[ -n "$ADMIN_URL" ]] && check "Admin" "${ADMIN_URL%/}/" ""

echo "All configured smoke checks passed."
