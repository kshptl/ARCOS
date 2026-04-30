"""Shared pytest configuration."""

from pathlib import Path

import pytest


@pytest.fixture
def fixtures_dir() -> Path:
    return Path(__file__).parent / "fixtures"


@pytest.fixture
def snapshots_dir() -> Path:
    return Path(__file__).parent / "snapshots"
