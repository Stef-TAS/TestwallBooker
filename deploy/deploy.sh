#!/usr/bin/env bash
# deploy.sh — run this on the developer machine to build and push to the target host
# Usage: bash deploy/deploy.sh [user@host]
# Prompts once for remote password; reuses it for sudo operations.

set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
RESET='\033[0m'

step()  { echo -e "\n${BOLD}[$(date +%H:%M:%S)] $*${RESET}"; }
ok()    { echo -e "${GREEN}  ✓ $*${RESET}"; }
info()  { echo -e "${YELLOW}  → $*${RESET}"; }
warn()  { echo -e "${YELLOW}  ! $*${RESET}"; }
fatal() { echo -e "${RED}  ✗ ERROR: $*${RESET}" >&2; exit 1; }

TARGET="${1:-your_user@c-l-twc-001}"
TARGET_LOGIN="${TARGET%@*}"
REMOTE_APP_DIR="/opt/testwallbooker"
NGINX_STATIC="/usr/share/nginx/html/booking"
LINUX_NODE_MODULES_DIR=".deploy-linux-node_modules"

if [[ -z "${SSH_PASSWORD:-}" ]]; then
  read -r -s -p "SSH password for ${TARGET}: " SSH_PASSWORD
  echo
fi

SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/testwallbooker_deploy}"
SSH_PUBLIC_KEY="${SSH_KEY_PATH}.pub"

if [[ ! -f "$SSH_KEY_PATH" || ! -f "$SSH_PUBLIC_KEY" ]]; then
  mkdir -p "$(dirname "$SSH_KEY_PATH")"
  ssh-keygen -t ed25519 -f "$SSH_KEY_PATH" -N '' -C "testwallbooker-deploy" >/dev/null
fi

SSH_OPTS=(-i "$SSH_KEY_PATH" -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new)
RSYNC_RSH="ssh -i ${SSH_KEY_PATH} -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new"

HAS_RSYNC=0
if command -v rsync >/dev/null 2>&1; then
  HAS_RSYNC=1
fi

bootstrap_ssh_key() {
  step "0/5  Installing temporary SSH key on the server..."
  info "You may need to type the remote password once here for SSH key bootstrap."
  cat "$SSH_PUBLIC_KEY" | ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new \
    -o PubkeyAuthentication=no -o PreferredAuthentications=password "$TARGET" \
    'umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys'
  ok "Temporary SSH key installed"
}

ssh_run() {
  local remote_command="$1"
  ssh "${SSH_OPTS[@]}" "$TARGET" "$remote_command"
}

ssh_sudo() {
  local remote_command="$1"
  ssh "${SSH_OPTS[@]}" "$TARGET" "sudo -S -p '' bash -lc $(printf '%q' "$remote_command")" <<<"$SSH_PASSWORD"
}

sync_dist() {
  if [[ "$HAS_RSYNC" -eq 1 ]]; then
    rsync -avz --delete -e "$RSYNC_RSH" dist/ "${TARGET}:${NGINX_STATIC}/"
    return
  fi

  warn "rsync is not available locally, using tar-over-ssh fallback for dist/."
  ssh_sudo "mkdir -p '${NGINX_STATIC}' && chown -R '${TARGET_LOGIN}' '${NGINX_STATIC}' && rm -rf '${NGINX_STATIC}'/*"
  tar -C dist -cf - . | ssh_run "tar -xmf - --no-same-owner --no-same-permissions -C '${NGINX_STATIC}'"
}

sync_backend() {
  if [[ "$HAS_RSYNC" -eq 1 ]]; then
    rsync -avz --delete -e "$RSYNC_RSH" \
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
    return
  fi

  warn "rsync is not available locally, using tar-over-ssh fallback for backend files."
  ssh_sudo "mkdir -p '${REMOTE_APP_DIR}' && chown -R '${TARGET_LOGIN}' '${REMOTE_APP_DIR}'"
  ssh_sudo "find '${REMOTE_APP_DIR}' -mindepth 1 ! -name '.env' -exec rm -rf {} +"
  tar -cf - \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='dist_server' \
    --exclude='.env' \
    --exclude='src/python/__pycache__' \
    --exclude='src/pages' \
    --exclude='src/composables' \
    --exclude='src/stores' \
    --exclude='src/router' \
    --exclude='src/data' \
    . | ssh_run "tar -xmf - --no-same-owner --no-same-permissions -C '${REMOTE_APP_DIR}'"
}

