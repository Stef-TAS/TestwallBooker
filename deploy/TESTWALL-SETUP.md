# Setting Up and Maintaining the Test Wall Facility

This is the single setup guide for the full TestwallBooker environment. It covers the production server, each Windows testwall machine, the files involved, the order they should be run in, and how to push updates after the system is live.

## What gets deployed

1. Web app and API on the Linux server.
2. MySQL/MariaDB database on the server.
3. Nginx reverse proxy and static booking site on the server.
4. Windows heartbeat service on each testwall machine.
5. Python status service used by the backend to display live machine-user information.

## Files you need to know

Server-side files:

1. [deploy/setup-and-deploy.sh](setup-and-deploy.sh) - main deployment script.
2. [deploy/DEPLOY.md](DEPLOY.md) - runtime/deployment notes.
3. [deploy/DEPLOY-REDHAT.md](DEPLOY-REDHAT.md) - Red Hat specific notes.
4. [deploy/SETUP-FROM-SCRATCH.md](SETUP-FROM-SCRATCH.md) - server provisioning from zero.
5. [deploy/.env.production.example](.env.production.example) - production environment template.
6. [deploy/nginx-booking.conf](nginx-booking.conf) - Nginx proxy/static configuration reference.
7. [deploy/testwallbooker.service](testwallbooker.service) - systemd service template.

Testwall machine files:

1. [src/python/testwall_client.py](../src/python/testwall_client.py) - unified heartbeat client and Windows service entry point.
2. [src/python/service.cfg](../src/python/service.cfg) - per-machine configuration.
3. [src/python/requirements-service.txt](../src/python/requirements-service.txt) - Python packages for the heartbeat service.
4. [src/python/client.py](../src/python/client.py) - compatibility wrapper for older standalone-client usage.
5. [src/python/server.py](../src/python/server.py) - Python status server used by the Node backend when enabled.

## Order of setup

Do the work in this order so the environment comes up cleanly:

1. Prepare the Linux server.
2. Create the database and production `.env` file.
3. Deploy the web app and API to the server.
4. Verify the server responds on `/` and `/api/*`.
5. Prepare each Windows testwall machine.
6. Install and configure the heartbeat service on each testwall.
7. Verify each testwall appears in the app.

## 1) Set up the server

Use [deploy/SETUP-FROM-SCRATCH.md](SETUP-FROM-SCRATCH.md) for the full server buildout if you are starting from nothing.

Minimum server requirements:

1. node
2. npm
3. python3 with venv support
4. nginx
5. systemd
6. tar
7. curl
8. mysql or mariadb

Server database setup:

```sql
CREATE DATABASE IF NOT EXISTS testwallbooker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'testwallbooker'@'localhost' IDENTIFIED BY '<strong_password>';
GRANT ALL PRIVILEGES ON testwallbooker.* TO 'testwallbooker'@'localhost';
FLUSH PRIVILEGES;
```

Create `/opt/testwallbooker/.env` from [deploy/.env.production.example](.env.production.example):

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

## 2) Deploy the server application

From the repository root on your Windows machine:

```bash
bash deploy/setup-and-deploy.sh user@host
```

That script handles:

1. SSH and sudo validation.
2. Frontend build or reuse of `dist/`.
3. Backend and static file sync.
4. Offline Linux dependency transfer.
5. Nginx config updates.
6. systemd restart and health checks.

Verify the server after deploy:

```bash
systemctl status testwallbooker --no-pager -l
journalctl -u testwallbooker -n 120 --no-pager
curl -I http://127.0.0.1/
curl -I http://127.0.0.1/api/testwalls
```

## 3) Set up each Windows testwall machine

Repeat this section for every physical testwall.

Do these steps on the Windows testwall itself, not on the Linux server:

1. Confirm the machine can reach the TestwallBooker server URL you plan to use.
2. Make sure Python 3 is installed on the machine.
3. Open a terminal in the `src/python` folder on that machine.

Install Python dependencies on the testwall machine:

```powershell
pip install -r src/python/requirements-service.txt
```

Edit [src/python/service.cfg](../src/python/service.cfg) for that specific machine:

```ini
[service]
name = TTC2700
server = http://c-l-twc-001:8080
interval = 5
```

Use the values like this:

1. `name` must match the exact testwall name you want shown in the UI.
2. `server` must point to the machine running [src/python/server.py](../src/python/server.py).
3. `interval` controls how often the heartbeat is sent.

At this point, the testwall is configured. The service will then:

1. Read `service.cfg` from the same folder.
2. Collect the machine name, IP address, logged-in users, and testing flag.
3. Send that state to `server` every `interval` seconds from a background Windows service, without requiring a user to stay logged in.

Install the Windows service from the `src/python` folder:

```powershell
python testwall_client.py install
```

Start the service:

```powershell
python testwall_client.py start
```

To stop it later:

```powershell
python testwall_client.py stop
```

To remove it completely:

```powershell
python testwall_client.py remove
```

Verify the testwall is online in the app and that the machine is posting heartbeats.

If you want to test the heartbeat sender without installing the service first, run:

```powershell
python testwall_client.py run --once
```

Or watch the service log file next to `testwall_client.py`.

If the machine should show a testing state, create this file on that machine:

```text
C:\Users\Public\Documents\lock.txt
```

## 4) How the pieces run

Run the components on these devices:

1. Windows development machine: clone the repository, edit files, and run deployment scripts.
2. Linux production server: hosts Nginx, the Node backend, MySQL/MariaDB, and the Python status endpoint used by the backend.
3. Windows testwall machines: run the heartbeat Windows service one per machine.

Execution order in normal operation:

1. Start the Linux server services.
2. Start the Windows heartbeat service on each testwall.
3. Open the booking site and verify the live overview.

## 5) Maintaining and updating the system

When you push a new update, follow this order:

1. Pull the latest code on your Windows machine.
2. Review any changes to [src/python/service.cfg](../src/python/service.cfg), [src/python/testwall_client.py](../src/python/testwall_client.py), and the deployment files under `deploy/`.
3. Run the deployment script again:

```bash
bash deploy/setup-and-deploy.sh user@host
```

4. Restart or re-run the Windows heartbeat service if you changed the testwall machine config or Python service code.
5. Verify the server endpoints and booking UI.

If you changed only frontend or backend code, a normal deploy is usually enough.

If you changed the Windows heartbeat service or its config, update each affected testwall machine separately.

## Troubleshooting

If login returns an HTML error page instead of JSON, the backend or proxy is down.

If the service crashes with `status=209/STDOUT`, use the current deployment script and restart the service.

If Linux binaries lose execute bits, reapply permissions in `node_modules` and restart the server service.

If a testwall does not appear online, check its `service.cfg`, the Windows service log, and whether the machine can reach `PYTHON_STATUS_URL`.
