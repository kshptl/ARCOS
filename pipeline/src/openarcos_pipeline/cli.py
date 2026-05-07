"""CLI entrypoint for the openarcos pipeline."""

from __future__ import annotations

import typer

from openarcos_pipeline.log import get_logger

app = typer.Typer(
    help="openarcos pipeline — fetch, clean, join, aggregate, emit.",
    no_args_is_help=True,
)
log = get_logger("openarcos.cli")


def _run_fetch(cfg, source: str = "all") -> None:
    """Helper: download raw source data. Reused by `fetch` and `all`."""
    cfg.ensure_dirs()
    if source in ("all", "wapo"):
        from openarcos_pipeline.sources.wapo_runner import fetch_county_csv

        fetch_county_csv(cfg)
        log.info("wapo county shipment fetch complete")
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


def _run_clean(cfg) -> None:
    """Helper: normalize raw data into canonical parquet. Reused by `clean` and `all`."""
    import json

    import polars as pl

    from openarcos_pipeline.clean.cdc import load_cache_dir as load_cdc_cache
    from openarcos_pipeline.clean.dea import (
        ActionType,
        build_artifact,
        classify_notices,
    )
    from openarcos_pipeline.clean.wapo import (
        clean_county_csv,
        clean_county_raw,
        clean_distributors,
        clean_distributors_by_county,
        clean_pharmacies,
    )

    cfg.clean_dir.mkdir(parents=True, exist_ok=True)

    # Census — runs first so the joined grid has county metadata.
    census_csv = cfg.raw_dir / "census" / "co-est2019-alldata.csv"
    if census_csv.exists():
        from openarcos_pipeline.sources.census import clean_to_parquet as clean_census

        clean_census(cfg, census_csv)

    # CDC — parse per-state TSV exports from `data/raw/cdc/*.tsv` into
    # the canonical 4-column parquet consumed by join/aggregate.
    cdc_raw = cfg.raw_dir / "cdc"
    if cdc_raw.is_dir():
        df = load_cdc_cache(cdc_raw)
        if len(df) > 0:
            df.write_parquet(cfg.clean_dir / "cdc_overdose.parquet")

        # Parallel richer artifact: data/processed/cdc_county_overdose.json
        # (population, crude_rate, unreliable flag, full methodology).
        # Separate from the parquet because the web-facing schema for the
        # parquet is pinned at {fips, year, deaths, suppressed}.
        from openarcos_pipeline.aggregate_cdc import write_processed_artifact

        processed_dir = cfg.data_root / "processed"
        processed_dir.mkdir(parents=True, exist_ok=True)
        write_processed_artifact(cdc_raw, processed_dir / "cdc_county_overdose.json")

    # DEA — Federal Register NOTICES, classified into registrant actions.
    # Reads cached FR payloads from data/raw/dea/fr_notices_<year>.json
    # (written by sources.dea_summaries.fetch_reports).
    dea_raw = cfg.raw_dir / "dea"
    all_notices: list[dict] = []
    years: list[int] = []
    if dea_raw.is_dir():
        for path in sorted(dea_raw.glob("fr_notices_*.json")):
            stem = path.stem  # fr_notices_YYYY
            try:
                year = int(stem.split("_")[-1])
            except ValueError:
                continue
            years.append(year)
            body = json.loads(path.read_text())
            all_notices.extend(body.get("results") or [])

    if all_notices:
        year_range = range(min([*years, 2006]), max([*years, 2014]) + 1)

        classified = classify_notices(all_notices)

        # Per-document audit trail (committed to git).
        audit_path = dea_raw / "fr_notices_all_classified.json"
        dea_raw.mkdir(parents=True, exist_ok=True)
        audit_path.write_text(json.dumps(classified, indent=2))

        # Tooltip-ready per-year artifact (committed to git under
        # data/processed/). Includes methodology and source provenance.
        processed_dir = cfg.data_root / "processed"
        processed_dir.mkdir(parents=True, exist_ok=True)
        artifact = build_artifact(classified, years=year_range)
        (processed_dir / "dea_actions_by_year.json").write_text(json.dumps(artifact, indent=2))

        # Consumer-facing parquet: year, action_count, by_type,
        # notable_actions. Notable actions pick 3 representative notices
        # per year preferring IMMEDIATE_SUSPENSION and
        # FINAL_ORDER_REVOCATION with live html_urls.
        classified_by_year: dict[int, list[dict]] = {}
        seen_docs: set[str] = set()
        for doc in classified:
            docnum = doc.get("document_number")
            if docnum and docnum in seen_docs:
                continue
            if docnum:
                seen_docs.add(docnum)
            if doc.get("action_type") == ActionType.NON_ACTION.value:
                continue
            pd_str = doc.get("publication_date") or ""
            try:
                y = int(pd_str[:4])
            except ValueError:
                continue
            classified_by_year.setdefault(y, []).append(doc)

        def _notable_for(year: int) -> list[dict]:
            docs = classified_by_year.get(year, [])
            priority = {
                ActionType.IMMEDIATE_SUSPENSION.value: 0,
                ActionType.FINAL_ORDER_REVOCATION.value: 1,
                ActionType.SETTLEMENT.value: 2,
                ActionType.ORDER_TO_SHOW_CAUSE.value: 3,
                ActionType.ADMONITION.value: 4,
                ActionType.OTHER_REGISTRANT_ACTION.value: 5,
            }
            # Prefer opioid-relevant items within each priority bucket.
            ranked = sorted(
                docs,
                key=lambda d: (
                    priority.get(d.get("action_type"), 99),
                    0 if d.get("opioid_relevant") else 1,
                    d.get("publication_date") or "",
                ),
            )
            return [
                {
                    "title": d.get("title") or "",
                    "url": d.get("html_url"),
                    "target": None,
                }
                for d in ranked[:3]
            ]

        records: list[dict] = []
        for entry in artifact["years"]:
            y = entry["year"]
            # Preserve the full type taxonomy as keys so the parquet
            # by_type struct has a stable schema every year — this
            # avoids Polars' "struct with no child field" error when a
            # year happens to have zero of some action type.
            full_by_type: dict[str, int] = {
                t.value: 0 for t in ActionType if t is not ActionType.NON_ACTION
            }
            for k, v in entry["by_type"].items():
                full_by_type[k] = v
            records.append(
                {
                    "year": y,
                    "action_count": entry["total"],
                    "by_type": full_by_type,
                    "notable_actions": _notable_for(y),
                }
            )

        if records:
            pl.DataFrame(records).write_parquet(cfg.clean_dir / "dea_enforcement.parquet")

    # WaPo — per-county fixtures named `{endpoint}_{state}_{county}.json`
    # Supported naming conventions (written by sources/wapo_runner.py):
    #   county_raw_{ST}_{County}.json
    #   distributors_{ST}_{County}.json
    #   pharmacies_{ST}_{County}.json
    wapo_raw = cfg.raw_dir / "wapo"
    if wapo_raw.is_dir():
        county_frames: list[pl.DataFrame] = []
        dist_frames: list[pl.DataFrame] = []
        dist_by_county_frames: list[pl.DataFrame] = []
        pharm_frames: list[pl.DataFrame] = []
        county_csv = next(
            (
                path
                for path in [
                    wapo_raw / "arcos_mendeley_county.csv",
                    wapo_raw / "ARCOS Data 11-29-20.csv",
                ]
                if path.exists()
            ),
            None,
        )
        if county_csv is not None:
            county_frames.append(clean_county_csv(county_csv))
            log.info("wapo clean: using county CSV %s", county_csv.name)
        for f in sorted(wapo_raw.glob("*.json")):
            stem = f.stem
            data = json.loads(f.read_text())
            # Accept both `county_raw_{ST}_{County}.json` (from wapo_runner) and
            # `county_{ST}_{FIPS}.json` / `county_{YEAR}_{FIPS}.json` (test fixtures).
            # Skip `county_list_*.json` — those are county enumerations, not shipments.
            if stem.startswith("county_list_"):
                continue
            if stem.startswith("county_raw_") or stem.startswith("county_"):
                if county_csv is not None:
                    continue
                tail = stem.split("_", 1)[1] if stem.startswith("county_") else ""
                if stem.startswith("county_raw_"):
                    tail = stem[len("county_raw_") :]
                parts = tail.split("_", 1)
                state = parts[0] if parts else ""
                # Derive a FIPS from the data itself if present (first row).
                fips = "00000"
                if isinstance(data, list) and data:
                    fips = str(data[0].get("countyfips") or "00000")
                county_frames.append(clean_county_raw(data, state=state, county_fips=fips))
            elif stem.startswith("distributors_"):
                dist_frames.append(clean_distributors(data))
                dist_by_county_frames.append(clean_distributors_by_county(data))
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
        if dist_by_county_frames:
            pl.concat(dist_by_county_frames, how="vertical_relaxed").write_parquet(
                cfg.clean_dir / "wapo_distributors_by_county.parquet"
            )
        if pharm_frames:
            pl.concat(pharm_frames, how="vertical_relaxed").write_parquet(
                cfg.clean_dir / "wapo_pharmacies.parquet"
            )

    log.info("clean complete")


