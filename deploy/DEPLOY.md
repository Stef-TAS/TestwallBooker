# Deployment Guide

This is the current, working deployment flow for TestwallBooker.

## Recommended script

Use:

```bash
bash deploy/setup-and-deploy.sh user@host
```

This is the main script for real environments and includes:

1. SSH key bootstrap.
2. Frontend build (or reuse existing dist/).
3. Backend + static file sync.
4. Offline dependency transfer for Linux node_modules.
5. Nginx config + SELinux/firewall adjustments.
6. systemd restart + health checks.

## Important environment assumptions

1. The server may not have internet access.
2. Node/Python/NGINX/systemd must already be installed on the server.
3. Dependency downloads happen on the laptop, then are copied to the server.
4. The script requires sudo access on the target host.

## Current runtime architecture

1. Frontend static files:
   - /usr/share/nginx/html/booking
2. Backend app:
   - /opt/testwallbooker
3. Nginx API proxy:
   - /api/* -> http://127.0.0.1:3001/api/*
4. Backend service name:
   - testwallbooker

## One-time server setup checklist

Do this once on the server:

1. Create database + user.
2. Create /opt/testwallbooker/.env using deploy/.env.production.example.
3. Ensure the deploy SSH user can run sudo.
4. Ensure Nginx is enabled and running.

Example DB SQL:

```sql
CREATE DATABASE IF NOT EXISTS testwallbooker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'testwallbooker'@'localhost' IDENTIFIED BY '<strong_password>';
GRANT ALL PRIVILEGES ON testwallbooker.* TO 'testwallbooker'@'localhost';
FLUSH PRIVILEGES;
```

Example .env:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=testwallbooker
DB_PASSWORD=<strong_password_here>
DB_NAME=testwallbooker
SERVER_PORT=3001
NODE_ENV=production
PYTHON_STATUS_URL=http://127.0.0.1:8080/api/machines
```

Use `PYTHON_STATUS_URL` if the Node backend should read live machine-user status from the Python status server at a specific address.

## Deploy command

From repository root:

```bash
bash deploy/setup-and-deploy.sh user@host
```

## Verification commands

On the server:

```bash
systemctl status testwallbooker --no-pager -l
journalctl -u testwallbooker -n 120 --no-pager
curl -I http://127.0.0.1/
curl -I http://127.0.0.1/api/testwalls
```

From a browser:

1. http://<host>/
2. Login page and API calls should no longer return 502.

## Known issues and fixes

### 1) Login error: Unexpected token '<' ... not valid JSON

Cause:
API call returned HTML (usually Nginx 502 page).

Fix:

1. Check backend service:
   - systemctl status testwallbooker
2. Check backend direct endpoint:
   - curl http://127.0.0.1:3001/api/testwalls

### 2) Service crash: status=209/STDOUT / Failed at step STDOUT

Cause:
systemd stdout/stderr file redirection permissions.

Fix:

1. Use current setup-and-deploy script version (it does not set StandardOutput/StandardError append targets).
2. Reload and restart service:

```bash
sudo systemctl daemon-reload
sudo systemctl restart testwallbooker
```

### 3) Service crash: esbuild EACCES

Cause:
executable bits lost on node_modules binaries during cross-platform copy.

Fix:

1. Use current setup-and-deploy script version (it reapplies executable permissions in node_modules).
2. Manual hotfix if needed:

```bash
sudo chmod 755 /opt/testwallbooker/node_modules/.bin/* || true
sudo find /opt/testwallbooker/node_modules -type f -path '*/bin/*' -exec chmod 755 {} +
sudo systemctl restart testwallbooker
```

### 4) Local dev won't start (npm run dev)

Cause:
broken local node_modules (invalid/missing vite or npm-run-all2).

Fix:

```bash
npm install
npm run dev
```

If port 5173 is in use, Vite will pick another port automatically.
