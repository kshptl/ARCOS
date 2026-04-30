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
        log.info("dea fetch: not yet implemented (see Task 32)")


@app.command()
def clean() -> None:
    """Normalize raw data into canonical parquet."""
    import polars as pl

    from openarcos_pipeline.clean.cdc import parse_d76_response
    from openarcos_pipeline.config import Config

    cfg = Config.from_env()
    cfg.clean_dir.mkdir(parents=True, exist_ok=True)
    cdc_raw = cfg.raw_dir / "cdc"
    if cdc_raw.is_dir():
        frames = []
        for xml_file in sorted(cdc_raw.glob("*.xml")):
            frames.append(parse_d76_response(xml_file.read_text()))
        if frames:
            df = pl.concat(frames, how="vertical_relaxed")
            df.write_parquet(cfg.clean_dir / "cdc_overdose.parquet")
            log.info("cdc clean: wrote", extra={"rows": len(df)})
    # wapo + dea clean wired in Tasks 34/37
    raise typer.Exit(0)


@app.command()
def join() -> None:
    """Build FIPS × year master parquet."""
    log.info("join: not yet implemented")
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
