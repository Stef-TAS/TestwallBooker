#!/usr/bin/env bash
# setup-phpmyadmin-offline.sh -- download on laptop, then install on offline server
# Usage:
#   bash deploy/setup-phpmyadmin-offline.sh user@host [local-bundle-dir]
#
# Defaults:
# - local-bundle-dir: .deploy-offline/phpmyadmin
# - PMA_PATH: /pma
# - PMA_VERSION: 5.2.2
# - DOWNLOAD_METHOD: auto (host|wsl|helper|docker|auto)
# - SKIP_RPMS: 0 (download and install PHP runtime RPMs offline)
# - HELPER_TARGET: optional online RHEL helper (user@host) for RPM download when laptop lacks dnf/yumdownloader
# - WSL_DISTRO: optional WSL distro name that has dnf (defaults to RockyLinux)
# - PMA_ARCHIVE: optional local phpMyAdmin archive (.zip, .tar.gz, .tgz, .tar.xz, .tar.bz2)
#
# Behavior:
# 1) Detect server RHEL major version over SSH
# 2) Download phpMyAdmin tarball (and optional PHP RPMs)
# 3) Transfer bundle to server and install without internet

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
DOWNLOAD_METHOD="${DOWNLOAD_METHOD:-auto}"
SKIP_RPMS="${SKIP_RPMS:-0}"
HELPER_TARGET="${HELPER_TARGET:-}"
WSL_DISTRO="${WSL_DISTRO:-RockyLinux}"
PMA_ARCHIVE="${PMA_ARCHIVE:-}"
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

HELPER_SSH_KEY_PATH="${HELPER_SSH_KEY_PATH:-$SSH_KEY_PATH}"
HELPER_SSH_OPTS=(-i "$HELPER_SSH_KEY_PATH" -o ConnectTimeout=12 -o StrictHostKeyChecking=accept-new)
HELPER_SUDO_PASSWORD="${HELPER_SUDO_PASSWORD:-}"

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

helper_ssh_run() {
  local remote_command="$1"
  ssh "${HELPER_SSH_OPTS[@]}" "$HELPER_TARGET" "$remote_command"
}

helper_ssh_sudo() {
  local remote_command="$1"
  ssh "${HELPER_SSH_OPTS[@]}" "$HELPER_TARGET" "sudo -S -p '' bash -lc $(printf '%q' "$remote_command")" <<<"$HELPER_SUDO_PASSWORD"
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

validate_helper_sudo_access_if_needed() {
  if [[ -z "$HELPER_TARGET" ]]; then
    return
  fi

  step "1b/9  Validating helper sudo credentials on ${HELPER_TARGET}..."

  if [[ -z "$HELPER_SUDO_PASSWORD" ]]; then
    read -r -s -p "Sudo password for helper ${HELPER_TARGET}: " HELPER_SUDO_PASSWORD
    echo
    HELPER_SUDO_PASSWORD="${HELPER_SUDO_PASSWORD%$'\r'}"
  fi

  if helper_ssh_sudo "true" >/dev/null 2>&1; then
    ok "Helper sudo authentication successful"
    return
  fi

  fatal "Helper sudo authentication failed for ${HELPER_TARGET}."
}

detect_remote_platform() {
  step "2/9  Detecting target OS/version..."

  local version_id
  version_id="$(ssh_run "source /etc/os-release >/dev/null 2>&1; echo \"\${VERSION_ID:-}\"" | tr -d '\r' || true)"
  REMOTE_RHEL_MAJOR="${version_id%%.*}"

  if [[ -z "$REMOTE_RHEL_MAJOR" || ! "$REMOTE_RHEL_MAJOR" =~ ^[0-9]+$ ]]; then
    warn "Could not detect VERSION_ID from /etc/os-release; defaulting download target to RHEL 9."
    REMOTE_RHEL_MAJOR="9"
  fi

  info "Detected target RHEL major version: ${REMOTE_RHEL_MAJOR}"
}

