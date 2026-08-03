#!/usr/bin/env bash
# deploy.sh — run this on the DEVELOPER machine to build & push to c-l-twc-001
# Usage:  bash deploy/deploy.sh [user@c-l-twc-001]
# Requires: ssh key-based auth set up to the target host

set -euo pipefail

TARGET="${1:-your_user@c-l-twc-001}"
REMOTE_APP_DIR="/opt/testwallbooker"
NGINX_STATIC="/usr/share/nginx/html/booking"

echo "==> Building frontend..."
npm run build          # output goes to ./dist  (base = /booking/)

echo "==> Syncing static files to Nginx document root..."
ssh "$TARGET" "sudo mkdir -p ${NGINX_STATIC} && sudo chown \$USER: ${NGINX_STATIC}"
rsync -avz --delete dist/ "${TARGET}:${NGINX_STATIC}/"

echo "==> Syncing backend to ${REMOTE_APP_DIR}..."
ssh "$TARGET" "sudo mkdir -p ${REMOTE_APP_DIR} && sudo chown \$USER: ${REMOTE_APP_DIR}"
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude 'dist_server' \
  --exclude '.env' \
  --exclude 'src/python/__pycache__' \
  --exclude 'src/pages' \
  --exclude 'src/composables' \
  --exclude 'src/stores' \
  --exclude 'src/router' \
  --exclude 'src/data' \
  --include 'src/python/***' \
  --filter 'protect .env' \
  . "${TARGET}:${REMOTE_APP_DIR}/"

echo "==> Installing production dependencies on server..."
ssh "$TARGET" "cd ${REMOTE_APP_DIR} && npm ci --omit=dev"

echo "==> Restarting backend service..."
ssh "$TARGET" "sudo systemctl restart testwallbooker"

echo "==> Done!  Visit http://c-l-twc-001/booking/"
