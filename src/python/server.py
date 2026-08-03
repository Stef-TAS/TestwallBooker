"""Simple Testwall web API server.

Run:
    python server.py --host 0.0.0.0 --port 8080
"""

import argparse
import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from flask import Flask, jsonify, request

app = Flask(__name__)
DATA_FILE = Path(__file__).with_name("machines.json")
DATA_LOCK = threading.Lock()


def load_state() -> Dict[str, Dict[str, Any]]:
    """Load the latest machine state map from disk."""
    if not DATA_FILE.exists():
        return {}
    with DATA_FILE.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_state(state: Dict[str, Dict[str, Any]]) -> None:
    """Persist the machine state map to disk atomically."""
    temp_file = DATA_FILE.with_suffix(".tmp")
    with temp_file.open("w", encoding="utf-8") as handle:
        json.dump(state, handle, indent=2, sort_keys=True)
    temp_file.replace(DATA_FILE)


@app.get("/api/machines")
def get_machines():
    """Return the latest known state for all machines."""
    with DATA_LOCK:
        state = load_state()
    return jsonify({"machines": list(state.values()), "count": len(state)})


@app.post("/api/heartbeat")
def post_heartbeat():
    """Accept one machine heartbeat and update its latest stored state."""
    payload = request.get_json(silent=True) or {}
    required = ["name", "ip", "users", "testing"]
    missing = [field for field in required if field not in payload]
    if missing:
        return jsonify({"error": f"missing fields: {', '.join(missing)}"}), 400

    machine_name = str(payload["name"]).strip()
    ip = str(payload["ip"]).strip()
    users = payload["users"]
    testing = bool(payload["testing"])

    if not machine_name or not ip:
        return jsonify({"error": "name and ip must be non-empty"}), 400

    if not isinstance(users, list) or not all(isinstance(user, str) for user in users):
        return jsonify({"error": "users must be a list of strings"}), 400

    record = {
        "name": machine_name,
        "ip": ip,
        "users": users,
        "testing": testing,
        "last_update_utc": datetime.now(timezone.utc).isoformat(),
    }

    with DATA_LOCK:
        state = load_state()
        state[machine_name] = record
        save_state(state)

    return jsonify({"status": "ok", "machine": record})


def main() -> None:
    """Parse CLI args and start the web API process."""
    parser = argparse.ArgumentParser(description="Testwall machine status API")
    parser.add_argument("--host", default="0.0.0.0", help="Bind host")
    parser.add_argument("--port", type=int, default=8080, help="Bind port")
    args = parser.parse_args()
    app.run(host=args.host, port=args.port)


if __name__ == "__main__":
    main()