sync_node_modules() {
  local source_node_modules="${LINUX_NODE_MODULES_DIR}/node_modules"
  local remote_tmp_node_modules="${REMOTE_APP_DIR}/.node_modules_new"

  if [[ ! -d "$source_node_modules" ]]; then
    fatal "Expected Linux node_modules at ${source_node_modules}, but it was not found."
  fi

  if [[ "$HAS_RSYNC" -eq 1 ]]; then
    rsync -avz --delete -e "$RSYNC_RSH" "${source_node_modules}/" "${TARGET}:${REMOTE_APP_DIR}/node_modules/"
    return
  fi

  warn "rsync is not available locally, using tar-over-ssh fallback for node_modules/."
  ssh_sudo "mkdir -p '${REMOTE_APP_DIR}' && chown -R '${TARGET_LOGIN}' '${REMOTE_APP_DIR}'"
  ssh_sudo "rm -rf '${remote_tmp_node_modules}' && install -d -o '${TARGET_LOGIN}' -m 755 '${remote_tmp_node_modules}'"
  tar -C "$source_node_modules" -cf - . | ssh_run "tar -xmf - --no-same-owner --no-same-permissions -C '${remote_tmp_node_modules}'"
  ssh_sudo "rm -rf '${REMOTE_APP_DIR}/node_modules' && mv '${remote_tmp_node_modules}' '${REMOTE_APP_DIR}/node_modules' && chown -R '${TARGET_LOGIN}' '${REMOTE_APP_DIR}/node_modules'"
}

prepare_linux_node_modules() {
  step "Preparing Linux production node_modules bundle..."

  if [[ ! -f package-lock.json ]]; then
    fatal "package-lock.json is required to create deterministic offline dependencies."
  fi

  rm -rf "$LINUX_NODE_MODULES_DIR"
  mkdir -p "$LINUX_NODE_MODULES_DIR"
  cp package.json package-lock.json "$LINUX_NODE_MODULES_DIR/"

  pushd "$LINUX_NODE_MODULES_DIR" >/dev/null
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    info "Docker detected, building Linux dependencies inside a Linux container..."
    docker run --rm \
      -v "$(pwd):/workspace" \
      -w /workspace \
      node:20 \
      npm ci --omit=dev
  else
    warn "Docker is not available or not reachable; falling back to local npm ci."
    warn "This may produce non-Linux native binaries when run on Windows."
    npm ci --omit=dev
  fi
  popd >/dev/null

  ok "Linux production node_modules prepared"
}

echo -e "${BOLD}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║       TestwallBooker Deploy Script       ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${RESET}"
info "Target : $TARGET"
info "Backend: $REMOTE_APP_DIR"
info "Static : $NGINX_STATIC"

step "1/5  Checking SSH connection to $TARGET..."
if ssh -o BatchMode=yes "${SSH_OPTS[@]}" "$TARGET" "echo ok" >/dev/null 2>&1; then
  ok "SSH key already available"
else
  bootstrap_ssh_key
fi
ssh_run "echo ok" >/dev/null || fatal "Cannot reach $TARGET via SSH."
ok "SSH connection successful"

step "2/5  Building frontend (Vite)..."
if [[ ! -d node_modules ]]; then
  fatal "Local node_modules is missing. Install dependencies once on your machine first."
fi
if npx --no-install vite --version >/dev/null 2>&1; then
  npx --no-install vite build
  ok "Frontend built → dist/"
elif [[ -d dist ]]; then
  warn "Local Vite is not available, reusing existing dist/ output."
else
  fatal "Vite is not available locally and dist/ does not exist."
fi

step "3/5  Syncing static files to Nginx document root..."
info "Creating ${NGINX_STATIC} on server if it does not exist..."
ssh_sudo "mkdir -p '${NGINX_STATIC}' && chown '${TARGET_LOGIN}' '${NGINX_STATIC}'"
info "Uploading dist/ ..."
sync_dist
ok "Static files synced"

step "4/5  Syncing backend to ${REMOTE_APP_DIR}..."
info "Creating ${REMOTE_APP_DIR} on server if it does not exist..."
ssh_sudo "mkdir -p '${REMOTE_APP_DIR}' && chown '${TARGET_LOGIN}' '${REMOTE_APP_DIR}'"
info "Uploading server code and Python scripts..."
sync_backend
ok "Backend files synced"

prepare_linux_node_modules
info "Uploading Linux production node_modules to keep the server offline..."
sync_node_modules
ok "node_modules synced"

step "5/5  Restarting backend service..."
ssh_sudo "systemctl daemon-reload"
ssh_sudo "systemctl restart testwallbooker"
sleep 2
SERVICE_STATUS="$(ssh_run "systemctl is-active testwallbooker" || true)"
if [[ "$SERVICE_STATUS" == "active" ]]; then
  ok "Service is running (active)"
else
  fatal "Service did not start cleanly (status: ${SERVICE_STATUS}). Run: journalctl -u testwallbooker -n 50"
fi

echo -e "\n${GREEN}${BOLD}╔══════════════════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}${BOLD}║  Deploy complete!                                    ║${RESET}"
echo -e "${GREEN}${BOLD}║  http://c-l-twc-001/booking/                         ║${RESET}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════╝${RESET}"
