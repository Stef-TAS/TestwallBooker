#!/usr/bin/env bash
# setup-phpmyadmin-offline.sh — download on laptop, then install on offline server
# Usage:
#   bash deploy/setup-phpmyadmin-offline.sh user@host [local-bundle-dir]
#
# Defaults:
# - local-bundle-dir: .deploy-offline/phpmyadmin
# - PMA_PATH: /pma
# - PMA_VERSION: 5.2.2
#
# Behavior:
# 1) Detect server RHEL major version over SSH
# 2) Download required PHP RPMs on laptop using Docker (matching Rocky image)
# 3) Download phpMyAdmin tarball on laptop
# 4) Transfer bundle to server and install without internet

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
LOCAL_BUNDLE_DIR="${2:-.deploy-offline/phpmyadmin}"
PMA_PATH="${PMA_PATH:-/pma}"
PMA_VERSION="${PMA_VERSION:-5.2.2}"
SKIP_DOWNLOAD="${SKIP_DOWNLOAD:-0}"
REMOTE_STAGE_DIR="/opt/phpmyadmin-offline"
REMOTE_RHEL_MAJOR=""

if [[ -z "$TARGET" ]]; then
  fatal "Usage: bash deploy/setup-phpmyadmin-offline.sh user@host [local-bundle-dir]"
fi

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
  step "0/9  Installing temporary SSH key on the server..."
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
  step "1/9  Validating sudo credentials on target..."

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

detect_remote_platform() {
  step "2/9  Detecting target OS/version..."

  local version_id
  version_id="$(ssh_run "source /etc/os-release >/dev/null 2>&1; echo \"\${VERSION_ID:-}\"" | tr -d '\r' || true)"
  REMOTE_RHEL_MAJOR="${version_id%%.*}"

  if [[ -z "$REMOTE_RHEL_MAJOR" || ! "$REMOTE_RHEL_MAJOR" =~ ^[0-9]+$ ]]; then
    warn "Could not detect VERSION_ID from /etc/os-release; defaulting bundle base image to Rocky Linux 9."
    REMOTE_RHEL_MAJOR="9"
  fi

  info "Detected target RHEL major version: ${REMOTE_RHEL_MAJOR}"
}

prepare_bundle_on_laptop() {
  step "3/9  Preparing offline bundle on laptop..."

  if [[ "$SKIP_DOWNLOAD" == "1" ]]; then
    warn "SKIP_DOWNLOAD=1 set; using existing bundle at ${LOCAL_BUNDLE_DIR}."
    return
  fi

  command -v docker >/dev/null 2>&1 || fatal "Docker is required locally to build the offline RPM bundle."
  docker info >/dev/null 2>&1 || fatal "Docker daemon is not reachable. Start Docker Desktop and retry."

  rm -rf "$LOCAL_BUNDLE_DIR"
  mkdir -p "$LOCAL_BUNDLE_DIR/rpms"

  local bundle_abs
  bundle_abs="$(cd "$LOCAL_BUNDLE_DIR" && pwd)"

  local container_image
  if [[ "$REMOTE_RHEL_MAJOR" == "8" ]]; then
    container_image="rockylinux:8"
  else
    container_image="rockylinux:9"
  fi

  info "Using container image ${container_image} to download matching RPMs"

  docker run --rm \
    -v "${bundle_abs}:/bundle" \
    "$container_image" \
    bash -lc "
set -euo pipefail
dnf -y install dnf-plugins-core curl ca-certificates
dnf -y makecache
dnf -y download --resolve --alldeps --destdir /bundle/rpms \
  php php-cli php-common php-fpm php-json php-mbstring php-mysqlnd php-pdo php-xml
curl -fsSL 'https://files.phpmyadmin.net/phpMyAdmin/${PMA_VERSION}/phpMyAdmin-${PMA_VERSION}-all-languages.tar.gz' \
  -o '/bundle/phpMyAdmin-${PMA_VERSION}-all-languages.tar.gz'
"

  ok "Offline bundle downloaded to ${LOCAL_BUNDLE_DIR}"
}

