# openarcos pipeline

ETL for openarcos.org. Fetches WaPo ARCOS, CDC WONDER, and DEA Diversion summaries;
joins them; emits Parquet + JSON artifacts consumed by the `/web` Next.js site.

## Quickstart

    cd pipeline
    uv sync
    uv run pytest
    make all

See `notes/` for per-source research and response-shape documentation.
