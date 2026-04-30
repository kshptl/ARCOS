"""Structured logger wrapper."""

import json
import logging

from openarcos_pipeline.log import get_logger


def test_logger_returns_logger():
    log = get_logger("test")
    assert isinstance(log, logging.Logger)


def test_logger_idempotent():
    a = get_logger("test")
    b = get_logger("test")
    assert a is b


def test_logger_json_mode_in_ci(monkeypatch, capsys):
    monkeypatch.setenv("OPENARCOS_ENV", "ci")
    log = get_logger("test.ci")
    log.info("hello", extra={"source": "wapo"})
    captured = capsys.readouterr()
    # CI mode writes a JSON line
    payload = json.loads(captured.err.strip().splitlines()[-1])
    assert payload["msg"] == "hello"
    assert payload["source"] == "wapo"
