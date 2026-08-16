#!/bin/sh
set -e

export PORT="${PORT:-80}"

# Prefer full API_UPSTREAM; else build from Render private hostport (host:port)
if [ -z "${API_UPSTREAM}" ] && [ -n "${API_HOSTPORT}" ]; then
  export API_UPSTREAM="http://${API_HOSTPORT}"
fi
export API_UPSTREAM="${API_UPSTREAM:-http://api:8000}"

envsubst '${PORT} ${API_UPSTREAM}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

echo "→ nginx listening on ${PORT}, API upstream ${API_UPSTREAM}"
exec nginx -g 'daemon off;'
