#!/bin/sh
# Rewrite the baked placeholder API URL with the runtime value. nginx's image
# runs every script in /docker-entrypoint.d before starting the server.
set -e

API_URL="${API_URL:-/api}"
echo "flipfeedback-web: setting API URL to ${API_URL}"

# Replace the placeholder in every built JS asset.
find /usr/share/nginx/html/assets -type f -name '*.js' -exec \
  sed -i "s#__API_URL__#${API_URL}#g" {} +
