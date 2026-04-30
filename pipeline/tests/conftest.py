"""Shared pytest configuration."""

from pathlib import Path

import pytest


@pytest.fixture
def fixtures_dir() -> Path:
    return Path(__file__).parent / "fixtures"


@pytest.fixture
def snapshots_dir() -> Path:
    return Path(__file__).parent / "snapshots"


@pytest.fixture(scope="session")
def agg_master_parquet(tmp_path_factory):
    """Session-scoped fixture: builds master.parquet from tiny Phase 7 inputs.

    Reused by every Phase 8 aggregate test so we don't rebuild it per-test.
    """
    import polars as pl

    from openarcos_pipeline.config import Config
    from openarcos_pipeline.join import build_master

    root = tmp_path_factory.mktemp("agg_master")
    cfg = Config(data_root=root / "data", emit_dir=root / "emit")
    cfg.ensure_dirs()

    # Reuse the toy world from test_join.py verbatim
    pl.DataFrame(
        {
            "fips": ["54059", "51720", "21119"],
            "name": ["Mingo County", "Norton city", "Knott County"],
            "state": ["WV", "VA", "KY"],
            "pop": [25764, 3892, 16232],
        }
    ).write_parquet(cfg.clean_dir / "county_metadata.parquet")

    pl.DataFrame(
        {
            "fips": ["54059", "54059", "54059", "21119", "21119", "21119"],
            "year": [2011, 2012, 2013, 2011, 2012, 2013],
            "pills": [4_000_000.0, 6_000_000.0, 5_000_000.0, 1_500_000.0, 2_100_000.0, 1_900_000.0],
        }
    ).write_parquet(cfg.clean_dir / "wapo_county.parquet")

    pl.DataFrame(
        {
            "fips": ["54059", "54059", "54059", "21119", "21119", "21119"],
            "year": [2011, 2012, 2013, 2011, 2012, 2013],
            "deaths": [42, 55, 61, None, None, None],
            "suppressed": [False, False, False, True, True, True],
        }
    ).write_parquet(cfg.clean_dir / "cdc_overdose.parquet")

    # Toy distributor data (WaPo-shaped)
    pl.DataFrame(
        {
            "distributor": [
                "McKesson",
                "Cardinal",
                "AmerisourceBergen",
                "McKesson",
                "Cardinal",
                "AmerisourceBergen",
            ],
            "year": [2011, 2011, 2011, 2012, 2012, 2012],
            "pills": [3_200_000.0, 1_800_000.0, 900_000.0, 4_500_000.0, 2_200_000.0, 1_300_000.0],
        }
    ).write_parquet(cfg.clean_dir / "wapo_distributors.parquet")

    # Toy pharmacy data
    pl.DataFrame(
        {
            "pharmacy_id": ["DEA-AB1234567", "DEA-CD9876543", "DEA-EF1122334"],
            "name": ["SAV-RITE PHARMACY", "TUG VALLEY PHARMACY", "NORTON APOTHECARY"],
            "address": ["100 MAIN ST", "234 APPALACHIAN DR", "17 PARK AVE"],
            "fips": ["54059", "54059", "51720"],
            "total_pills": [12_500_000.0, 8_800_000.0, 450_000.0],
        }
    ).write_parquet(cfg.clean_dir / "wapo_pharmacies.parquet")

    # Toy DEA enforcement data (already in emit-ready shape)
    pl.DataFrame(
        {
            "year": [2011, 2012, 2013],
            "action_count": [1203, 1428, 1109],
            "notable_actions": [
                [
                    {
                        "title": "United States v. Cardinal Health",
                        "url": "https://example.org/1",
                        "target": None,
                    }
                ],
                [
                    {
                        "title": "Operation Pill Nation",
                        "url": "https://example.org/2",
                        "target": None,
                    }
                ],
                [],
            ],
        }
    ).write_parquet(cfg.clean_dir / "dea_enforcement.parquet")

    build_master(cfg, years=range(2011, 2014))
    return cfg  # tests use cfg.clean_dir and cfg.joined_dir
