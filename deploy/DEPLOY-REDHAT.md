# Deployment Guide for Red Hat Family

Applies to RHEL, Rocky Linux, AlmaLinux, and CentOS Stream.

## Current deployment model

1. Deploy from a Windows laptop (PowerShell + bash).
2. Target server can be offline from external repos.
3. App files and Linux node_modules are prepared locally and transferred.
4. Nginx serves /booking and proxies API to localhost:3001.

## Use this command

```bash
bash deploy/setup-and-deploy.sh user@host
```

## Server prerequisites

The script validates these binaries on the server:

1. node
2. python3 (with venv module)
3. nginx
4. systemctl
5. tar
6. curl

If the server is fully offline, install these once using your internal package mirror or offline RPM process.

## SELinux requirements

To allow Nginx -> backend proxying:

```bash
sudo setsebool -P httpd_can_network_connect 1
```

To restore static content labels if needed:

```bash
sudo restorecon -Rv /usr/share/nginx/html/booking/
```

## Firewall requirements

Only port 80 needs to be open externally.

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload
```

## Database setup

```sql
CREATE DATABASE IF NOT EXISTS testwallbooker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'testwallbooker'@'localhost' IDENTIFIED BY '<strong_password>';
GRANT ALL PRIVILEGES ON testwallbooker.* TO 'testwallbooker'@'localhost';
FLUSH PRIVILEGES;
```

## Required production env file

Create /opt/testwallbooker/.env:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=testwallbooker
DB_PASSWORD=<strong_password_here>
DB_NAME=testwallbooker
SERVER_PORT=3001
NODE_ENV=production
```

## Common problems

### 1) 502 from /api/* and login JSON parse errors

Cause:
backend service is down, so Nginx returns HTML 502 page.

Checks:

```bash
systemctl status testwallbooker --no-pager -l
journalctl -u testwallbooker -n 120 --no-pager
curl http://127.0.0.1:3001/api/testwalls
```

### 2) Service startup error with status=209/STDOUT

Cause:
bad systemd stdout/stderr file append configuration.

Fix:

1. Use the current script version (does not configure StandardOutput append).
2. Reload service unit:

```bash
sudo systemctl daemon-reload
sudo systemctl restart testwallbooker
```

### 3) Service startup fails with esbuild EACCES

Cause:
missing executable bits in transferred node_modules binaries.

Fix:

```bash
sudo chmod 755 /opt/testwallbooker/node_modules/.bin/* || true
sudo find /opt/testwallbooker/node_modules -type f -path '*/bin/*' -exec chmod 755 {} +
sudo systemctl restart testwallbooker
```

## Verification checklist

```bash
curl -I http://127.0.0.1/booking/
curl -I http://127.0.0.1/api/testwalls
systemctl is-active testwallbooker
```

Expected results:

1. /booking returns 200.
2. /api/testwalls returns 200.
3. testwallbooker service is active.
