"""Testwall heartbeat Windows service.

Install and manage:
    python service.py install    # install the service
    python service.py start      # start it
    python service.py stop       # stop it
    python service.py remove     # uninstall it

Configuration is read from service.cfg (next to this file):
    [service]
    name   = TTC2700
    server = http://c-l-twc-001/machines/
    interval = 5
"""

from __future__ import annotations

import configparser
import socket
import time
import logging
import logging.handlers
import servicemanager
import win32event
import win32service
import win32serviceutil
from pathlib import Path

import psutil
import requests

BASE_DIR = Path(__file__).parent
CONFIG_FILE = BASE_DIR / "service.cfg"
LOCK_FILE = Path(r"C:\Users\Public\Documents\lock.txt")

LOG_FILE = BASE_DIR / "service.log"


def _setup_logging() -> logging.Logger:
    logger = logging.getLogger("testwallbooker")
    logger.setLevel(logging.INFO)
    handler = logging.handlers.RotatingFileHandler(
        LOG_FILE, maxBytes=1_000_000, backupCount=3, encoding="utf-8"
    )
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(handler)
    return logger


def _load_config() -> tuple[str, str, int]:
    """Return (machine_name, server_url, interval_seconds)."""
    cfg = configparser.ConfigParser()
    cfg.read(CONFIG_FILE, encoding="utf-8")
    section = cfg["service"] if cfg.has_section("service") else {}
    name = section.get("name", socket.gethostname())
    server = section.get("server", "http://localhost:8080")
    interval = int(section.get("interval", "5"))
    return name, server, interval


def collect_machine_state(machine_name: str) -> dict[str, object]:
    ip = socket.gethostbyname(socket.gethostname())
    users = sorted({entry.name for entry in psutil.users() if entry.name})
    testing = LOCK_FILE.exists()
    return {"name": machine_name, "ip": ip, "users": users, "testing": testing}


def send_heartbeat(server_base_url: str, state: dict[str, object], timeout_seconds: int = 10) -> None:
    endpoint = server_base_url.rstrip("/") + "/api/heartbeat"
    response = requests.post(
        endpoint,
        json=state,
        timeout=timeout_seconds,
        proxies={"http": None, "https": None},
    )
    response.raise_for_status()


class TestwallHeartbeatService(win32serviceutil.ServiceFramework):
    _svc_name_ = "TestwallHeartbeat"
    _svc_display_name_ = "Testwall Heartbeat Service"
    _svc_description_ = "Periodically reports machine status to the Testwall Booker server."

    def __init__(self, args: list[str]) -> None:
        super().__init__(args)
        self._stop_event = win32event.CreateEvent(None, 0, 0, None)
        self._logger = _setup_logging()

    def SvcStop(self) -> None:
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self._stop_event)
        self._logger.info("Service stop requested")

    def SvcDoRun(self) -> None:
        servicemanager.LogMsg(
            servicemanager.EVENTLOG_INFORMATION_TYPE,
            servicemanager.PYS_SERVICE_STARTED,
            (self._svc_name_, ""),
        )
        self._logger.info("Service started")
        self._run()

    def _run(self) -> None:
        machine_name, server_url, interval = _load_config()
        self._logger.info(
            "Config: name=%s server=%s interval=%ds", machine_name, server_url, interval
        )

        interval_ms = interval * 1000

        while True:
            state = collect_machine_state(machine_name)
            try:
                send_heartbeat(server_url, state)
                self._logger.info("Heartbeat sent: %s", state)
            except requests.RequestException as exc:
                self._logger.warning("Heartbeat failed: %s", exc)

            # Wait for the interval or a stop signal, whichever comes first.
            result = win32event.WaitForSingleObject(self._stop_event, interval_ms)
            if result == win32event.WAIT_OBJECT_0:
                break

        self._logger.info("Service stopped")


if __name__ == "__main__":
    win32serviceutil.HandleCommandLine(TestwallHeartbeatService)
