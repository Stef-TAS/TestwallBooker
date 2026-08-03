
"""Simple Testwall web API client.

Run on each Windows machine:
    python client.py --name TW-01 --server http://your-server:8080
"""

from __future__ import annotations

import argparse
import socket
import time
from pathlib import Path

import psutil
import requests

LOCK_FILE = Path(r"C:\Users\Public\Documents\lock.txt")


def collect_machine_state(machine_name: str) -> dict[str, object]:
    """Collect one machine snapshot for heartbeat transmission."""
    ip = socket.gethostbyname(socket.gethostname())
    users = sorted({entry.name for entry in psutil.users() if entry.name})
    testing = LOCK_FILE.exists()
    return {"name": machine_name, "ip": ip, "users": users, "testing": testing}


def send_heartbeat(server_base_url: str, state: dict[str, object], timeout_seconds: int = 10) -> None:
    """Send one snapshot to the server heartbeat endpoint."""
    endpoint = server_base_url.rstrip("/") + "/api/heartbeat"
    response = requests.post(endpoint, json=state, timeout=timeout_seconds)
    response.raise_for_status()


def main() -> None:
    """Read CLI args and periodically publish machine snapshots."""
    parser = argparse.ArgumentParser(description="Testwall status heartbeat client")
    parser.add_argument("--name", required=True, help="Machine name shown in server output")
    parser.add_argument("--server", required=True, help="Server base URL, e.g. http://server:8080")
    parser.add_argument("--interval", type=int, default=5, help="Heartbeat interval in seconds")
    args = parser.parse_args()

    while True:
        state = collect_machine_state(args.name)
        try:
            send_heartbeat(args.server, state)
            print(f"sent heartbeat: {state}")
        except requests.RequestException as error:
            print(f"heartbeat failed: {error}")
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