preflight_target_runtime_for_skip_rpms() {
  if [[ "$SKIP_RPMS" != "1" ]]; then
    return
  fi

  step "2b/9  Checking target runtime prerequisites for SKIP_RPMS=1..."

  local check_cmd
  check_cmd="$(cat <<'REMOTE'
set -euo pipefail

missing=''
command -v php >/dev/null 2>&1 || missing="${missing} php"
command -v php-fpm >/dev/null 2>&1 || missing="${missing} php-fpm"
command -v nginx >/dev/null 2>&1 || missing="${missing} nginx"

if command -v php >/dev/null 2>&1; then
  if ! php -m 2>/dev/null | grep -qiE '^mysqli$|^pdo_mysql$'; then
    missing="${missing} php-mysqlnd"
  fi
fi

if [[ -n "$missing" ]]; then
  echo "Missing target packages for SKIP_RPMS=1:${missing}"
  exit 1
fi

echo "ok"
REMOTE
)"

  if ! ssh_sudo "$check_cmd" >/dev/null; then
    fatal "Target is missing required runtime packages for SKIP_RPMS=1. Install php, php-fpm, php-mysqlnd and nginx on the server, or rerun with SKIP_RPMS=0 and provide offline RPMs."
  fi

  ok "Target runtime prerequisites are present"
}

