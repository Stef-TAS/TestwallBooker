import os
import re
import socket
import subprocess
from pathlib import Path
from typing import Dict, List, Set

import psutil

SESSION_LINE_PATTERN = re.compile(
    r'^\s*>?(?P<username>\S+)\s+(?:(?P<sessionname>\S+)\s+)?(?P<session_id>\d+)\s+(?P<state>[A-Za-z]+)\b'
)


def get_active_machine_users() -> List[str]:
    if os.name != 'nt':
        return _get_psutil_users()

    try:
        result = subprocess.run(
            ['quser'],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='ignore',
            timeout=5,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return _get_psutil_users()

    if result.returncode != 0 or not result.stdout.strip():
        return _get_psutil_users()

    users = set()  # type: Set[str]

    for line in result.stdout.splitlines()[1:]:
        match = SESSION_LINE_PATTERN.match(line)
        if not match:
            continue

        if match.group('state').strip().lower() != 'active':
            continue

        username = match.group('username').lstrip('>').strip()
        if username:
            users.add(username)

    return sorted(users)


def collect_machine_state(machine_name: str, lock_file: Path) -> Dict[str, object]:
    ip = socket.gethostbyname(socket.gethostname())
    users = get_active_machine_users()
    testing = lock_file.exists()
    return {'name': machine_name, 'ip': ip, 'users': users, 'testing': testing}


def _get_psutil_users() -> List[str]:
    return sorted({entry.name for entry in psutil.users() if entry.name})