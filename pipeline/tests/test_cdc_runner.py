"""Legacy CDC XML runner refuses county-level API failures without cache writes."""

import httpx

from openarcos_pipeline.config import Config
from openarcos_pipeline.sources.cdc_runner import fetch_all_states
from openarcos_pipeline.sources.cdc_wonder import CDCWonderClient

def test_runner_does_not_write_refused_xml_response(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(tmp_path))
    cfg = Config.from_env()
    cfg.ensure_dirs()

    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(
            500,
            text="Only national data are available for this dataset when using the WONDER web service.",
        )

    client = CDCWonderClient(transport=httpx.MockTransport(handler), max_retries=1)
    fetch_all_states(client, cfg, states=["54"], years=[2012, 2013, 2014])
    out = cfg.raw_dir / "cdc"
    assert not list(out.glob("*.xml"))
