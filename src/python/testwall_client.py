"""Unified Testwall heartbeat client.

Use this script on each Windows testwall machine.

Foreground usage:
    python testwall_client.py run --name TW-01 --server http://server:8080
    python testwall_client.py run --once

Windows service management:
    python testwall_client.py install
    python testwall_client.py start
    python testwall_client.py stop
    python testwall_client.py remove

If name/server/interval are omitted in foreground mode, values are read from service.cfg.
The Windows service also reads service.cfg and runs without any interactive user session.
"""

import argparse
import configparser
import logging
import logging.handlers
import socket
import sys
import time
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple

import requests
from machine_state import collect_machine_state

BASE_DIR = Path(__file__).parent
CONFIG_FILE = BASE_DIR / 'service.cfg'
LOCK_FILE = Path(r'C:\Users\Public\Documents\lock.txt')
LOG_FILE = BASE_DIR / 'service.log'
DEFAULT_SERVER = 'http://localhost:8080'
DEFAULT_INTERVAL_SECONDS = 5
SERVICE_COMMANDS = {'install', 'update', 'remove', 'start', 'stop', 'restart', 'debug'}


def setup_logging() -> logging.Logger:
    logger = logging.getLogger('testwallbooker')
    if logger.handlers:
        return logger

    logger.setLevel(logging.INFO)
    handler = logging.handlers.RotatingFileHandler(
        str(LOG_FILE), maxBytes=1_000_000, backupCount=3, encoding='utf-8'
    )
    handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s %(message)s'))
    logger.addHandler(handler)
    return logger


def load_config(config_path: Path = CONFIG_FILE) -> Tuple[str, str, int]:
    cfg = configparser.ConfigParser()
    cfg.read(str(config_path), encoding='utf-8')
    section = cfg['service'] if cfg.has_section('service') else {}

    name = section.get('name', socket.gethostname())
    server = section.get('server', DEFAULT_SERVER)
    interval = int(section.get('interval', str(DEFAULT_INTERVAL_SECONDS)))
    return name, server, interval


def send_heartbeat(
    server_base_url: str, state: Dict[str, object], timeout_seconds: int = 10
) -> None:
    endpoint = server_base_url.rstrip('/') + '/api/heartbeat'
    response = requests.post(
        endpoint,
        json=state,
        timeout=timeout_seconds,
        proxies={'http': None, 'https': None},
    )
    response.raise_for_status()


def run_heartbeat_loop(
    machine_name: str,
    server_url: str,
    interval_seconds: int,
    logger: Optional[logging.Logger] = None,
    stop_requested: Optional[Callable[[], bool]] = None,
    run_once: bool = False,
) -> None:
    while True:
      state = collect_machine_state(machine_name, LOCK_FILE)
      try:
          send_heartbeat(server_url, state)
          if logger:
              logger.info('Heartbeat sent: %s', state)
          else:
              print('sent heartbeat: {0}'.format(state))
      except requests.RequestException as error:
          if logger:
              logger.warning('Heartbeat failed: %s', error)
          else:
              print('heartbeat failed: {0}'.format(error))

      if run_once:
          return

      if stop_requested is not None and stop_requested():
          return

      time.sleep(interval_seconds)


def run_foreground(args: argparse.Namespace) -> None:
    config_name, config_server, config_interval = load_config(args.config)
    machine_name = args.name or config_name
    server_url = args.server or config_server
    interval_seconds = args.interval if args.interval is not None else config_interval
    run_heartbeat_loop(machine_name, server_url, interval_seconds, run_once=args.once)


def build_foreground_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='Run the Testwall heartbeat client')
    parser.add_argument('run', nargs='?', default='run', help=argparse.SUPPRESS)
    parser.add_argument('--name', help='Machine name shown in server output')
    parser.add_argument('--server', help='Server base URL, e.g. http://server:8080')
    parser.add_argument('--interval', type=int, help='Heartbeat interval in seconds')
    parser.add_argument('--once', action='store_true', help='Send a single heartbeat and exit')
    parser.add_argument(
        '--config',
        type=Path,
        default=CONFIG_FILE,
        help='Path to service.cfg for default name/server/interval values',
    )
    return parser


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1].lower() in SERVICE_COMMANDS:
        from testwall_service_runtime import handle_service_cli

        handle_service_cli()
        return

    parser = build_foreground_parser()
    args = parser.parse_args()
    run_foreground(args)


if __name__ == '__main__':
    main()