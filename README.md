# TestwallBooker

TestwallBooker is an internal booking and access platform for shared Testwall infrastructure. It gives teams one place to see which testwalls are available, reserve time slots, control who can book/use systems, and review booking and activity history.

## Purpose

The project exists to solve a coordination problem across engineering teams:

1. Avoid testwall reservation conflicts.
2. Make real-time availability visible to everyone.
3. Control usage by role (admin, operator, user).
4. Keep an audit trail of bookings and actions.

## What The Application Does

1. Shows a live overview of testwall availability.
2. Allows booking creation, conflict checks, updates, and termination.
3. Supports user authentication and role-aware access.
4. Stores accounts, access rights, testwalls, bookings, logs, and command history in MySQL.
5. Exposes REST APIs under /api/* for frontend and integrations.
6. Runs a Python sidecar process for testwall-related backend functionality.

Passwords are stored as bcrypt hashes (configurable with BCRYPT_ROUNDS, default 12).

## Where It Lives

1. Project/repository name: TestwallBooker
2. Main codebase directories:
   - src/ (Vue frontend)
   - server/ (Express + MySQL backend)
   - src/python/ (Python sidecar)
   - deploy/ (deployment scripts and operations docs)

If you are copying this into Confluence, add your internal Git URL in this section.

## High-Level Architecture

1. Frontend: Vue 3 + Vite + PrimeVue
2. Backend: Node.js + Express + TypeScript (tsx runtime)
3. Database: MySQL/MariaDB
4. Sidecar: Python process started by backend at runtime
5. Production routing: Nginx serves the SPA at / and proxies /api to backend

## Main API Areas

1. /api/auth
2. /api/accounts
3. /api/access-rights
4. /api/testwalls
5. /api/bookings
6. /api/history
7. /api/logs

## Local Development Setup

### Prerequisites

1. Node.js and npm
2. MySQL or MariaDB running locally
3. Python 3 available in PATH

### 1) Install dependencies

```sh
npm install
```

### 2) Configure local environment

Create a .env file in the repository root:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=testwallbooker
SERVER_PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
PYTHON_CMD=python3
PYTHON_STATUS_URL=http://127.0.0.1:8080/api/machines
SMTP_HOST=smtp.your-company.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=no-reply@testwallbooker.local
TESTWALL_MCP_TRANSPORT=
TESTWALL_MCP_COMMAND=
TESTWALL_MCP_ARGS=[]
TESTWALL_MCP_CWD=
TESTWALL_MCP_ENV={}
TESTWALL_MCP_URL=
TESTWALL_MCP_HEADERS={}
```

Notes:

1. The backend auto-creates required tables on startup.
2. The database itself must exist beforehand.
3. Booking confirmation emails are sent only when SMTP_HOST and EMAIL_FROM are configured.
4. The Agent page uses the Testwall MCP server when `TESTWALL_MCP_TRANSPORT` is configured.
5. For a local stdio MCP server, set `TESTWALL_MCP_TRANSPORT=stdio`, `TESTWALL_MCP_COMMAND` to the server executable, and `TESTWALL_MCP_ARGS` to a JSON array of arguments.
6. For a remote Streamable HTTP MCP server, set `TESTWALL_MCP_TRANSPORT=streamable-http` and `TESTWALL_MCP_URL` to the MCP endpoint.
7. If production shows `spawn uvx ENOENT`, set an absolute command path in `.env` (for example `TESTWALL_MCP_COMMAND=/usr/local/bin/uvx` or `TESTWALL_MCP_COMMAND=/usr/local/bin/uv` with corresponding args) so systemd does not depend on shell PATH.

### 3) Create local database

```sql
CREATE DATABASE IF NOT EXISTS testwallbooker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4) Start backend and frontend

Shell 1:

```sh
npm run server
```

Shell 2:

```sh
npm run dev
```

### 5) Open locally

1. Frontend: http://localhost:5173/
2. Backend health check example: http://localhost:3001/api/testwalls

## First Account Setup

Use one of the following approaches to create your first admin account.

### Option A: UI registration, then assign admin role in SQL

1. Start backend and frontend.
2. Register an account from the login page.
3. Open MySQL and run:

```sql
USE testwallbooker;

SELECT id INTO @user_id FROM accounts WHERE email = 'your.email@company.com' LIMIT 1;
SELECT id INTO @admin_role_id FROM access_rights WHERE role_name = 'admin' LIMIT 1;

INSERT IGNORE INTO user_access_rights (user_id, access_right_id)
VALUES (@user_id, @admin_role_id);
```

4. Log out and log back in so the new role is reflected in the UI.

### Option B: Direct SQL bootstrap (account + admin role)

1. Generate a bcrypt hash for your chosen password:

```sh
node -e "import bcrypt from 'bcryptjs'; bcrypt.hash('ChangeMe123!', 12).then(h => console.log(h))"
```

2. Use the printed hash in MySQL:

```sql
USE testwallbooker;

INSERT INTO accounts (username, email, password_hash, first_name, last_name)
VALUES ('admin', 'admin@company.com', '$2b$12$REPLACE_WITH_GENERATED_HASH', 'Admin', 'User');

SELECT id INTO @admin_user_id FROM accounts WHERE email = 'admin@company.com' LIMIT 1;
SELECT id INTO @admin_role_id FROM access_rights WHERE role_name = 'admin' LIMIT 1;

INSERT IGNORE INTO user_access_rights (user_id, access_right_id)
VALUES (@admin_user_id, @admin_role_id);
```

If you already have legacy plaintext passwords in the DB, successful login will automatically upgrade that account to bcrypt.

## Useful Commands

```sh
npm run dev
npm run server
npm run build
npm run type-check
npm run lint
```

## Troubleshooting Local Database Access

If the app works on server but not locally, check these first:

1. Verify backend is running and not exiting with DB init errors.
2. Confirm local .env values point to your local DB, not server credentials.
3. Confirm DB_NAME exists locally (testwallbooker by default).
4. Confirm DB_USER/DB_PASSWORD are valid for local MySQL.
5. Confirm MySQL is listening on the configured host/port.

Quick verification:

```sh
mysql -h localhost -P 3306 -u root -p
```

Then run:

```sql
USE testwallbooker;
SHOW TABLES;
```

If this works but backend still fails, restart backend and inspect startup logs from npm run server.

## Deployment Documentation

1. Primary setup and maintenance guide: deploy/TESTWALL-SETUP.md
2. General deployment workflow: deploy/DEPLOY.md
3. Red Hat specific deployment guide: deploy/DEPLOY-REDHAT.md
4. Production server from-scratch setup guide: deploy/SETUP-FROM-SCRATCH.md

## Actual Production Setup Flow (Current)

Use `deploy/setup-and-deploy.sh` as the source of truth for real deployments.

Run from repository root on your developer machine:

```bash
bash deploy/setup-and-deploy.sh user@host
```

What this script actually does today:

1. Validates SSH and sudo access.
2. Builds frontend and syncs static files to `/usr/share/nginx/html`.
3. Syncs backend app into `/opt/testwallbooker`.
4. Prepares offline Linux Node dependencies locally and copies them to the server.
5. Prepares Python wheels (offline when possible), creates `/opt/testwallbooker/.venv`, and installs `src/python/requirements.txt`.
6. Writes Nginx vhost config to `/etc/nginx/conf.d/00-testwallbooker.conf`.
7. Writes and restarts systemd service `testwallbooker`.
8. Runs health checks against `/` and `/api/testwalls`.

Important runtime behavior:

1. The Node backend service starts via `npm start` (systemd unit).
2. On backend startup, `server/index.ts` spawns `src/python/server.py` using `PYTHON_CMD`.
3. In production deploys, `PYTHON_CMD` is set to `/opt/testwallbooker/.venv/bin/python3` by the deployment script.
4. The backend reads live machine state from `PYTHON_STATUS_URL` (default `http://127.0.0.1:8080/api/machines`).

## Actual Python Script For Testwall Machines

The script that should run on each Windows testwall machine is:

1. `src/python/testwall_client.py`

This is the unified heartbeat client and Windows service entrypoint. It sends machine state to the Python status server endpoint:

1. `POST <server>/api/heartbeat`

Configuration file on each testwall machine:

1. `src/python/service.cfg`

Required Python packages for each testwall machine:

1. `src/python/requirements-service.txt`

Typical setup on each testwall machine:

```powershell
pip install -r src/python/requirements-service.txt
python src/python/testwall_client.py install
python src/python/testwall_client.py start
```

Quick one-shot heartbeat test:

```powershell
python src/python/testwall_client.py run --once
```

Notes:

1. `src/python/client.py` is only a compatibility wrapper that forwards to `testwall_client.py`.
2. `src/python/testwall_heartbeat_service.py` is legacy and not the active service entrypoint in the current flow.
3. A testwall is considered live only when the backend sees fresh machine updates at `PYTHON_STATUS_URL`.

## Summary For Internal Consumers

TestwallBooker is the internal source of truth for testwall availability, reservations, and access control. It reduces booking collisions, standardizes operations, and provides traceability for who used what and when.
