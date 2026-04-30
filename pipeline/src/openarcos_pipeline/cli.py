"""CLI entrypoint for the openarcos pipeline."""

from __future__ import annotations

import typer

from openarcos_pipeline.log import get_logger

app = typer.Typer(
    help="openarcos pipeline — fetch, clean, join, aggregate, emit.",
    no_args_is_help=True,
)
log = get_logger("openarcos.cli")


@app.command()
def fetch(source: str = typer.Option("all", help="Source name or 'all'")) -> None:
    """Download raw source data."""
    from openarcos_pipeline.config import Config
    from openarcos_pipeline.sources.wapo_arcos import WapoClient
    from openarcos_pipeline.sources.wapo_runner import fetch_all

    cfg = Config.from_env()
    cfg.ensure_dirs()
    if source in ("all", "wapo"):
        with WapoClient() as client:
            fetch_all(client, cfg)
        log.info("wapo fetch complete")
    if source in ("all", "cdc"):
        from openarcos_pipeline.sources.cdc_runner import fetch_all_states
        from openarcos_pipeline.sources.cdc_wonder import CDCWonderClient
        with CDCWonderClient() as cdc:
            fetch_all_states(cdc, cfg)
        log.info("cdc fetch complete")
    if source in ("all", "dea"):
        from openarcos_pipeline.sources.dea_summaries import fetch_reports
        fetch_reports(cfg)
        log.info("dea fetch complete")
    if source in ("all", "census"):
        from openarcos_pipeline.sources.census import fetch_popest
        fetch_popest(cfg)
        log.info("census fetch complete")


@app.command()
def clean() -> None:
    """Normalize raw data into canonical parquet."""
    import json

    import polars as pl

    from openarcos_pipeline.clean.cdc import parse_d76_response
    from openarcos_pipeline.clean.dea import parse_annual_report
    from openarcos_pipeline.clean.wapo import (
        clean_county_raw,
        clean_distributors,
        clean_pharmacies,
    )
    from openarcos_pipeline.config import Config

    cfg = Config.from_env()
    cfg.clean_dir.mkdir(parents=True, exist_ok=True)

    # Census — runs first so the joined grid has county metadata.
    census_csv = cfg.raw_dir / "census" / "co-est2019-alldata.csv"
    if census_csv.exists():
        from openarcos_pipeline.sources.census import clean_to_parquet as clean_census
        clean_census(cfg, census_csv)

    # CDC
    cdc_raw = cfg.raw_dir / "cdc"
    if cdc_raw.is_dir():
        frames = [
            parse_d76_response(p.read_text()) for p in sorted(cdc_raw.glob("*.xml"))
        ]
        if frames:
            df = pl.concat(frames, how="vertical_relaxed")
            df.write_parquet(cfg.clean_dir / "cdc_overdose.parquet")

    # DEA
    dea_raw = cfg.raw_dir / "dea"
    if dea_raw.is_dir():
        records = []
        for pdf in sorted(dea_raw.glob("*.pdf")):
            try:
                year = int(pdf.stem)
            except ValueError:
                continue
            records.append(parse_annual_report(pdf, year=year))
        if records:
            pl.DataFrame(records).write_parquet(
                cfg.clean_dir / "dea_enforcement.parquet"
            )

    # WaPo — per-county fixtures named `{endpoint}_{state}_{county}.json`
    # Supported naming conventions (written by sources/wapo_runner.py):
    #   county_raw_{ST}_{County}.json
    #   distributors_{ST}_{County}.json
    #   pharmacies_{ST}_{County}.json
    wapo_raw = cfg.raw_dir / "wapo"
    if wapo_raw.is_dir():
        county_frames: list[pl.DataFrame] = []
        dist_frames: list[pl.DataFrame] = []
        pharm_frames: list[pl.DataFrame] = []
        for f in sorted(wapo_raw.glob("*.json")):
            stem = f.stem
            data = json.loads(f.read_text())
            # Accept both `county_raw_{ST}_{County}.json` (from wapo_runner) and
            # `county_{ST}_{FIPS}.json` / `county_{YEAR}_{FIPS}.json` (test fixtures).
            if stem.startswith("county_raw_") or stem.startswith("county_"):
                tail = stem.split("_", 1)[1] if stem.startswith("county_") else ""
                if stem.startswith("county_raw_"):
                    tail = stem[len("county_raw_"):]
                parts = tail.split("_", 1)
                state = parts[0] if parts else ""
                # Derive a FIPS from the data itself if present (first row).
                fips = "00000"
                if isinstance(data, list) and data:
                    fips = str(data[0].get("countyfips") or "00000")
                county_frames.append(
                    clean_county_raw(data, state=state, county_fips=fips)
                )
            elif stem.startswith("distributors_"):
                dist_frames.append(clean_distributors(data))
            elif stem.startswith("pharmacies_"):
                fips = "00000"
                if isinstance(data, list) and data:
                    fips = str(data[0].get("countyfips") or "00000")
                pharm_frames.append(clean_pharmacies(data, county_fips=fips))

        if county_frames:
            pl.concat(county_frames, how="vertical_relaxed").write_parquet(
                cfg.clean_dir / "wapo_county.parquet"
            )
        if dist_frames:
            pl.concat(dist_frames, how="vertical_relaxed").write_parquet(
                cfg.clean_dir / "wapo_distributors.parquet"
            )
        if pharm_frames:
            pl.concat(pharm_frames, how="vertical_relaxed").write_parquet(
                cfg.clean_dir / "wapo_pharmacies.parquet"
            )

    log.info("clean complete")
    raise typer.Exit(0)


@app.command()
def join(
    years_start: int = typer.Option(2006, "--years-start"),
    years_end: int = typer.Option(2020, "--years-end"),
) -> None:
    """Build FIPS × year master parquet."""
    from openarcos_pipeline.config import Config
    from openarcos_pipeline.join import build_master

    cfg = Config.from_env()
    out = build_master(cfg, years=range(years_start, years_end + 1))
    log.info("join complete: %s", out)
    raise typer.Exit(0)


@app.command()
def aggregate() -> None:
    """Run sql/*.sql viewpoint queries."""
    log.info("aggregate: not yet implemented")
    raise typer.Exit(0)


@app.command()
def emit() -> None:
    """Write schema-validated artifacts to the web's public/data/."""
    log.info("emit: not yet implemented")
    raise typer.Exit(0)


@app.command("all")
def all_cmd() -> None:
    """Run fetch → clean → join → aggregate → emit."""
    log.info("all: not yet implemented")
    raise typer.Exit(0)


if __name__ == "__main__":
    app()
