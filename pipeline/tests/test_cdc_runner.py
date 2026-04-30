"""CDC runner: fetches per state-year-window, writes raw XML to data/raw/cdc/."""

from pathlib import Path

import httpx

from openarcos_pipeline.config import Config
from openarcos_pipeline.sources.cdc_runner import fetch_all_states
from openarcos_pipeline.sources.cdc_wonder import CDCWonderClient

FIXTURE = Path(__file__).parent / "fixtures" / "cdc" / "wv_2012_2014.xml"


def test_runner_writes_per_state(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(tmp_path))
    cfg = Config.from_env()
    cfg.ensure_dirs()

    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=FIXTURE.read_bytes())

    client = CDCWonderClient(transport=httpx.MockTransport(handler))
    fetch_all_states(client, cfg, states=["WV"], years=[2012, 2013, 2014])
    out = cfg.raw_dir / "cdc"
    assert (out / "WV_2012-2014.xml").exists()
