#!/usr/bin/env bash
# setup-and-deploy.sh — one-shot provision + deploy for offline servers
# Usage: bash deploy/setup-and-deploy.sh user@host

set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
RESET='\033[0m'

step()  { echo -e "\n${BOLD}[$(date +%H:%M:%S)] $*${RESET}"; }
ok()    { echo -e "${GREEN}  + $*${RESET}"; }
info()  { echo -e "${YELLOW}  -> $*${RESET}"; }
warn()  { echo -e "${YELLOW}  ! $*${RESET}"; }
fatal() { echo -e "${RED}  x ERROR: $*${RESET}" >&2; exit 1; }

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  fatal "Usage: bash deploy/setup-and-deploy.sh user@host"
fi

TARGET_LOGIN="${TARGET%@*}"
REMOTE_APP_DIR="/opt/testwallbooker"
REMOTE_STATIC_DIR="/usr/share/nginx/html/booking"
REMOTE_OFFLINE_DIR="${REMOTE_APP_DIR}/.offline"
SERVICE_NAME="testwallbooker"
SERVICE_USER="testwallbooker"
SERVICE_GROUP="testwallbooker"

OFFLINE_BUNDLE_DIR=".deploy-offline"
LOCAL_LINUX_NODE_DIR="${OFFLINE_BUNDLE_DIR}/linux-node"
LOCAL_PY_WHEEL_DIR="${OFFLINE_BUNDLE_DIR}/python-wheels"
LOCAL_PY_BUILD_VENV="${OFFLINE_BUNDLE_DIR}/.py-build-venv"

REMOTE_PYTHON_TAG=""
SKIP_PYTHON_WHEELS=0

if [[ -z "${SSH_PASSWORD:-}" ]]; then
  read -r -s -p "SSH password for ${TARGET}: " SSH_PASSWORD
  echo
fi
SSH_PASSWORD="${SSH_PASSWORD%$'\r'}"
SUDO_PASSWORD="${SUDO_PASSWORD:-$SSH_PASSWORD}"
SUDO_PASSWORD="${SUDO_PASSWORD%$'\r'}"

SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/testwallbooker_deploy}"
SSH_PUBLIC_KEY="${SSH_KEY_PATH}.pub"
SSH_OPTS=(-i "$SSH_KEY_PATH" -o ConnectTimeout=12 -o StrictHostKeyChecking=accept-new)

if [[ ! -f "$SSH_KEY_PATH" || ! -f "$SSH_PUBLIC_KEY" ]]; then
  mkdir -p "$(dirname "$SSH_KEY_PATH")"
  ssh-keygen -t ed25519 -f "$SSH_KEY_PATH" -N '' -C "testwallbooker-deploy" >/dev/null
fi

bootstrap_ssh_key() {
  step "0/10  Installing temporary SSH key on the server..."
  info "You may need to type the remote password once for key bootstrap."
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
  ssh "${SSH_OPTS[@]}" "$TARGET" "sudo -S -p '' bash -lc $(printf '%q' "$remote_command")" <<<"$SUDO_PASSWORD"
}

validate_sudo_access() {
  step "1b/10  Validating sudo credentials on target..."

  if ssh "${SSH_OPTS[@]}" "$TARGET" "sudo -S -p '' -v" <<<"$SUDO_PASSWORD" >/dev/null 2>&1; then
    ok "Sudo authentication successful"
    return
  fi

  warn "Initial sudo validation failed."
  read -r -s -p "Sudo password for ${TARGET}: " SUDO_PASSWORD
  echo
  SUDO_PASSWORD="${SUDO_PASSWORD%$'\r'}"

  if ssh "${SSH_OPTS[@]}" "$TARGET" "sudo -S -p '' -v" <<<"$SUDO_PASSWORD" >/dev/null 2>&1; then
    ok "Sudo authentication successful"
    return
  fi

  fatal "Sudo authentication failed. Re-run and verify sudo password for ${TARGET}."
}

write_remote_file() {
  local remote_path="$1"
  local content="$2"
  printf '%s\n' "$content" | ssh "${SSH_OPTS[@]}" "$TARGET" "cat > '${remote_path}'"
}

pick_local_python() {
  if command -v python3 >/dev/null 2>&1; then
    echo "python3"
    return
  fi
  if command -v py >/dev/null 2>&1; then
    echo "py -3"
    return
  fi
  if command -v python >/dev/null 2>&1; then
    echo "python"
    return
  fi
  echo ""
}

