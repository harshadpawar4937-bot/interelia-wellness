#!/bin/sh
set -e

export PORT="${PORT:-80}"

# Prefer explicit API_UPSTREAM (e.g. https://interelia-api.onrender.com on free tier).
# Else build from Render private API_HOSTPORT when available (paid private networking).
if [ -z "${API_UPSTREAM}" ] || [ "${API_UPSTREAM}" = "http://api:8000" ]; then
  if [ -n "${API_HOSTPORT}" ]; then
    export API_UPSTREAM="http://${API_HOSTPORT}"
  else
    export API_UPSTREAM="http://api:8000"
  fi
fi

envsubst '${PORT} ${API_UPSTREAM}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

echo "→ nginx listening on ${PORT}, API upstream ${API_UPSTREAM}"
exec nginx -g 'daemon off;'
