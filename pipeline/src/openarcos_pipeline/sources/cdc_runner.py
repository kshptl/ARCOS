"""Runner: fetch CDC WONDER D76 for all states across a year window."""

from __future__ import annotations

from tqdm import tqdm

from openarcos_pipeline.config import Config
from openarcos_pipeline.log import get_logger
from openarcos_pipeline.sources.cdc_wonder import CDCWonderClient

log = get_logger("openarcos.cdc.runner")

ALL_STATE_FIPS = [
    "01", "02", "04", "05", "06", "08", "09", "10", "11", "12", "13", "15",
    "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27",
    "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39",
    "40", "41", "42", "44", "45", "46", "47", "48", "49", "50", "51", "53",
    "54", "55", "56",
]


def fetch_all_states(
    client: CDCWonderClient,
    cfg: Config,
    states: list[str] | None = None,
    years: list[int] | None = None,
) -> None:
    out = cfg.raw_dir / "cdc"
    out.mkdir(parents=True, exist_ok=True)
    years = years or list(range(2006, 2021))
    states = states or ALL_STATE_FIPS
    span = f"{min(years)}-{max(years)}"
    for st in tqdm(states, desc="CDC states"):
        try:
            xml = client.fetch(state_fips=st, years=years)
        except Exception as e:  # noqa: BLE001
            log.warning("cdc fetch failed", extra={"state": st, "err": str(e)})
            continue
        (out / f"{st}_{span}.xml").write_text(xml)