local_venv_pip_path() {
  if [[ -x "${LOCAL_PY_BUILD_VENV}/bin/pip" ]]; then
    echo "${LOCAL_PY_BUILD_VENV}/bin/pip"
    return
  fi
  if [[ -x "${LOCAL_PY_BUILD_VENV}/Scripts/pip.exe" ]]; then
    echo "${LOCAL_PY_BUILD_VENV}/Scripts/pip.exe"
    return
  fi
  if [[ -x "${LOCAL_PY_BUILD_VENV}/Scripts/pip" ]]; then
    echo "${LOCAL_PY_BUILD_VENV}/Scripts/pip"
    return
  fi
  echo ""
}

build_frontend() {
  step "2/10  Building frontend bundle..."

  if [[ ! -d node_modules ]]; then
    if [[ -f dist/index.html ]]; then
      warn "Local node_modules is missing, reusing existing dist/."
      return
    fi
    fatal "Local node_modules is missing and dist/ does not exist."
  fi

  if [[ ! -f node_modules/vite/bin/vite.js ]]; then
    if [[ -f dist/index.html ]]; then
      warn "Local Vite dependency is missing, reusing existing dist/."
      return
    fi
    fatal "Local Vite dependency is missing and dist/ does not exist."
  fi

  if command -v npm >/dev/null 2>&1; then
    if npm run build; then
      ok "Frontend built -> dist/"
    else
      warn "npm run build failed; trying Vite-only fallback build."
      if npx --no-install vite build; then
        ok "Frontend built with Vite fallback -> dist/"
      elif [[ -f dist/index.html ]]; then
        warn "Vite fallback failed, reusing existing dist/."
      else
        fatal "Frontend build failed and dist/ is unavailable."
      fi
    fi
  elif [[ -f dist/index.html ]]; then
    warn "npm is unavailable locally, reusing existing dist/."
  else
    fatal "npm is unavailable and dist/ does not exist."
  fi

  [[ -f dist/index.html ]] || fatal "Build output is missing dist/index.html"
}

detect_remote_python_tag() {
  step "3/10  Detecting remote Python ABI for offline wheels..."
  REMOTE_PYTHON_TAG="$(ssh_run "python3 -c 'import sys; print(f\"{sys.version_info.major}{sys.version_info.minor}\")'" 2>/dev/null || true)"
  if [[ -z "$REMOTE_PYTHON_TAG" ]]; then
    warn "Could not detect remote Python version; defaulting wheel target to cp311."
    REMOTE_PYTHON_TAG="311"
  fi
  info "Remote Python tag: cp${REMOTE_PYTHON_TAG}"
}