check_local_bundle() {
  step "4/9  Verifying local bundle contents..."

  [[ -d "$LOCAL_BUNDLE_DIR" ]] || fatal "Bundle directory not found: $LOCAL_BUNDLE_DIR"

  shopt -s nullglob
  local rpm_files=("$LOCAL_BUNDLE_DIR"/*.rpm "$LOCAL_BUNDLE_DIR"/rpms/*.rpm)
  local pma_tar=(
    "$LOCAL_BUNDLE_DIR"/phpMyAdmin-*.tar.gz
    "$LOCAL_BUNDLE_DIR"/phpMyAdmin-*.tar.xz
    "$LOCAL_BUNDLE_DIR"/phpMyAdmin-*.tar.bz2
  )
  shopt -u nullglob

  (( ${#rpm_files[@]} > 0 )) || fatal "No RPM files found in bundle."
  (( ${#pma_tar[@]} > 0 )) || fatal "No phpMyAdmin tarball found in bundle."

  ok "Found ${#rpm_files[@]} RPM files"
  ok "Found phpMyAdmin tarball: $(basename "${pma_tar[0]}")"
}

sync_bundle() {
  step "5/9  Uploading bundle to server..."
  ssh_sudo "rm -rf '${REMOTE_STAGE_DIR}' && mkdir -p '${REMOTE_STAGE_DIR}' && chown -R '${TARGET%@*}' '${REMOTE_STAGE_DIR}'"
  tar -C "$LOCAL_BUNDLE_DIR" -cf - . | ssh_run "tar -xmf - --no-same-owner --no-same-permissions -C '${REMOTE_STAGE_DIR}'"
  ok "Bundle uploaded to ${REMOTE_STAGE_DIR}"
}

install_packages_and_files() {
  step "6/9  Installing PHP stack and phpMyAdmin on target..."

  ssh_sudo "
set -euo pipefail
cd '${REMOTE_STAGE_DIR}'

PKG_MGR=''
if command -v dnf >/dev/null 2>&1; then
  PKG_MGR='dnf'
elif command -v yum >/dev/null 2>&1; then
  PKG_MGR='yum'
else
  echo 'Neither dnf nor yum exists on target.'
  exit 1
fi

shopt -s nullglob
RPM_FILES=(./*.rpm ./rpms/*.rpm)
PMA_TAR=(./phpMyAdmin-*.tar.gz ./phpMyAdmin-*.tar.xz ./phpMyAdmin-*.tar.bz2)
shopt -u nullglob

if [[ \"$PKG_MGR\" == 'dnf' ]]; then
  dnf -y install --disablerepo='*' \\"\\${RPM_FILES[@]}\\"
else
  yum -y localinstall \\"\\${RPM_FILES[@]}\\"
fi

rm -rf /usr/share/phpMyAdmin
mkdir -p /usr/share/phpMyAdmin
tar -xf \"\\${PMA_TAR[0]}\" -C /tmp

EXTRACTED_DIR=''
for d in /tmp/phpMyAdmin-*; do
  if [[ -d \"$d\" ]]; then
    EXTRACTED_DIR=\"$d\"
    break
  fi
done

if [[ -z \"$EXTRACTED_DIR\" ]]; then
  echo 'Failed to locate extracted phpMyAdmin directory in /tmp.'
  exit 1
fi

cp -a \"$EXTRACTED_DIR\"/. /usr/share/phpMyAdmin/

if ! command -v php-fpm >/dev/null 2>&1; then
  echo 'php-fpm is missing after install.'
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo 'nginx is missing on target.'
  exit 1
fi
"

  ok "Packages and phpMyAdmin files installed"
}

configure_phpmyadmin() {
  step "7/9  Configuring phpMyAdmin, PHP-FPM and Nginx..."

  local blowfish_secret
  if command -v openssl >/dev/null 2>&1; then
    blowfish_secret="$(openssl rand -hex 24)"
  else
    blowfish_secret="$(date +%s)-offline-pma-secret"
  fi

  local remote_cmd
  remote_cmd="$(cat <<'REMOTE'
set -euo pipefail

if [[ ! -d /etc/nginx/default.d ]]; then
  echo '/etc/nginx/default.d was not found; cannot safely inject location-only config automatically.'
  exit 1
fi

PMA_PATH="__PMA_PATH__"
BLOWFISH_SECRET="__BLOWFISH_SECRET__"

if [[ "$PMA_PATH" != /* ]]; then
  PMA_PATH="/$PMA_PATH"
fi
PMA_PATH="${PMA_PATH%/}"

PHP_FPM_SOCKET='unix:/run/php-fpm/www.sock'
if [[ -f /etc/php-fpm.d/www.conf ]]; then
  LISTEN_LINE="$(grep -E '^listen\s*=' /etc/php-fpm.d/www.conf | head -n1 || true)"
  LISTEN_VAL="${LISTEN_LINE#*=}"
  LISTEN_VAL="$(echo "$LISTEN_VAL" | xargs || true)"
  if [[ -n "$LISTEN_VAL" ]]; then
    if [[ "$LISTEN_VAL" == /* ]]; then
      PHP_FPM_SOCKET="unix:$LISTEN_VAL"
    else
      PHP_FPM_SOCKET="$LISTEN_VAL"
    fi
  fi
fi

install -d -m 755 /var/lib/phpMyAdmin/tmp
chown -R nginx:nginx /var/lib/phpMyAdmin || true

if [[ ! -f /usr/share/phpMyAdmin/config.inc.php ]]; then
  if [[ -f /usr/share/phpMyAdmin/config.sample.inc.php ]]; then
    cp /usr/share/phpMyAdmin/config.sample.inc.php /usr/share/phpMyAdmin/config.inc.php
  else
    cat > /usr/share/phpMyAdmin/config.inc.php <<'EOF'
<?php
declare(strict_types=1);
$cfg = [];
$cfg['blowfish_secret'] = '';
$i = 0;
EOF
  fi
fi

grep -v "blowfish_secret" /usr/share/phpMyAdmin/config.inc.php > /tmp/config.inc.php.tmp || true
echo "\$cfg['blowfish_secret'] = '${BLOWFISH_SECRET}';" >> /tmp/config.inc.php.tmp
mv /tmp/config.inc.php.tmp /usr/share/phpMyAdmin/config.inc.php

cat > /etc/nginx/default.d/phpmyadmin.conf <<EOF
location ${PMA_PATH}/ {
    alias /usr/share/phpMyAdmin/;
    index index.php;
    try_files \$uri \$uri/ ${PMA_PATH}/index.php?\$query_string;
}

location ~ ^${PMA_PATH}/(.+\.php)$ {
    alias /usr/share/phpMyAdmin/\$1;
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME /usr/share/phpMyAdmin/\$1;
    fastcgi_pass ${PHP_FPM_SOCKET};
}
EOF

setsebool -P httpd_can_network_connect_db 1 >/dev/null 2>&1 || true
restorecon -Rv /usr/share/phpMyAdmin /var/lib/phpMyAdmin /etc/nginx/default.d/phpmyadmin.conf >/dev/null 2>&1 || true

systemctl enable --now php-fpm
systemctl enable --now nginx
nginx -t
systemctl reload nginx
REMOTE
)"

  remote_cmd="${remote_cmd//__PMA_PATH__/$PMA_PATH}"
  remote_cmd="${remote_cmd//__BLOWFISH_SECRET__/$blowfish_secret}"

  ssh_sudo "$remote_cmd"
  ok "phpMyAdmin runtime config applied"
}

verify_install() {
  step "8/9  Verifying installation..."

  ssh_sudo "systemctl is-active php-fpm"
  ssh_sudo "systemctl is-active nginx"

  local http_code
  http_code="$(ssh_run "curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1${PMA_PATH}/index.php || true")"
  if [[ "$http_code" == "200" || "$http_code" == "302" || "$http_code" == "403" ]]; then
    ok "phpMyAdmin endpoint responded with HTTP ${http_code}"
  else
    warn "phpMyAdmin endpoint returned HTTP ${http_code}"
    warn "Check: systemctl status php-fpm nginx ; journalctl -u php-fpm -u nginx -n 100"
  fi
}

cleanup_remote_stage() {
  step "9/9  Cleaning temporary stage directory..."
  ssh_sudo "rm -rf '${REMOTE_STAGE_DIR}'"
  ok "Cleanup complete"
}

echo -e "${BOLD}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   Offline phpMyAdmin Install Automation  ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${RESET}"
info "Target     : $TARGET"
info "Bundle dir : $LOCAL_BUNDLE_DIR"
info "URL path   : ${PMA_PATH}/"
info "PMA ver    : ${PMA_VERSION}"

step "Preflight  Checking SSH connectivity..."
if ssh -o BatchMode=yes "${SSH_OPTS[@]}" "$TARGET" "echo ok" >/dev/null 2>&1; then
  ok "SSH key already available"
else
  bootstrap_ssh_key
fi

ssh_run "echo ok" >/dev/null || fatal "Cannot reach ${TARGET} via SSH"
ok "SSH connection successful"

validate_sudo_access
detect_remote_platform
prepare_bundle_on_laptop
check_local_bundle
sync_bundle
install_packages_and_files
configure_phpmyadmin
verify_install
cleanup_remote_stage

echo -e "\n${GREEN}${BOLD}Offline phpMyAdmin setup complete.${RESET}"
echo -e "${GREEN}Open: http://${TARGET#*@}${PMA_PATH}/${RESET}"