prepare_bundle_on_laptop() {
  step "3/9  Preparing offline bundle on laptop..."

  if [[ "$SKIP_DOWNLOAD" == "1" ]]; then
    warn "SKIP_DOWNLOAD=1 set; using existing bundle at ${LOCAL_BUNDLE_DIR}."
    return
  fi

  rm -rf "$LOCAL_BUNDLE_DIR"
  mkdir -p "$LOCAL_BUNDLE_DIR/rpms"

  local bundle_abs
  bundle_abs="$(cd "$LOCAL_BUNDLE_DIR" && pwd)"

  resolve_local_input_path() {
    local raw_path="$1"
    if [[ -f "$raw_path" ]]; then
      printf '%s\n' "$raw_path"
      return 0
    fi
    if command -v cygpath >/dev/null 2>&1; then
      local converted
      converted="$(cygpath -u "$raw_path" 2>/dev/null || true)"
      if [[ -n "$converted" && -f "$converted" ]]; then
        printf '%s\n' "$converted"
        return 0
      fi
    fi
    return 1
  }

  stage_phpmyadmin_tarball() {
    local out_tar="$bundle_abs/phpMyAdmin-${PMA_VERSION}-all-languages.tar.gz"

    if [[ -n "$PMA_ARCHIVE" ]]; then
      local archive_path
      archive_path="$(resolve_local_input_path "$PMA_ARCHIVE" || true)"
      [[ -n "$archive_path" ]] || fatal "PMA_ARCHIVE was set, but file was not found: $PMA_ARCHIVE"

      local unpack_dir="$bundle_abs/.pma-unpack"
      rm -rf "$unpack_dir"
      mkdir -p "$unpack_dir"

      case "${archive_path,,}" in
        *.zip)
          if command -v unzip >/dev/null 2>&1; then
            unzip -q "$archive_path" -d "$unpack_dir"
          elif command -v bsdtar >/dev/null 2>&1; then
            bsdtar -xf "$archive_path" -C "$unpack_dir"
          elif command -v powershell.exe >/dev/null 2>&1; then
            powershell.exe -NoProfile -Command "Expand-Archive -LiteralPath '$archive_path' -DestinationPath '$unpack_dir' -Force" >/dev/null
          else
            fatal "Cannot extract .zip archive. Install unzip or bsdtar."
          fi
          ;;
        *.tar.gz|*.tgz)
          tar -xzf "$archive_path" -C "$unpack_dir"
          ;;
        *.tar.xz)
          tar -xJf "$archive_path" -C "$unpack_dir"
          ;;
        *.tar.bz2)
          tar -xjf "$archive_path" -C "$unpack_dir"
          ;;
        *.tar)
          tar -xf "$archive_path" -C "$unpack_dir"
          ;;
        *)
          fatal "Unsupported PMA_ARCHIVE format: $archive_path"
          ;;
      esac

      local src_dir
      src_dir="$(find "$unpack_dir" -mindepth 1 -maxdepth 3 -type f -name index.php -printf '%h\n' | head -n1 || true)"
      [[ -n "$src_dir" ]] || fatal "Could not locate phpMyAdmin content inside PMA_ARCHIVE."

      rm -f "$out_tar"
      tar -czf "$out_tar" -C "$(dirname "$src_dir")" "$(basename "$src_dir")"
      rm -rf "$unpack_dir"
      ok "Using local phpMyAdmin archive from ${archive_path}"
      return
    fi

    command -v curl >/dev/null 2>&1 || fatal "curl is required to download phpMyAdmin tarball."
    curl -fsSL "https://files.phpmyadmin.net/phpMyAdmin/${PMA_VERSION}/phpMyAdmin-${PMA_VERSION}-all-languages.tar.gz" \
      -o "$out_tar"
  }

  if [[ "$SKIP_RPMS" == "1" ]]; then
    warn "SKIP_RPMS=1 set; skipping local RPM download."
    stage_phpmyadmin_tarball
    ok "Offline bundle downloaded to ${LOCAL_BUNDLE_DIR}"
    return
  fi

  download_with_helper_machine() {
    [[ -n "$HELPER_TARGET" ]] || fatal "DOWNLOAD_METHOD=helper requires HELPER_TARGET=user@host."
    info "Using helper machine ${HELPER_TARGET} to build RPM bundle"
    validate_helper_sudo_access_if_needed

    local helper_stage="/tmp/pma-offline-${USER:-user}-$$"
    local helper_cmd

    if ! helper_ssh_run "echo ok" >/dev/null 2>&1; then
      fatal "Cannot reach HELPER_TARGET ${HELPER_TARGET} via SSH."
    fi

    helper_ssh_run "rm -rf '$helper_stage' && mkdir -p '$helper_stage/rpms'"

    if ! helper_ssh_run "dnf download --help >/dev/null 2>&1"; then
      helper_ssh_sudo "dnf -y install dnf-plugins-core --disablerepo='mysql-*' --setopt=*.skip_if_unavailable=True"
    fi

    helper_cmd="$(cat <<'REMOTE'
set -euo pipefail
cd '__HELPER_STAGE__'
dnf -y download --resolve --alldeps --destdir ./rpms \
  --disablerepo='mysql-*' \
  --setopt=*.skip_if_unavailable=True \
  php php-cli php-common php-fpm php-json php-mbstring php-mysqlnd php-pdo php-xml nginx
tar -czf pma-offline-bundle-rhel__RHEL_MAJOR__.tar.gz -C '__HELPER_STAGE__' .
REMOTE
)"

    helper_cmd="${helper_cmd//__HELPER_STAGE__/$helper_stage}"
    helper_cmd="${helper_cmd//__RHEL_MAJOR__/$REMOTE_RHEL_MAJOR}"

    helper_ssh_run "$helper_cmd"

    helper_ssh_run "cat '$helper_stage/pma-offline-bundle-rhel${REMOTE_RHEL_MAJOR}.tar.gz'" > "$bundle_abs/pma-offline-bundle-rhel${REMOTE_RHEL_MAJOR}.tar.gz"
    tar -xzf "$bundle_abs/pma-offline-bundle-rhel${REMOTE_RHEL_MAJOR}.tar.gz" -C "$bundle_abs"
    rm -f "$bundle_abs/pma-offline-bundle-rhel${REMOTE_RHEL_MAJOR}.tar.gz"
    helper_ssh_run "rm -rf '$helper_stage'" || true
  }

  download_with_wsl() {
    info "Using WSL distro ${WSL_DISTRO} to build RPM bundle"

    command -v wsl.exe >/dev/null 2>&1 || fatal "wsl.exe is not available. Use DOWNLOAD_METHOD=host/helper/docker."

    local wsl_stage="/tmp/pma-offline-$RANDOM"
    local wsl_cmd

    if ! wsl.exe -d "$WSL_DISTRO" -- bash -lc "echo ok" >/dev/null 2>&1; then
      fatal "Cannot run WSL distro '${WSL_DISTRO}'. Install/import a RHEL-compatible distro with dnf, or set WSL_DISTRO to an existing one."
    fi

    wsl_cmd="$(cat <<'REMOTE'
set -euo pipefail
mkdir -p '__WSL_STAGE__/rpms'
cd '__WSL_STAGE__'

if ! dnf download --help >/dev/null 2>&1; then
  sudo dnf -y install dnf-plugins-core --disablerepo='mysql-*' --setopt=*.skip_if_unavailable=True
fi

dnf -y download --resolve --alldeps --destdir ./rpms \
  --disablerepo='mysql-*' \
  --setopt=*.skip_if_unavailable=True \
  php php-cli php-common php-fpm php-json php-mbstring php-mysqlnd php-pdo php-xml nginx

tar -czf 'pma-offline-bundle-rhel__RHEL_MAJOR__.tar.gz' -C '__WSL_STAGE__' .
REMOTE
)"

    wsl_cmd="${wsl_cmd//__WSL_STAGE__/$wsl_stage}"
    wsl_cmd="${wsl_cmd//__RHEL_MAJOR__/$REMOTE_RHEL_MAJOR}"

    if ! wsl.exe -d "$WSL_DISTRO" -- bash -lc "$wsl_cmd"; then
      fatal "WSL RPM bundle build failed in distro ${WSL_DISTRO}."
    fi

    wsl.exe -d "$WSL_DISTRO" -- bash -lc "cat '$wsl_stage/pma-offline-bundle-rhel${REMOTE_RHEL_MAJOR}.tar.gz'" > "$bundle_abs/pma-offline-bundle-rhel${REMOTE_RHEL_MAJOR}.tar.gz"
    tar -xzf "$bundle_abs/pma-offline-bundle-rhel${REMOTE_RHEL_MAJOR}.tar.gz" -C "$bundle_abs"
    rm -f "$bundle_abs/pma-offline-bundle-rhel${REMOTE_RHEL_MAJOR}.tar.gz"
    wsl.exe -d "$WSL_DISTRO" -- bash -lc "rm -rf '$wsl_stage'" || true
  }

  download_with_host_tools() {
    info "Using host package tools (no Docker)"

    if command -v dnf >/dev/null 2>&1; then
      dnf download --help >/dev/null 2>&1 || fatal "'dnf download' is unavailable. Install dnf-plugins-core, or prebuild and use SKIP_DOWNLOAD=1."

      dnf -y download --resolve --alldeps \
        --releasever "$REMOTE_RHEL_MAJOR" \
        --destdir "$bundle_abs/rpms" \
        php php-cli php-common php-fpm php-json php-mbstring php-mysqlnd php-pdo php-xml
    elif command -v yumdownloader >/dev/null 2>&1; then
      yumdownloader --resolve --destdir "$bundle_abs/rpms" \
        php php-cli php-common php-fpm php-json php-mbstring php-mysqlnd php-pdo php-xml
    else
      if command -v wsl.exe >/dev/null 2>&1; then
        download_with_wsl
        return
      fi

      if [[ -n "$HELPER_TARGET" ]]; then
        download_with_helper_machine
        return
      fi

      cat >&2 <<EOF
No host RPM download tool found on this laptop.

Offline fallback (run on an ONLINE RHEL ${REMOTE_RHEL_MAJOR} helper machine):
  sudo mkdir -p /tmp/pma-bundle/rpms
  cd /tmp/pma-bundle
  sudo dnf -y install dnf-plugins-core \
    --disablerepo='mysql-*' \
    --setopt=*.skip_if_unavailable=True
  sudo dnf -y download --resolve --alldeps --destdir ./rpms \
    --disablerepo='mysql-*' \
    --setopt=*.skip_if_unavailable=True \
    php php-cli php-common php-fpm php-json php-mbstring php-mysqlnd php-pdo php-xml nginx
  sudo tar -czf /tmp/pma-offline-bundle-rhel${REMOTE_RHEL_MAJOR}.tar.gz -C /tmp/pma-bundle .

On this laptop:
  1) Download phpMyAdmin tarball into ${LOCAL_BUNDLE_DIR}:
     curl -fsSL https://files.phpmyadmin.net/phpMyAdmin/${PMA_VERSION}/phpMyAdmin-${PMA_VERSION}-all-languages.tar.gz -o ${LOCAL_BUNDLE_DIR}/phpMyAdmin-${PMA_VERSION}-all-languages.tar.gz
  2) Copy /tmp/pma-offline-bundle-rhel${REMOTE_RHEL_MAJOR}.tar.gz from helper machine and extract into ${LOCAL_BUNDLE_DIR}
  3) Rerun:
     SKIP_DOWNLOAD=1 bash deploy/setup-phpmyadmin-offline.sh ${TARGET} ${LOCAL_BUNDLE_DIR}