prepare_offline_dependencies() {
  step "4/10  Preparing offline Node and Python bundles on laptop..."

  command -v npm >/dev/null 2>&1 || fatal "npm is required locally for offline Node dependencies."
  [[ -f package-lock.json ]] || fatal "package-lock.json is required for offline Node dependencies."

  rm -rf "$OFFLINE_BUNDLE_DIR"
  mkdir -p "$LOCAL_LINUX_NODE_DIR" "$LOCAL_PY_WHEEL_DIR"

  cp package.json package-lock.json "$LOCAL_LINUX_NODE_DIR/"
  pushd "$LOCAL_LINUX_NODE_DIR" >/dev/null
  if npm ci --omit=dev --os=linux --cpu=x64 --no-audit --no-fund; then
    ok "Prepared Linux-targeted Node dependencies"
  elif npm ci --omit=dev --no-audit --no-fund; then
    warn "Fell back to local-platform npm install; native modules may be incompatible on Linux."
  else
    fatal "Failed to prepare offline Node dependencies locally."
  fi
  popd >/dev/null

  [[ -d "${LOCAL_LINUX_NODE_DIR}/node_modules" ]] || fatal "Offline Node bundle is missing node_modules."

  local py_cmd
  py_cmd="$(pick_local_python)"
  if [[ -z "$py_cmd" ]]; then
    warn "No local Python interpreter found; skipping wheel preparation."
    warn "The script will try to reuse remote ${REMOTE_APP_DIR}/.venv."
    SKIP_PYTHON_WHEELS=1
    return
  fi

  local local_pip=""
  if eval "$py_cmd -m venv '$LOCAL_PY_BUILD_VENV'" >/dev/null 2>&1; then
    local_pip="$(local_venv_pip_path)"
    if [[ -n "$local_pip" ]]; then
      "$local_pip" install --upgrade pip >/dev/null 2>&1 || true
    fi
  else
    warn "Could not create local Python build venv; trying base interpreter pip."
  fi

  if [[ -z "$local_pip" ]]; then
    if ! eval "$py_cmd -m pip --version" >/dev/null 2>&1; then
      warn "Base interpreter pip missing; attempting ensurepip."
      eval "$py_cmd -m ensurepip --upgrade" >/dev/null 2>&1 || true
    fi

    if eval "$py_cmd -m pip --version" >/dev/null 2>&1; then
      local_pip="$py_cmd -m pip"
    fi
  fi

  if [[ -z "$local_pip" ]]; then
    warn "No usable local pip found; skipping wheel bundle."
    SKIP_PYTHON_WHEELS=1
    return
  fi

  if ! eval "$local_pip download --dest '$LOCAL_PY_WHEEL_DIR' --only-binary=:all: --platform manylinux2014_x86_64 --implementation cp --python-version '$REMOTE_PYTHON_TAG' --requirement src/python/requirements.txt"; then
    warn "Python wheel download failed; skipping wheel bundle."
    SKIP_PYTHON_WHEELS=1
    return
  fi

  if ! ls "$LOCAL_PY_WHEEL_DIR"/*.whl >/dev/null 2>&1; then
    warn "No wheels downloaded; skipping wheel bundle."
    SKIP_PYTHON_WHEELS=1
    return
  fi

  ok "Prepared offline Python wheel bundle"
}

provision_server() {
  step "5/10  Validating server prerequisites and creating directories..."

  ssh_sudo "missing=''; for c in tar systemctl nginx node python3 curl; do command -v \"\$c\" >/dev/null 2>&1 || missing=\"\${missing}\$c \"; done; if [[ -n \"\$missing\" ]]; then echo \"Missing required tools on server: \$missing\"; exit 1; fi"
  ssh_sudo "python3 -m venv --help >/dev/null 2>&1 || { echo 'python3-venv support is missing on server'; exit 1; }"

  ssh_sudo "id -u '${SERVICE_USER}' >/dev/null 2>&1 || useradd --system --home-dir '${REMOTE_APP_DIR}' --shell /sbin/nologin '${SERVICE_USER}'"
  ssh_sudo "mkdir -p '${REMOTE_APP_DIR}' '${REMOTE_STATIC_DIR}' '${REMOTE_OFFLINE_DIR}'"
  ssh_sudo "chown -R '${TARGET_LOGIN}' '${REMOTE_STATIC_DIR}' '${REMOTE_APP_DIR}'"
  ssh_sudo "systemctl enable --now nginx"

  ok "Server prerequisites validated"
}

sync_static() {
  step "6/10  Syncing frontend files to Nginx static directory..."

  ssh_sudo "mkdir -p '${REMOTE_STATIC_DIR}' && chown -R '${TARGET_LOGIN}' '${REMOTE_STATIC_DIR}'"
  ssh_sudo "find '${REMOTE_STATIC_DIR}' -mindepth 1 -exec rm -rf {} +"
  tar -C dist -cf - . | ssh_run "tar -xmf - --no-same-owner --no-same-permissions -C '${REMOTE_STATIC_DIR}'"

  ok "Static files synced"
}

sync_backend() {
  step "7/10  Syncing backend application files..."
  local remote_stage="${REMOTE_APP_DIR}.new"

  ssh_sudo "mkdir -p '${REMOTE_APP_DIR}'"
  ssh_sudo "rm -rf '${remote_stage}' && install -d -o '${TARGET_LOGIN}' -m 755 '${remote_stage}'"

  tar -cf - \
    --exclude='.git' \
    --exclude='.github' \
    --exclude='node_modules' \
    --exclude='.deploy-linux-node_modules' \
    --exclude='.deploy-offline' \
    --exclude='dist' \
    --exclude='dist_server' \
    --exclude='.env' \
    --exclude='src/python/__pycache__' \
    . | ssh_run "tar -xmf - --no-same-owner --no-same-permissions -C '${remote_stage}'"

  ssh_sudo "if [[ -f '${REMOTE_APP_DIR}/.env' ]]; then cp '${REMOTE_APP_DIR}/.env' '${remote_stage}/.env'; fi"
  ssh_sudo "rm -rf '${REMOTE_APP_DIR}.prev'"
  ssh_sudo "if [[ -d '${REMOTE_APP_DIR}' ]]; then mv '${REMOTE_APP_DIR}' '${REMOTE_APP_DIR}.prev'; fi"
  ssh_sudo "mv '${remote_stage}' '${REMOTE_APP_DIR}'"
  ssh_sudo "rm -rf '${REMOTE_APP_DIR}.prev'"
  ssh_sudo "chown -R '${SERVICE_USER}:${SERVICE_GROUP}' '${REMOTE_APP_DIR}'"

  ok "Backend files synced"
}

sync_offline_runtime_dependencies() {
  step "8/10  Syncing offline runtime dependencies..."

  local local_node_modules="${LOCAL_LINUX_NODE_DIR}/node_modules"
  local remote_tmp_node_modules="${REMOTE_APP_DIR}/.node_modules_new"

  [[ -d "$local_node_modules" ]] || fatal "Local offline node_modules bundle is missing."

  ssh_sudo "rm -rf '${remote_tmp_node_modules}' && install -d -o '${TARGET_LOGIN}' -m 755 '${remote_tmp_node_modules}'"
  tar -C "$local_node_modules" -cf - . | ssh_run "tar -xmf - --no-same-owner --no-same-permissions -C '${remote_tmp_node_modules}'"
  ssh_sudo "rm -rf '${REMOTE_APP_DIR}/node_modules' && mv '${remote_tmp_node_modules}' '${REMOTE_APP_DIR}/node_modules'"

  # Ensure executable bits survive cross-platform transfer (Windows -> Linux).
  ssh_sudo "if [[ -d '${REMOTE_APP_DIR}/node_modules/.bin' ]]; then chmod 755 '${REMOTE_APP_DIR}/node_modules/.bin'/* || true; fi"
  ssh_sudo "find '${REMOTE_APP_DIR}/node_modules' -type f -path '*/bin/*' -exec chmod 755 {} + || true"

  if [[ "$SKIP_PYTHON_WHEELS" -eq 0 ]]; then
    ssh_sudo "rm -rf '${REMOTE_OFFLINE_DIR}/python-wheels' && install -d -o '${TARGET_LOGIN}' -m 755 '${REMOTE_OFFLINE_DIR}/python-wheels'"
    tar -C "$LOCAL_PY_WHEEL_DIR" -cf - . | ssh_run "tar -xmf - --no-same-owner --no-same-permissions -C '${REMOTE_OFFLINE_DIR}/python-wheels'"
  else
    warn "Skipping Python wheel sync (local wheel bundle unavailable)."
  fi

  ssh_sudo "chown -R '${SERVICE_USER}:${SERVICE_GROUP}' '${REMOTE_APP_DIR}'"
  ok "Offline dependencies synced"
}

configure_nginx() {
  step "9/10  Writing Nginx routing config..."

  local default_d_conf="/tmp/testwallbooker-default-d.conf"
  local vhost_conf="/tmp/testwallbooker-vhost.conf"

  write_remote_file "$default_d_conf" "location /booking/ {
    alias /usr/share/nginx/html/booking/;
    try_files \$uri \$uri/ /booking/index.html;
}

location /api/ {
    proxy_pass         http://127.0.0.1:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade \$http_upgrade;
    proxy_set_header   Connection 'upgrade';
    proxy_set_header   Host \$host;
    proxy_set_header   X-Real-IP \$remote_addr;
    proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_cache_bypass \$http_upgrade;
}

location /booking/api/ {
    proxy_pass         http://127.0.0.1:3001/api/;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade \$http_upgrade;
    proxy_set_header   Connection 'upgrade';
    proxy_set_header   Host \$host;
    proxy_set_header   X-Real-IP \$remote_addr;
    proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_cache_bypass \$http_upgrade;
}"

  write_remote_file "$vhost_conf" "server {
    listen 80;
    server_name _;

    location /booking/ {
        alias /usr/share/nginx/html/booking/;
        try_files \$uri \$uri/ /booking/index.html;
    }

    location /api/ {
        proxy_pass         http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }

    location /booking/api/ {
        proxy_pass         http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }
}"

  ssh_sudo "if [[ -d /etc/nginx/default.d ]]; then install -m 644 '${default_d_conf}' /etc/nginx/default.d/testwallbooker.conf; rm -f /etc/nginx/conf.d/testwallbooker.conf; else install -m 644 '${vhost_conf}' /etc/nginx/conf.d/testwallbooker.conf; fi"
  ssh_sudo "rm -f '${default_d_conf}' '${vhost_conf}'"

  ssh_sudo "nginx -t"
  ssh_sudo "systemctl reload nginx"

  if ssh_sudo "command -v setsebool >/dev/null 2>&1"; then
    ssh_sudo "setsebool -P httpd_can_network_connect 1 || true"
  fi
  ssh_sudo "restorecon -Rv '${REMOTE_STATIC_DIR}' >/dev/null 2>&1 || true"

  if ssh_sudo "command -v firewall-cmd >/dev/null 2>&1"; then
    ssh_sudo "firewall-cmd --permanent --add-service=http >/dev/null 2>&1 || true"
    ssh_sudo "firewall-cmd --reload >/dev/null 2>&1 || true"
  fi

  ok "Nginx configured"
}

configure_service_and_deps() {
  step "10/10  Installing service and offline Python dependencies..."

  if [[ "$SKIP_PYTHON_WHEELS" -eq 0 ]]; then
    ssh_sudo "python3 -m venv '${REMOTE_APP_DIR}/.venv'"
    ssh_sudo "'${REMOTE_APP_DIR}/.venv/bin/pip' install --no-index --find-links '${REMOTE_OFFLINE_DIR}/python-wheels' -r '${REMOTE_APP_DIR}/src/python/requirements.txt'"
  else
    warn "Python wheel bundle unavailable; checking for existing remote venv..."
    if ssh_sudo "test -x '${REMOTE_APP_DIR}/.venv/bin/python3'"; then
      ok "Reusing existing remote Python venv"
    else
      warn "No wheel bundle and no existing remote .venv; continuing without Python sidecar dependencies."
      warn "Backend API will run, but Python-backed functionality may be degraded until wheels are provided."
    fi
  fi

  local service_tmp="/tmp/testwallbooker.service"
  write_remote_file "$service_tmp" "[Unit]
Description=TestwallBooker Node.js Backend
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_GROUP}
WorkingDirectory=${REMOTE_APP_DIR}
EnvironmentFile=-${REMOTE_APP_DIR}/.env
Environment=NODE_ENV=production
Environment=PYTHON_CMD=python3
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target"

  ssh_sudo "install -m 644 '${service_tmp}' '/etc/systemd/system/${SERVICE_NAME}.service'"
  ssh_sudo "rm -f '${service_tmp}'"
  ssh_sudo "chown -R '${SERVICE_USER}:${SERVICE_GROUP}' '${REMOTE_APP_DIR}'"

  if ! ssh_sudo "test -f '${REMOTE_APP_DIR}/.env'"; then
    warn "No ${REMOTE_APP_DIR}/.env found. Service may start but DB/API settings can be missing."
  fi

  ssh_sudo "systemctl daemon-reload"
  ssh_sudo "systemctl enable '${SERVICE_NAME}'"
  ssh_sudo "systemctl restart '${SERVICE_NAME}'"

  ok "Service installed and restarted"
}

verify_health() {
  step "Health check  Verifying service and HTTP endpoints..."

  local service_status
  local attempts=0
  while true; do
    service_status="$(ssh_run "systemctl is-active ${SERVICE_NAME}" || true)"
    if [[ "$service_status" == "active" ]]; then
      break
    fi

    if [[ "$service_status" == "activating" && "$attempts" -lt 10 ]]; then
      attempts=$((attempts + 1))
      sleep 2
      continue
    fi

    break
  done

  if [[ "$service_status" != "active" ]]; then
    warn "Service is not active after warmup (status: ${service_status}). Collecting diagnostics..."
    ssh_sudo "systemctl status ${SERVICE_NAME} --no-pager -l || true"
    ssh_sudo "journalctl -u ${SERVICE_NAME} -n 120 --no-pager || true"
    fatal "Service is not active: ${service_status}"
  fi

  if ! ssh_run "curl -fsS http://127.0.0.1/booking/ >/dev/null"; then
    warn "Nginx local check for /booking/ failed."
  fi

  if ! ssh_run "curl -fsS http://127.0.0.1/booking/api/testwalls >/dev/null"; then
    warn "API check failed. Verify database and .env settings."
  fi

  ok "Service is active"
  ok "Deployment flow completed"
}

echo -e "${BOLD}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   TestwallBooker Setup + Deploy Script   ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${RESET}"
info "Target : $TARGET"
info "Backend: $REMOTE_APP_DIR"
info "Static : $REMOTE_STATIC_DIR"

step "1/10  Checking SSH connection..."
if ssh -o BatchMode=yes "${SSH_OPTS[@]}" "$TARGET" "echo ok" >/dev/null 2>&1; then
  ok "SSH key already available"
else
  bootstrap_ssh_key
fi
ssh_run "echo ok" >/dev/null || fatal "Cannot reach ${TARGET} via SSH"
ok "SSH connection successful"
validate_sudo_access

build_frontend
detect_remote_python_tag
prepare_offline_dependencies
provision_server
sync_static
sync_backend
sync_offline_runtime_dependencies
configure_nginx
configure_service_and_deps
verify_health

echo -e "\n${GREEN}${BOLD}Setup + deploy complete.${RESET}"
echo -e "${GREEN}Open: http://${TARGET#*@}/booking/${RESET}"
