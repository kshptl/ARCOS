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
        log.info("cdc fetch: not yet implemented (see Task 26)")
    if source in ("all", "dea"):
        log.info("dea fetch: not yet implemented (see Task 32)")


@app.command()
def clean() -> None:
    """Normalize raw data into canonical schemas."""
    log.info("clean: not yet implemented")
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
