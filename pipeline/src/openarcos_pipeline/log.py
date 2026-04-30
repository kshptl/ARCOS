"""Logging: plain format locally, JSON in CI."""

from __future__ import annotations

import json
import logging
import os
import sys
from typing import Any

_STD_LOGRECORD_ATTRS = {
    "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
    "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
    "created", "msecs", "relativeCreated", "thread", "threadName",
    "processName", "process", "taskName",
}


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        for k, v in record.__dict__.items():
            if k not in _STD_LOGRECORD_ATTRS and not k.startswith("_"):
                payload[k] = v
        return json.dumps(payload)


def get_logger(name: str) -> logging.Logger:
    log = logging.getLogger(name)
    if getattr(log, "_openarcos_configured", False):
        return log

    log.setLevel(logging.INFO)
    handler = logging.StreamHandler(stream=sys.stderr)
    if os.environ.get("OPENARCOS_ENV") == "ci":
        handler.setFormatter(_JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
        )
    log.addHandler(handler)
    log.propagate = False
    log._openarcos_configured = True  # type: ignore[attr-defined]
    return log
