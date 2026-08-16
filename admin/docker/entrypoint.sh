#!/bin/sh
set -e

export PORT="${PORT:-80}"

# Render private networking: API_HOSTPORT wins over image default API_UPSTREAM.
if [ -n "${API_HOSTPORT}" ]; then
  export API_UPSTREAM="http://${API_HOSTPORT}"
fi
export API_UPSTREAM="${API_UPSTREAM:-http://api:8000}"

envsubst '${PORT} ${API_UPSTREAM}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

echo "→ admin nginx listening on ${PORT}, API upstream ${API_UPSTREAM}"
exec nginx -g 'daemon off;'
