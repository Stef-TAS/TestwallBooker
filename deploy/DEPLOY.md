# Deployment Guide — c-l-twc-001

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  c-l-twc-001                                                    │
│                                                                 │
│  Nginx (:80)                                                    │
│  ├── /booking/        → static files                           │
│  │                       /usr/share/nginx/html/booking/        │
│  │                       (Vite dist/ output)                   │
│  └── /booking/api/*   → proxy_pass → localhost:3001/api/*      │
│                                                                 │
│  Node.js / tsx  (:3001)                                         │
│  ├── GET  /api/testwalls                                        │
│  ├── POST /api/bookings                                         │
│  ├── ...  (all existing /api/* routes unchanged)               │
│  └── connects to MySQL (already running)                        │
│                                                                 │
│  MySQL (already running — phpMyAdmin available)                 │
└─────────────────────────────────────────────────────────────────┘
```

## Folder layout on the server

```
/usr/share/nginx/html/
├── index.html
├── tw_api/html/
│   ├── testwall-docs/
│   ├── testwall-gui/
│   └── spy2/testwall-spy/
├── booking/                    ← NEW (Vite dist output)
│   ├── index.html
│   └── assets/
└── test_1/

/opt/testwallbooker/            ← NEW (Node.js backend)
├── server/
├── src/python/
├── package.json
├── package-lock.json
└── .env                        ← production secrets (not in git)
```

---

## One-time server setup (do this once, as root)

### 1. Create MySQL database and user

```sql
-- Run in phpMyAdmin or mysql CLI
CREATE DATABASE IF NOT EXISTS testwallbooker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'testwallbooker'@'localhost' IDENTIFIED BY '<strong_password>';
GRANT ALL PRIVILEGES ON testwallbooker.* TO 'testwallbooker'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Install Node.js (v20 LTS recommended)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. Install Python 3 + dependencies (for the Python sub-process)

```bash
sudo apt-get install -y python3 python3-pip
# After deploying the backend files:
pip3 install -r /opt/testwallbooker/src/python/requirements.txt
```

### 4. Create the backend environment file

```bash
sudo mkdir -p /opt/testwallbooker
sudo cp /path/to/deploy/.env.production.example /opt/testwallbooker/.env
sudo nano /opt/testwallbooker/.env   # fill in real values
sudo chmod 600 /opt/testwallbooker/.env
```

### 5. Install the systemd service

```bash
sudo cp /path/to/deploy/testwallbooker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable testwallbooker
```

### 6. Add Nginx location blocks

Edit the active Nginx server block (usually `/etc/nginx/sites-available/default`
or `/etc/nginx/conf.d/default.conf`) and paste the contents of
`deploy/nginx-booking.conf` **inside the `server { }` block**.

```bash
sudo nano /etc/nginx/sites-available/default
# paste contents of deploy/nginx-booking.conf inside server { ... }

sudo nginx -t          # verify config
sudo systemctl reload nginx
```

---

## Deploying updates

From your **developer machine** (after `git pull` / changes):

```bash
bash deploy/deploy.sh your_user@c-l-twc-001
```

This script:

1. Builds the Vite frontend (`npm run build`)
2. Rsyncs `dist/` → `/usr/share/nginx/html/booking/` on the server
3. Rsyncs the `server/` and `src/python/` directories to `/opt/testwallbooker/`
4. Runs `npm ci --omit=dev` on the server
5. Restarts the systemd service

---

## Starting / stopping the backend manually

```bash
sudo systemctl start   testwallbooker
sudo systemctl stop    testwallbooker
sudo systemctl restart testwallbooker
sudo systemctl status  testwallbooker
journalctl -u testwallbooker -f   # live logs
```

---

## Verification

```bash
curl http://c-l-twc-001/booking/           # should return index.html
curl http://c-l-twc-001/booking/api/testwalls  # should return JSON
```
