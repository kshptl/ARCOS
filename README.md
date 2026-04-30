# ARCOS

Analyzing the DEA ARCOS prescription-opioid shipment dataset.

Public project: [openarcos.org](https://openarcos.org) (in development).

## Layout

- `/pipeline` — Python 3.12 ETL. Fetches public sources, emits Parquet+JSON.
- `/web` — Next.js static site (coming in Plan 2 / Plan 3).
- `/docs/superpowers/specs/` — Design specs.
- `/docs/superpowers/plans/` — Implementation plans.

## Quickstart

    make build-data       # runs pipeline end-to-end
    make test-pipeline    # pipeline tests
    make lint-pipeline    # ruff lint + format check

## License

TBD.
