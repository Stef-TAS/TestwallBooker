# TestwallBooker From-Scratch Setup Guide

This guide starts from zero and gets you to a working deployment at:

1. http://<host>/booking/
2. API reachable at /api/*

It is designed for your current environment:

1. Windows developer machine.
2. Linux server (RHEL-family assumed).
3. Server may have no access to external package repos.

## 1. What you need before starting

### Developer machine

1. Git.
2. Node.js + npm.
3. bash available in terminal.
4. SSH client.

### Server

Preinstall these once (via internal mirror or offline package process):

1. node
2. npm
3. python3 with venv support
4. nginx
5. systemd
6. tar
7. curl
8. mysql or mariadb

## 2. Clone project and prepare local workspace

```bash
git clone <repo-url>
cd TestwallBooker
npm install
```

Local sanity check:

```bash
npm run dev
```

If the dev server starts, local dependencies are healthy.

## 3. Create database on the server

Run in mysql/mariadb:

```sql
CREATE DATABASE IF NOT EXISTS testwallbooker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'testwallbooker'@'localhost' IDENTIFIED BY '<strong_password>';
GRANT ALL PRIVILEGES ON testwallbooker.* TO 'testwallbooker'@'localhost';
FLUSH PRIVILEGES;
```

## 4. Create production env file on server

Create file:

1. /opt/testwallbooker/.env

Contents:

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

Protect it:

```bash
sudo chmod 600 /opt/testwallbooker/.env
```

## 5. SELinux and firewall baseline (RHEL family)

Allow Nginx to proxy to backend:

```bash
sudo setsebool -P httpd_can_network_connect 1
```

Restore static folder context if needed:

```bash
sudo restorecon -Rv /usr/share/nginx/html/booking/
```

Open HTTP service:

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload
```

## 6. First deployment

From repo root on your laptop:

```bash
bash deploy/setup-and-deploy.sh user@host
```

What this script does:

1. Validates SSH and sudo.
2. Builds or reuses frontend dist.
3. Copies backend and static files.
4. Prepares Linux node_modules locally and transfers them.
5. Writes Nginx config snippets.
6. Creates/updates systemd unit and restarts service.
7. Runs service and HTTP health checks.

## 7. Verify deployment

On server:

```bash
systemctl status testwallbooker --no-pager -l
journalctl -u testwallbooker -n 120 --no-pager
curl -I http://127.0.0.1/booking/
curl -I http://127.0.0.1/api/testwalls
```

In browser:

1. Open http://<host>/booking/
2. Try login.

## 8. Troubleshooting quick fixes

### A. Login fails with JSON parse error Unexpected token '<'

Meaning:
frontend received HTML error page instead of JSON, usually Nginx 502.

Check:

```bash
curl -I http://127.0.0.1/api/testwalls
systemctl status testwallbooker --no-pager -l
```

### B. testwallbooker status=209/STDOUT

Meaning:
bad systemd stdout/stderr configuration in service unit.

Fix:

1. Use current deploy script version.
2. Reload and restart:

```bash
sudo systemctl daemon-reload
sudo systemctl restart testwallbooker
```

### C. Backend crash with esbuild EACCES

Meaning:
node_modules executable bits were lost during transfer.

Fix:

```bash
sudo chmod 755 /opt/testwallbooker/node_modules/.bin/* || true
sudo find /opt/testwallbooker/node_modules -type f -path '*/bin/*' -exec chmod 755 {} +
sudo systemctl restart testwallbooker
```

### D. Local npm run dev fails

Fix:

```bash
npm install
npm run dev
```

## 9. Regular update process

For every change:

1. Pull latest code.
2. Run:

```bash
bash deploy/setup-and-deploy.sh user@host
```

3. Verify /booking and login.

## 10. File map

1. Main deployment script: deploy/setup-and-deploy.sh
2. General deploy notes: deploy/DEPLOY.md
3. RHEL-specific notes: deploy/DEPLOY-REDHAT.md
4. Nginx snippet reference: deploy/nginx-booking.conf
5. Service template reference: deploy/testwallbooker.service
