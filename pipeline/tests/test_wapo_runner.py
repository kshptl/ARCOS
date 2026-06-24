"""WaPo runner: iterates counties, writes to data/raw/wapo/."""

import csv
import gzip
import json
from pathlib import Path

import httpx
import polars as pl

from openarcos_pipeline.config import Config
from openarcos_pipeline.sources.wapo_arcos import WapoClient
from openarcos_pipeline.sources.wapo_runner import fetch_state, stream_wapo_mme_county_year

FIXTURES = Path(__file__).parent / "fixtures" / "wapo"


def mock_transport() -> httpx.MockTransport:
    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path == "/v1/county_list":
            # Match the real WaPo /v1/county_list shape (uppercase BUYER_* keys).
            return httpx.Response(
                200,
                json=[
                    {"BUYER_STATE": "WV", "BUYER_COUNTY": "MINGO", "countyfips": "54059"},
                    {"BUYER_STATE": "WV", "BUYER_COUNTY": "CABELL", "countyfips": "54011"},
                ],
            )
        if req.url.path == "/v1/county_raw":
            data = json.loads((FIXTURES / "county_2012_54059.json").read_text())
            return httpx.Response(200, json=data)
        return httpx.Response(200, json=[])

    return httpx.MockTransport(handler)


def test_fetch_state_writes_files(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(tmp_path))
    cfg = Config.from_env()
    cfg.ensure_dirs()
    client = WapoClient(transport=mock_transport())
    fetch_state(client, cfg, state="WV")
    wapo_raw = cfg.raw_dir / "wapo"
    assert wapo_raw.is_dir()
    files = sorted(p.name for p in wapo_raw.glob("*.json"))
    assert any("Mingo" in n for n in files)
    assert any("Cabell" in n for n in files)


def test_stream_wapo_mme_county_year_writes_compact_csv(tmp_path):
    county_csv = tmp_path / "arcos_mendeley_county.csv"
    county_csv.write_text(
        "\n".join(
            [
                '"BUYER_COUNTY","BUYER_STATE","year","count","DOSAGE_UNIT","countyfips"',
                '"MINGO","WV",2012,1,10,"54059"',
                '"LOGAN","WV",2012,1,10,"54045"',
                '"BAD","WV",2012,1,10,"not-a-fips"',
            ]
        )
    )
    raw_tsv = tmp_path / "arcos_all_washpost.tsv.gz"
    with gzip.open(raw_tsv, "wt", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "BUYER_STATE",
                "BUYER_COUNTY",
                "TRANSACTION_DATE",
                "CALC_BASE_WT_IN_GM",
                "MME_Conversion_Factor",
            ],
            delimiter="\t",
        )
        writer.writeheader()
        writer.writerows(
            [
                {
                    "BUYER_STATE": "WV",
                    "BUYER_COUNTY": "MINGO",
                    "TRANSACTION_DATE": "01052012",
                    "CALC_BASE_WT_IN_GM": 1.5,
                    "MME_Conversion_Factor": 1.0,
                },
                {
                    "BUYER_STATE": "WV",
                    "BUYER_COUNTY": "MINGO",
                    "TRANSACTION_DATE": "12152012",
                    "CALC_BASE_WT_IN_GM": 2.0,
                    "MME_Conversion_Factor": 1.5,
                },
                {
                    "BUYER_STATE": "WV",
                    "BUYER_COUNTY": "LOGAN",
                    "TRANSACTION_DATE": "07012013",
                    "CALC_BASE_WT_IN_GM": 0.25,
                    "MME_Conversion_Factor": 4.0,
                },
                {
                    "BUYER_STATE": "WV",
                    "BUYER_COUNTY": "BAD",
                    "TRANSACTION_DATE": "07012013",
                    "CALC_BASE_WT_IN_GM": 10.0,
                    "MME_Conversion_Factor": 1.0,
                },
            ]
        )
    out = tmp_path / "arcos_mme_county_year.csv"

    stream_wapo_mme_county_year(raw_tsv, county_csv, out, batch_size=2)

    df = pl.read_csv(out, schema_overrides={"fips": pl.Utf8}).sort(["fips", "year"])
    assert df.to_dicts() == [
        {"fips": "54045", "year": 2013, "mme": 1000.0},
        {"fips": "54059", "year": 2012, "mme": 4500.0},
    ]