EOF
      fatal "Cannot download RPMs on this laptop without dnf/yumdownloader."
    fi

  }

  download_with_docker() {
    command -v docker >/dev/null 2>&1 || fatal "Docker is not installed locally. Use DOWNLOAD_METHOD=host or SKIP_DOWNLOAD=1."
    docker info >/dev/null 2>&1 || fatal "Docker daemon is not reachable. Use DOWNLOAD_METHOD=host or SKIP_DOWNLOAD=1."

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
"
  }

  case "$DOWNLOAD_METHOD" in
    host)
      download_with_host_tools
      ;;
    wsl)
      download_with_wsl
      ;;
    helper)
      download_with_helper_machine
      ;;
    docker)
      download_with_docker
      ;;
    auto)
      if command -v dnf >/dev/null 2>&1 || command -v yumdownloader >/dev/null 2>&1; then
        download_with_host_tools
      elif command -v wsl.exe >/dev/null 2>&1; then
        download_with_wsl
      elif [[ -n "$HELPER_TARGET" ]]; then
        download_with_helper_machine
      elif command -v docker >/dev/null 2>&1; then
        download_with_docker
      else
        fatal "No available download method. Install host RPM tools, set HELPER_TARGET for remote bundle build, set DOWNLOAD_METHOD=docker, or prebuild and use SKIP_DOWNLOAD=1."
      fi
      ;;
    *)
      fatal "Invalid DOWNLOAD_METHOD='$DOWNLOAD_METHOD'. Use: auto, host, wsl, helper, or docker."
      ;;
  esac

  stage_phpmyadmin_tarball

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

  if [[ "$SKIP_RPMS" != "1" ]]; then
    (( ${#rpm_files[@]} > 0 )) || fatal "No RPM files found in bundle."
    ok "Found ${#rpm_files[@]} RPM files"
  else
    warn "SKIP_RPMS=1: RPM files are optional and were not required."
  fi

  (( ${#pma_tar[@]} > 0 )) || fatal "No phpMyAdmin tarball found in bundle."
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

  local remote_cmd
  remote_cmd="$(cat <<'REMOTE'
set -euo pipefail
cd '__REMOTE_STAGE_DIR__'

shopt -s nullglob
RPM_FILES=(./*.rpm ./rpms/*.rpm)
PMA_TAR=(./phpMyAdmin-*.tar.gz ./phpMyAdmin-*.tar.xz ./phpMyAdmin-*.tar.bz2)
shopt -u nullglob

if [[ "__SKIP_RPMS__" != "1" ]]; then
  (( ${#RPM_FILES[@]} > 0 )) || { echo 'No RPM files found on target stage directory.'; exit 1; }

  PKG_MGR=''
  if command -v dnf >/dev/null 2>&1; then
    PKG_MGR='dnf'
  elif command -v yum >/dev/null 2>&1; then
    PKG_MGR='yum'
  else
    echo 'Neither dnf nor yum exists on target.'
    exit 1
  fi

  if [[ "$PKG_MGR" == 'dnf' ]]; then
    dnf -y install --disablerepo='*' "${RPM_FILES[@]}"
  else
    yum -y localinstall "${RPM_FILES[@]}"
  fi
fi

(( ${#PMA_TAR[@]} > 0 )) || { echo 'No phpMyAdmin tarball found on target stage directory.'; exit 1; }

rm -rf /usr/share/phpMyAdmin
mkdir -p /usr/share/phpMyAdmin
tar -xf "${PMA_TAR[0]}" -C /tmp

EXTRACTED_DIR=''
for d in /tmp/phpMyAdmin-*; do
  if [[ -d "$d" ]]; then
    EXTRACTED_DIR="$d"
    break
  fi
done

if [[ -z "$EXTRACTED_DIR" ]]; then
  echo 'Failed to locate extracted phpMyAdmin directory in /tmp.'
  exit 1
fi

cp -a "$EXTRACTED_DIR"/. /usr/share/phpMyAdmin/

if ! command -v php-fpm >/dev/null 2>&1; then
  echo 'php-fpm is missing. Install php-fpm on target, or rerun without SKIP_RPMS.'
  exit 1
fi

if ! php -m 2>/dev/null | grep -qiE '^mysqli$|^pdo_mysql$'; then
  echo 'PHP MySQL extension is missing (mysqli/pdo_mysql). Install php-mysqlnd on target, or rerun without SKIP_RPMS.'
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo 'nginx is missing on target.'
  exit 1
fi
REMOTE
)"

  remote_cmd="${remote_cmd//__REMOTE_STAGE_DIR__/$REMOTE_STAGE_DIR}"
  remote_cmd="${remote_cmd//__SKIP_RPMS__/$SKIP_RPMS}"

  ssh_sudo "$remote_cmd"
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
info "Download   : ${DOWNLOAD_METHOD}"
info "Skip RPMs  : ${SKIP_RPMS}"
if [[ -n "$PMA_ARCHIVE" ]]; then
  info "PMA file   : ${PMA_ARCHIVE}"
fi
if [[ "$DOWNLOAD_METHOD" == "wsl" || "$DOWNLOAD_METHOD" == "auto" ]]; then
  info "WSL distro : ${WSL_DISTRO}"
fi
if [[ -n "$HELPER_TARGET" ]]; then
  info "Helper     : ${HELPER_TARGET}"
fi

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
preflight_target_runtime_for_skip_rpms
prepare_bundle_on_laptop
check_local_bundle
sync_bundle
install_packages_and_files
configure_phpmyadmin
verify_install
cleanup_remote_stage

echo -e "\n${GREEN}${BOLD}Offline phpMyAdmin setup complete.${RESET}"
echo -e "${GREEN}Open: http://${TARGET#*@}${PMA_PATH}/${RESET}"
