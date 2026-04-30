# openarcos — pipeline

ETL that fetches three public datasets, joins and aggregates them, and emits
JSON + Parquet artifacts to `../web/public/data/` against the JSON Schemas in
`schemas/`. The output is the load-bearing contract between this pipeline and
the `/web` Next.js site.

## Quickstart

```bash
# from repo root
cd pipeline
uv sync --extra dev

# full pipeline using committed fixtures (no network):
make all

# full pipeline against live sources (takes minutes, requires network):
make fetch && make all
```

After `make all`, browse `../web/public/data/` for the 8 emitted artifacts.

### Environment quirks

If your shell has a `VIRTUAL_ENV` already set (common when a global `.venv`
is active), `uv` may try to install into that environment instead of
`pipeline/.venv`. If you see surprising behaviour, prefix commands with
`unset VIRTUAL_ENV &&`:

```bash
unset VIRTUAL_ENV && uv sync --extra dev
unset VIRTUAL_ENV && uv run pytest -q
```

## Layout

```
pipeline/
├── src/openarcos_pipeline/
│   ├── cli.py                 # Typer entrypoint: fetch|clean|join|aggregate|emit|all
│   ├── config.py              # paths
│   ├── log.py                 # stdout/JSON logging
│   ├── fips.py                # 5-digit county FIPS helpers
│   ├── sources/               # one module per source + a _runner variant
│   ├── clean/                 # normalize source payloads to polars parquet
│   ├── join.py                # DuckDB build of data/joined/master.parquet
│   ├── aggregate.py           # runs sql/*.sql against master → data/agg/
│   └── emit.py                # data/agg/ → ../web/public/data/ (schema-validated)
├── schemas/                   # 8 JSON Schemas — the contract
├── sql/                       # 7 aggregation views
├── tests/                     # pytest suite + committed fixtures
├── scripts/validate_web_data.py
├── Makefile                   # task-runner
└── pyproject.toml             # uv-managed (Python 3.12)
```

Runtime data dirs (`data/raw`, `data/clean`, `data/joined`, `data/agg`) are
git-ignored. Emitted artifacts live under `../web/public/data/` and ARE
committed.

## CLI

The Typer app wraps the pipeline phases:

| Command | Does | Reads | Writes |
|---|---|---|---|
| `openarcos fetch`     | download all raw sources               | network              | `data/raw/`         |
| `openarcos clean`     | normalize raw → typed parquet          | `data/raw/`          | `data/clean/`       |
| `openarcos join`      | build FIPS×year master                 | `data/clean/`        | `data/joined/`      |
| `openarcos aggregate` | run every `sql/*.sql` against master   | `data/joined/`       | `data/agg/`         |
| `openarcos emit`      | write artifacts; validate every one    | `data/agg/`          | `../web/public/data/` |
| `openarcos all`       | clean → join → aggregate → emit        | `data/raw/` or fixtures | `../web/public/data/` |

`openarcos all --skip-fetch` uses whatever is already under `data/raw/` or
`tests/fixtures/` — this is what CI uses.

## Adding a data source

1. Add a module under `sources/` that writes raw files into
   `data/raw/<source>/`. Use `tenacity` for retry + `httpx.MockTransport`
   for tests.
2. Add `clean/<source>.py` that reads from `data/raw/<source>/` and writes
   a typed parquet to `data/clean/`. Normalize FIPS via `fips.py`.
3. If the source feeds any existing SQL view, register it in
   `aggregate._register_inputs()`.
4. If it needs a new emitted artifact:
   - add `schemas/<name>.schema.json` + a sample fixture + a validation test
   - add `sql/<name>.sql`
   - add an emitter to `emit.py`
   - register it in `ARTIFACT_TO_SCHEMA` in `scripts/validate_web_data.py`
5. Include committed test fixtures so CI doesn't need the network.

## Reading schema failures

`emit.py` calls `jsonschema.validate()` on every row BEFORE writing. A failure
looks like:

```
SchemaValidationError: top-distributors-by-year row 42: 101.4 is greater than the maximum of 100
  at ['share_pct']
```

To debug:
1. Inspect the row number in the error → cross-reference against
   `data/agg/<name>.parquet`.
2. Trace upstream: which `sql/*.sql` produced it? Which `data/clean/`
   parquet fed that SQL?
3. If the schema is wrong, update `schemas/` + fixtures + `scripts/validate_web_data.py`.
4. If the data is wrong, fix the cleaner or the SQL.

## Tests + lint

```bash
make test       # pytest
make lint       # ruff check
make format     # ruff format
make snapshots  # regenerate aggregate snapshots
make ci-check   # validate web/public/data (same as the CI gate)
```

Note: `fips.is_valid_fips` is the canonical 5-digit validator — it only
accepts inputs that are already padded. `fips.normalize_fips` is the
permissive front-door that pads 4-digit ints / strings into canonical
5-digit form first. Downstream callers that want permissive parsing should
normalize before validating.

## Data refresh cron

The `.github/workflows/build-data.yml` workflow runs every Monday at
03:00 UTC against live sources and auto-commits changes under
`web/public/data/` with the subject `data: refresh YYYY-MM-DD`. It can also
be triggered on demand from the GitHub Actions tab (`workflow_dispatch`).

If upstream APIs change shape, `sources/expected_hashes.py` trips and the
workflow fails loudly before writing anything. The site on `main` keeps
serving the last-good data until someone updates the hash fingerprint.

## Spike status

Three source-probe spikes (Task 19 WaPo, Task 25 CDC, Task 31 DEA) ran
with synthetic fixtures rather than live-captured responses — see
`notes/wapo.md`, `notes/cdc.md`, and `notes/dea.md` for details. A
maintainer with browser access MUST re-run the probe notebooks against
production endpoints and update both fixtures and `sources/expected_hashes.py`
signatures before the first production refresh.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `RuntimeError: shape changed` in fetch | upstream API changed keys | re-run the probe notebook, update `EXPECTED_SIGNATURES` |
| CDC parser returns empty DataFrame | WONDER XML layout shift | inspect `data/raw/cdc/*.xml`; update `clean/cdc.py:parse_d76_response` |
| snapshot test fails | SQL output intentionally changed | run `make snapshots`, diff the CSV, commit if correct |
| `SchemaValidationError` on emit | SQL produced an out-of-range row | trace upstream (see "Reading schema failures") |
| `MISSING` from `validate_web_data.py` | `make all` hasn't been run yet | run `make all` |
| `ModuleNotFoundError: pytest` in `make test` | venv missing dev deps | `uv sync --extra dev` |

## License

Pipeline code: Apache 2.0 (see `../LICENSE`). Source data licenses are
documented on `/methodology` in the site and linked from each artifact in
the emission map.