@app.command()
def fetch(source: str = typer.Option("all", help="Source name or 'all'")) -> None:
    """Download raw source data."""
    from openarcos_pipeline.config import Config

    cfg = Config.from_env()
    _run_fetch(cfg, source)


@app.command()
def clean() -> None:
    """Normalize raw data into canonical parquet."""
    from openarcos_pipeline.config import Config

    cfg = Config.from_env()
    _run_clean(cfg)
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
    """Run every SQL aggregation in sql/ against the pipeline inputs."""
    from openarcos_pipeline.aggregate import run_all
    from openarcos_pipeline.config import Config

    cfg = Config.from_env()
    outputs = run_all(cfg)
    log.info("aggregate complete: %d artifacts", len(outputs))
    raise typer.Exit(0)


@app.command()
def emit() -> None:
    """Emit validated artifacts to web/public/data/."""
    from openarcos_pipeline.config import Config
    from openarcos_pipeline.emit import emit_all

    cfg = Config.from_env()
    outs = emit_all(cfg)
    log.info("emit complete: %d files", len(outs))
    raise typer.Exit(0)


@app.command(name="all")
def all_cmd(
    skip_fetch: bool = typer.Option(
        False, "--skip-fetch", help="Skip network fetching; use cached raw/"
    ),
    years_start: int = typer.Option(2006, "--years-start"),
    years_end: int = typer.Option(2020, "--years-end"),
) -> None:
    """Run the full pipeline: fetch → clean → join → aggregate → emit."""
    from openarcos_pipeline.aggregate import run_all as run_aggregate
    from openarcos_pipeline.config import Config
    from openarcos_pipeline.emit import emit_all
    from openarcos_pipeline.join import build_master

    cfg = Config.from_env()
    if not skip_fetch:
        _run_fetch(cfg)
    _run_clean(cfg)
    build_master(cfg, years=range(years_start, years_end + 1))
    run_aggregate(cfg)
    emit_all(cfg)
    log.info("pipeline complete")
    raise typer.Exit(0)


if __name__ == "__main__":
    app()
