import logging
import servicemanager
import win32event
import win32service
import win32serviceutil
from typing import List

from testwall_client import load_config, run_heartbeat_loop, setup_logging


class TestwallHeartbeatService(win32serviceutil.ServiceFramework):
    _svc_name_ = 'TestwallHeartbeat'
    _svc_display_name_ = 'Testwall Heartbeat Service'
    _svc_description_ = 'Periodically reports machine status to the Testwall Booker server.'

    def __init__(self, args: List[str]) -> None:
        win32serviceutil.ServiceFramework.__init__(self, args)
        self._stop_event = win32event.CreateEvent(None, 0, 0, None)
        self._logger = setup_logging()

    def SvcStop(self) -> None:
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self._stop_event)
        self._logger.info('Service stop requested')

    def SvcDoRun(self) -> None:
        servicemanager.LogMsg(
            servicemanager.EVENTLOG_INFORMATION_TYPE,
            servicemanager.PYS_SERVICE_STARTED,
            (self._svc_name_, ''),
        )
        self._logger.info('Service started')
        self._run()

    def _run(self) -> None:
        machine_name, server_url, interval = load_config()
        self._logger.info(
            'Config: name=%s server=%s interval=%ds', machine_name, server_url, interval
        )

        def stop_requested() -> bool:
            return win32event.WaitForSingleObject(self._stop_event, interval * 1000) == win32event.WAIT_OBJECT_0

        run_heartbeat_loop(
            machine_name,
            server_url,
            interval,
            logger=self._logger,
            stop_requested=stop_requested,
        )
        self._logger.info('Service stopped')


def handle_service_cli() -> None:
    setup_logging()
    win32serviceutil.HandleCommandLine(TestwallHeartbeatService)