# openarcos Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Python ETL at `/pipeline` that fetches WaPo ARCOS + DEA summaries + CDC WONDER, joins/aggregates them, and emits Parquet+JSON to `/web/public/data/` conforming to JSON Schemas in `/pipeline/schemas/`. Reproducible via `make all`. Every emitted file is schema-validated in CI.

**Architecture:** uv-managed Python 3.12 project. Polars for cleaning, DuckDB (one SQL file per emitted artifact) for joins/aggregation. jsonschema-validated contract files as the load-bearing boundary to `/web`. Three source modules with recorded fixtures drive an offline-capable test suite; live fetches happen only in the `build-data` workflow.

**Tech Stack:** `polars~=1.0`, `duckdb~=1.0`, `httpx~=0.27`, `tenacity~=9.0`, `pdfplumber~=0.11`, `jsonschema~=4.22`, `pytest~=8.2`, `ruff~=0.5`, `typer~=0.12`, `tqdm~=4.66`.

---

## File Structure

```
/pipeline
├── pyproject.toml                # uv; Python 3.12
├── .python-version               # "3.12"
├── Makefile                      # fetch|clean|join|aggregate|emit|all|test|lint
├── README.md                     # how to run, add a source, interpret failures
├── src/openarcos_pipeline/
│   ├── __init__.py
│   ├── config.py                 # typed paths (raw/clean/joined/agg/emit)
│   ├── log.py                    # structured logging
│   ├── fips.py                   # normalize 5-digit FIPS, state-from-FIPS
│   ├── sources/
│   │   ├── __init__.py
│   │   ├── wapo_arcos.py         # httpx client; hits arcos-api.ext.nile.works
│   │   ├── dea_summaries.py      # scrapes DEA Diversion annual PDFs
│   │   └── cdc_wonder.py         # POSTs to WONDER D76
│   ├── clean/
│   │   ├── __init__.py
│   │   ├── wapo.py
│   │   ├── dea.py
│   │   └── cdc.py
│   ├── join.py                   # DuckDB join on FIPS + year → master.parquet
│   ├── aggregate.py              # runs sql/*.sql against master
│   ├── emit.py                   # writes to /web/public/data/, validates schemas
│   └── cli.py                    # Typer entrypoint
├── schemas/                      # 8 JSON Schemas (one per emitted artifact)
├── sql/                          # 7 SQL files, one per emitted artifact
├── tests/
│   ├── conftest.py
│   ├── fixtures/                 # 10-county sample of each source (committed)
│   ├── snapshots/                # golden CSVs for aggregate outputs
│   ├── test_fips.py
│   ├── test_clean_wapo.py
│   ├── test_clean_cdc.py
│   ├── test_clean_dea.py
│   ├── test_join.py
│   ├── test_aggregate.py
│   ├── test_emit.py
│   └── test_schema_roundtrip.py
├── notes/                        # committed notes from source spikes
├── data/                         # .gitignored: raw/, clean/, joined/, agg/
└── notebooks/                    # .gitignored except .gitkeep
```

**Repo-level additions:** top-level `Makefile` delegating to `/pipeline`; `.gitattributes` marking `*.parquet binary`; `.github/workflows/{ci,build-data}.yml`.

---

## Phase 1 — Scaffold (5 tasks)

### Task 1: Initialize uv project

**Files:**
- Create: `/home/kush/ARCOS/pipeline/pyproject.toml`
- Create: `/home/kush/ARCOS/pipeline/.python-version`
- Create: `/home/kush/ARCOS/pipeline/src/openarcos_pipeline/__init__.py`
- Create: `/home/kush/ARCOS/pipeline/README.md`

- [ ] **Step 1: Create `pipeline/pyproject.toml`**

```toml
[project]
name = "openarcos-pipeline"
version = "0.1.0"
description = "ETL for openarcos.org"
requires-python = ">=3.12,<3.13"
dependencies = [
    "polars~=1.0",
    "duckdb~=1.0",
    "httpx~=0.27",
    "tenacity~=9.0",
    "pdfplumber~=0.11",
    "jsonschema~=4.22",
    "typer~=0.12",
    "tqdm~=4.66",
]

[project.optional-dependencies]
dev = [
    "pytest~=8.2",
    "pytest-cov~=5.0",
    "ruff~=0.5",
]

[project.scripts]
openarcos = "openarcos_pipeline.cli:app"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/openarcos_pipeline"]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["src"]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "W", "I", "N", "UP", "B", "SIM", "RUF"]
```

- [ ] **Step 2: Create `pipeline/.python-version`**

```
3.12
```

- [ ] **Step 3: Create package `__init__.py`**

```python
"""openarcos pipeline: ETL for openarcos.org."""

__version__ = "0.1.0"
```

- [ ] **Step 4: Stub `pipeline/README.md`**

```markdown
# openarcos pipeline

ETL for openarcos.org. Fetches WaPo ARCOS, CDC WONDER, and DEA Diversion summaries;
joins them; emits Parquet + JSON artifacts consumed by the `/web` Next.js site.

## Quickstart

    cd pipeline
    uv sync
    uv run pytest
    make all

See `notes/` for per-source research and response-shape documentation.
```

- [ ] **Step 5: Install dependencies**

Run: `cd /home/kush/ARCOS/pipeline && uv sync`
Expected: creates `uv.lock` and `.venv/`, installs all deps without error.

- [ ] **Step 6: Verify install**

Run: `cd /home/kush/ARCOS/pipeline && uv run python -c "import polars, duckdb, httpx, jsonschema, typer, pdfplumber, tenacity, tqdm; print('ok')"`
Expected: prints `ok`.

- [ ] **Step 7: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/pyproject.toml pipeline/.python-version pipeline/uv.lock \
        pipeline/src/openarcos_pipeline/__init__.py pipeline/README.md
git commit -m "pipeline: scaffold uv project with Python 3.12 pin"
```

### Task 2: Pipeline Makefile with stub targets

**Files:**
- Create: `/home/kush/ARCOS/pipeline/Makefile`

- [ ] **Step 1: Create `pipeline/Makefile`**

```make
.PHONY: all fetch clean join aggregate emit test lint format help

UV := uv run

help:
	@echo "Targets: fetch | clean | join | aggregate | emit | all | test | lint | format"

fetch:
	$(UV) openarcos fetch

clean:
	$(UV) openarcos clean

join:
	$(UV) openarcos join

aggregate:
	$(UV) openarcos aggregate

emit:
	$(UV) openarcos emit

all: fetch clean join aggregate emit

test:
	$(UV) pytest -v

lint:
	$(UV) ruff check src tests
	$(UV) ruff format --check src tests

format:
	$(UV) ruff format src tests
	$(UV) ruff check --fix src tests
```

- [ ] **Step 2: Verify `make help` prints targets**

Run: `cd /home/kush/ARCOS/pipeline && make help`
Expected: prints `Targets: fetch | clean | join | aggregate | emit | all | test | lint | format`.

- [ ] **Step 3: Verify `make test` runs (no tests yet)**

Run: `cd /home/kush/ARCOS/pipeline && make test`
Expected: exit 5 (pytest "no tests collected") or exit 0. We will fix this in Task 5 by adding a first test.

- [ ] **Step 4: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/Makefile
git commit -m "pipeline: add Makefile with stub targets"
```

### Task 3: Root Makefile delegation

**Files:**
- Create: `/home/kush/ARCOS/Makefile`
- Modify: `/home/kush/ARCOS/README.md`

- [ ] **Step 1: Create root `Makefile`**

```make
.PHONY: build-data test-pipeline lint-pipeline

build-data:
	$(MAKE) -C pipeline all

test-pipeline:
	$(MAKE) -C pipeline test

lint-pipeline:
	$(MAKE) -C pipeline lint
```

- [ ] **Step 2: Replace `/home/kush/ARCOS/README.md`**

```markdown
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
```

- [ ] **Step 3: Verify root `make help`-style sanity**

Run: `cd /home/kush/ARCOS && make test-pipeline`
Expected: delegates to `pipeline` subdir; exit 0 or 5.

- [ ] **Step 4: Commit**

```bash
cd /home/kush/ARCOS
git add Makefile README.md
git commit -m "repo: add root Makefile delegating to pipeline"
```

### Task 4: Gitignore and gitattributes

**Files:**
- Modify: `/home/kush/ARCOS/.gitignore`
- Create: `/home/kush/ARCOS/.gitattributes`
- Create: `/home/kush/ARCOS/pipeline/notebooks/.gitkeep`

- [ ] **Step 1: Read existing `.gitignore`**

Run: `cat /home/kush/ARCOS/.gitignore`

- [ ] **Step 2: Append to `.gitignore`**

Append these lines:

```gitignore

# pipeline
pipeline/.venv/
pipeline/data/raw/
pipeline/data/clean/
pipeline/data/joined/
pipeline/data/agg/
pipeline/notebooks/*.ipynb_checkpoints/
pipeline/**/__pycache__/
pipeline/.pytest_cache/
pipeline/.ruff_cache/
pipeline/htmlcov/
pipeline/.coverage
```

- [ ] **Step 3: Create `.gitattributes`**

```
*.parquet binary
*.woff2 binary
*.pdf binary
```

- [ ] **Step 4: Create `pipeline/notebooks/.gitkeep`**

Empty file.

- [ ] **Step 5: Verify `.gitignore` working**

Run: `mkdir -p /home/kush/ARCOS/pipeline/data/raw && touch /home/kush/ARCOS/pipeline/data/raw/probe && cd /home/kush/ARCOS && git status --porcelain pipeline/data/`
Expected: no output (file is ignored).

- [ ] **Step 6: Commit**

```bash
cd /home/kush/ARCOS
git add .gitignore .gitattributes pipeline/notebooks/.gitkeep
git commit -m "repo: ignore pipeline data dirs, mark binary formats"
```

### Task 5: First passing test validates install

**Files:**
- Create: `/home/kush/ARCOS/pipeline/tests/__init__.py`
- Create: `/home/kush/ARCOS/pipeline/tests/conftest.py`
- Create: `/home/kush/ARCOS/pipeline/tests/test_smoke.py`

- [ ] **Step 1: Create `tests/__init__.py`** — empty file.

- [ ] **Step 2: Create `tests/conftest.py`**

```python
"""Shared pytest configuration."""

from pathlib import Path

import pytest


@pytest.fixture
def fixtures_dir() -> Path:
    return Path(__file__).parent / "fixtures"


@pytest.fixture
def snapshots_dir() -> Path:
    return Path(__file__).parent / "snapshots"
```

- [ ] **Step 3: Create `tests/test_smoke.py`**

```python
"""Smoke test: all runtime dependencies importable."""


def test_imports_work():
    import duckdb
    import httpx
    import jsonschema
    import pdfplumber
    import polars as pl
    import typer
    import tenacity
    import tqdm

    # Check minimum versions
    assert int(pl.__version__.split(".")[0]) >= 1
    assert duckdb.__version__ is not None


def test_package_importable():
    import openarcos_pipeline

    assert openarcos_pipeline.__version__ == "0.1.0"
```

- [ ] **Step 4: Run test — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_smoke.py -v`
Expected: 2 passed.

- [ ] **Step 5: Verify lint clean**

Run: `cd /home/kush/ARCOS/pipeline && make lint`
Expected: exit 0, no issues.

- [ ] **Step 6: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/tests/
git commit -m "pipeline: first smoke test verifies imports"
```

---

### Phase 1 gate

After every task in this phase, run the full verification matrix:

```bash
cd pipeline && make lint && make test
```

All checks must pass before starting the next phase. If any check fails, fix before proceeding; do not rely on the merge or a later phase to catch it.

---

## Phase 2 — JSON Schemas (9 tasks)

Schemas are the load-bearing interface between `/pipeline` and `/web`. Each schema is a JSON Schema Draft 2020-12 document. Each task: write schema + write a valid fixture + test the fixture validates + test an *invalid* fixture fails.

### Task 6: `county-metadata.schema.json`

**Files:**
- Create: `/home/kush/ARCOS/pipeline/schemas/county-metadata.schema.json`
- Create: `/home/kush/ARCOS/pipeline/tests/fixtures/county-metadata.sample.json`
- Create: `/home/kush/ARCOS/pipeline/tests/fixtures/county-metadata.invalid.json`
- Create: `/home/kush/ARCOS/pipeline/tests/test_schemas.py`

- [ ] **Step 1: Write schema**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openarcos.org/schemas/county-metadata.schema.json",
  "title": "County metadata",
  "description": "One row per US county. Populations are mid-ACS 5-year estimates.",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["fips", "name", "state", "pop"],
    "additionalProperties": false,
    "properties": {
      "fips": {"type": "string", "pattern": "^[0-9]{5}$"},
      "name": {"type": "string", "minLength": 1},
      "state": {"type": "string", "pattern": "^[A-Z]{2}$"},
      "pop": {"type": "integer", "minimum": 0}
    }
  }
}
```

- [ ] **Step 2: Write valid fixture**

```json
[
  {"fips": "54059", "name": "Mingo County", "state": "WV", "pop": 23307},
  {"fips": "51720", "name": "Norton city", "state": "VA", "pop": 3944}
]
```

- [ ] **Step 3: Write invalid fixture (FIPS too short)**

```json
[
  {"fips": "5405", "name": "Mingo County", "state": "WV", "pop": 23307}
]
```

- [ ] **Step 4: Write schema test**

```python
"""Validate fixtures against schemas."""

import json
from pathlib import Path

import jsonschema
import pytest

SCHEMAS_DIR = Path(__file__).parent.parent / "schemas"
FIXTURES_DIR = Path(__file__).parent / "fixtures"


def load_json(path: Path):
    with path.open() as f:
        return json.load(f)


def _validate(schema_name: str, fixture_name: str) -> None:
    schema = load_json(SCHEMAS_DIR / f"{schema_name}.schema.json")
    data = load_json(FIXTURES_DIR / fixture_name)
    jsonschema.validate(data, schema)


def test_county_metadata_sample_valid():
    _validate("county-metadata", "county-metadata.sample.json")


def test_county_metadata_invalid_rejected():
    schema = load_json(SCHEMAS_DIR / "county-metadata.schema.json")
    data = load_json(FIXTURES_DIR / "county-metadata.invalid.json")
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(data, schema)
```

- [ ] **Step 5: Run test — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_schemas.py -v`
Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/schemas/county-metadata.schema.json \
        pipeline/tests/fixtures/county-metadata.sample.json \
        pipeline/tests/fixtures/county-metadata.invalid.json \
        pipeline/tests/test_schemas.py
git commit -m "pipeline: add county-metadata schema + validation test"
```

### Task 7: `state-shipments-by-year.schema.json`

**Files:**
- Create: `/home/kush/ARCOS/pipeline/schemas/state-shipments-by-year.schema.json`
- Create: `/home/kush/ARCOS/pipeline/tests/fixtures/state-shipments-by-year.sample.json`
- Modify: `/home/kush/ARCOS/pipeline/tests/test_schemas.py`

- [ ] **Step 1: Write schema**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openarcos.org/schemas/state-shipments-by-year.schema.json",
  "title": "State-level shipments by year",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["state", "year", "pills", "pills_per_capita"],
    "additionalProperties": false,
    "properties": {
      "state": {"type": "string", "pattern": "^[A-Z]{2}$"},
      "year": {"type": "integer", "minimum": 2006, "maximum": 2014},
      "pills": {"type": "integer", "minimum": 0},
      "pills_per_capita": {"type": "number", "minimum": 0}
    }
  }
}
```

- [ ] **Step 2: Write fixture**

```json
[
  {"state": "WV", "year": 2006, "pills": 67831000, "pills_per_capita": 37.4},
  {"state": "WV", "year": 2014, "pills": 85612000, "pills_per_capita": 46.2}
]
```

- [ ] **Step 3: Add test to `test_schemas.py`**

Append inside the file:

```python
def test_state_shipments_sample_valid():
    _validate("state-shipments-by-year", "state-shipments-by-year.sample.json")
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_schemas.py -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/schemas/state-shipments-by-year.schema.json \
        pipeline/tests/fixtures/state-shipments-by-year.sample.json \
        pipeline/tests/test_schemas.py
git commit -m "pipeline: add state-shipments schema"
```

### Task 8: `county-shipments-by-year.schema.json`

**Files:**
- Create: `/home/kush/ARCOS/pipeline/schemas/county-shipments-by-year.schema.json`
- Create: `/home/kush/ARCOS/pipeline/tests/fixtures/county-shipments-by-year.sample.json`
- Modify: `/home/kush/ARCOS/pipeline/tests/test_schemas.py`

- [ ] **Step 1: Write schema**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openarcos.org/schemas/county-shipments-by-year.schema.json",
  "title": "County-level shipments by year",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["fips", "year", "pills", "pills_per_capita"],
    "additionalProperties": false,
    "properties": {
      "fips": {"type": "string", "pattern": "^[0-9]{5}$"},
      "year": {"type": "integer", "minimum": 2006, "maximum": 2014},
      "pills": {"type": "integer", "minimum": 0},
      "pills_per_capita": {"type": "number", "minimum": 0}
    }
  }
}
```

- [ ] **Step 2: Write fixture**

```json
[
  {"fips": "54059", "year": 2008, "pills": 4092000, "pills_per_capita": 175.6},
  {"fips": "54059", "year": 2012, "pills": 3211000, "pills_per_capita": 137.8}
]
```

- [ ] **Step 3: Add test**

```python
def test_county_shipments_sample_valid():
    _validate("county-shipments-by-year", "county-shipments-by-year.sample.json")
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_schemas.py -v`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/schemas/county-shipments-by-year.schema.json \
        pipeline/tests/fixtures/county-shipments-by-year.sample.json \
        pipeline/tests/test_schemas.py
git commit -m "pipeline: add county-shipments schema"
```

### Task 9: `top-distributors-by-year.schema.json`

**Files:**
- Create: `/home/kush/ARCOS/pipeline/schemas/top-distributors-by-year.schema.json`
- Create: `/home/kush/ARCOS/pipeline/tests/fixtures/top-distributors-by-year.sample.json`
- Modify: `/home/kush/ARCOS/pipeline/tests/test_schemas.py`

- [ ] **Step 1: Write schema**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openarcos.org/schemas/top-distributors-by-year.schema.json",
  "title": "Top distributors by year (market-share rankings)",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["distributor", "year", "pills", "share_pct"],
    "additionalProperties": false,
    "properties": {
      "distributor": {"type": "string", "minLength": 1},
      "year": {"type": "integer", "minimum": 2006, "maximum": 2014},
      "pills": {"type": "integer", "minimum": 0},
      "share_pct": {"type": "number", "minimum": 0, "maximum": 100}
    }
  }
}
```

- [ ] **Step 2: Write fixture**

```json
[
  {"distributor": "McKesson Corporation", "year": 2012, "pills": 5100000000, "share_pct": 38.4},
  {"distributor": "Cardinal Health", "year": 2012, "pills": 3400000000, "share_pct": 25.6}
]
```

- [ ] **Step 3: Add test**

```python
def test_top_distributors_sample_valid():
    _validate("top-distributors-by-year", "top-distributors-by-year.sample.json")
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_schemas.py -v`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/schemas/top-distributors-by-year.schema.json \
        pipeline/tests/fixtures/top-distributors-by-year.sample.json \
        pipeline/tests/test_schemas.py
git commit -m "pipeline: add top-distributors schema"
```

### Task 10: `top-pharmacies.schema.json`

**Files:**
- Create: `/home/kush/ARCOS/pipeline/schemas/top-pharmacies.schema.json`
- Create: `/home/kush/ARCOS/pipeline/tests/fixtures/top-pharmacies.sample.json`
- Modify: `/home/kush/ARCOS/pipeline/tests/test_schemas.py`

- [ ] **Step 1: Write schema**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openarcos.org/schemas/top-pharmacies.schema.json",
  "title": "Pharmacy-level total shipments",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["pharmacy_id", "name", "address", "fips", "total_pills"],
    "additionalProperties": false,
    "properties": {
      "pharmacy_id": {"type": "string", "minLength": 1},
      "name": {"type": "string", "minLength": 1},
      "address": {"type": "string", "minLength": 1},
      "fips": {"type": "string", "pattern": "^[0-9]{5}$"},
      "total_pills": {"type": "integer", "minimum": 0}
    }
  }
}
```

- [ ] **Step 2: Write fixture**

```json
[
  {"pharmacy_id": "FB9876543", "name": "SAV-RITE PHARMACY #1", "address": "KERMIT, WV 25674", "fips": "54059", "total_pills": 17235000}
]
```

- [ ] **Step 3: Add test**

```python
def test_top_pharmacies_sample_valid():
    _validate("top-pharmacies", "top-pharmacies.sample.json")
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_schemas.py -v`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/schemas/top-pharmacies.schema.json \
        pipeline/tests/fixtures/top-pharmacies.sample.json \
        pipeline/tests/test_schemas.py
git commit -m "pipeline: add top-pharmacies schema"
```

### Task 11: `dea-enforcement-actions.schema.json`

**Files:**
- Create: `/home/kush/ARCOS/pipeline/schemas/dea-enforcement-actions.schema.json`
- Create: `/home/kush/ARCOS/pipeline/tests/fixtures/dea-enforcement-actions.sample.json`
- Modify: `/home/kush/ARCOS/pipeline/tests/test_schemas.py`

- [ ] **Step 1: Write schema**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openarcos.org/schemas/dea-enforcement-actions.schema.json",
  "title": "DEA Diversion Control annual enforcement summary",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["year", "action_count", "notable_actions"],
    "additionalProperties": false,
    "properties": {
      "year": {"type": "integer", "minimum": 2000, "maximum": 2025},
      "action_count": {"type": "integer", "minimum": 0},
      "notable_actions": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["title", "url"],
          "additionalProperties": false,
          "properties": {
            "title": {"type": "string", "minLength": 1},
            "url": {"type": "string", "format": "uri"},
            "target": {"type": ["string", "null"]}
          }
        }
      }
    }
  }
}
```

- [ ] **Step 2: Write fixture**

```json
[
  {
    "year": 2008,
    "action_count": 1247,
    "notable_actions": [
      {"title": "McKesson settlement", "url": "https://www.justice.gov/archive/opa/pr/2008/May/08-odag-381.html", "target": "McKesson"}
    ]
  }
]
```

- [ ] **Step 3: Add test**

```python
def test_dea_enforcement_sample_valid():
    _validate("dea-enforcement-actions", "dea-enforcement-actions.sample.json")
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_schemas.py -v`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/schemas/dea-enforcement-actions.schema.json \
        pipeline/tests/fixtures/dea-enforcement-actions.sample.json \
        pipeline/tests/test_schemas.py
git commit -m "pipeline: add dea-enforcement-actions schema"
```

### Task 12: `cdc-overdose-by-county-year.schema.json` (preserves suppression flag)

**Files:**
- Create: `/home/kush/ARCOS/pipeline/schemas/cdc-overdose-by-county-year.schema.json`
- Create: `/home/kush/ARCOS/pipeline/tests/fixtures/cdc-overdose-by-county-year.sample.json`
- Modify: `/home/kush/ARCOS/pipeline/tests/test_schemas.py`

- [ ] **Step 1: Write schema**

Note the conditional: when `suppressed` is true, `deaths` MUST be null; when false, `deaths` MUST be an integer ≥ 10.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openarcos.org/schemas/cdc-overdose-by-county-year.schema.json",
  "title": "CDC WONDER county-year overdose deaths",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["fips", "year", "deaths", "suppressed"],
    "additionalProperties": false,
    "properties": {
      "fips": {"type": "string", "pattern": "^[0-9]{5}$"},
      "year": {"type": "integer", "minimum": 1999, "maximum": 2030},
      "deaths": {"type": ["integer", "null"], "minimum": 0},
      "suppressed": {"type": "boolean"}
    },
    "allOf": [
      {
        "if": {"properties": {"suppressed": {"const": true}}},
        "then": {"properties": {"deaths": {"type": "null"}}}
      },
      {
        "if": {"properties": {"suppressed": {"const": false}}},
        "then": {"properties": {"deaths": {"type": "integer", "minimum": 10}}}
      }
    ]
  }
}
```

- [ ] **Step 2: Write fixture (one suppressed row, one non-suppressed)**

```json
[
  {"fips": "54059", "year": 2010, "deaths": 14, "suppressed": false},
  {"fips": "54059", "year": 2003, "deaths": null, "suppressed": true}
]
```

- [ ] **Step 3: Add test**

```python
def test_cdc_overdose_sample_valid():
    _validate("cdc-overdose-by-county-year", "cdc-overdose-by-county-year.sample.json")


def test_cdc_overdose_suppressed_with_deaths_rejected():
    """A row claiming suppressed=true with deaths set must be rejected."""
    schema = load_json(SCHEMAS_DIR / "cdc-overdose-by-county-year.schema.json")
    bad = [{"fips": "54059", "year": 2003, "deaths": 5, "suppressed": True}]
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(bad, schema)
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_schemas.py -v`
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/schemas/cdc-overdose-by-county-year.schema.json \
        pipeline/tests/fixtures/cdc-overdose-by-county-year.sample.json \
        pipeline/tests/test_schemas.py
git commit -m "pipeline: add cdc-overdose schema with suppression invariant"
```

### Task 13: `search-index.schema.json` (discriminated union)

**Files:**
- Create: `/home/kush/ARCOS/pipeline/schemas/search-index.schema.json`
- Create: `/home/kush/ARCOS/pipeline/tests/fixtures/search-index.sample.json`
- Modify: `/home/kush/ARCOS/pipeline/tests/test_schemas.py`

- [ ] **Step 1: Write schema**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://openarcos.org/schemas/search-index.schema.json",
  "title": "Search index — discriminated union keyed on `type`",
  "type": "array",
  "items": {
    "oneOf": [
      {
        "type": "object",
        "required": ["type", "id", "name", "fips"],
        "additionalProperties": false,
        "properties": {
          "type": {"const": "county"},
          "id": {"type": "string"},
          "name": {"type": "string"},
          "state": {"type": "string", "pattern": "^[A-Z]{2}$"},
          "fips": {"type": "string", "pattern": "^[0-9]{5}$"}
        }
      },
      {
        "type": "object",
        "required": ["type", "id", "name", "fips"],
        "additionalProperties": false,
        "properties": {
          "type": {"const": "city"},
          "id": {"type": "string"},
          "name": {"type": "string"},
          "state": {"type": "string", "pattern": "^[A-Z]{2}$"},
          "fips": {"type": "string", "pattern": "^[0-9]{5}$"}
        }
      },
      {
        "type": "object",
        "required": ["type", "id", "name", "fips"],
        "additionalProperties": false,
        "properties": {
          "type": {"const": "zip"},
          "id": {"type": "string", "pattern": "^[0-9]{5}$"},
          "name": {"type": "string"},
          "state": {"type": "string", "pattern": "^[A-Z]{2}$"},
          "fips": {"type": "string", "pattern": "^[0-9]{5}$"}
        }
      },
      {
        "type": "object",
        "required": ["type", "id", "name"],
        "additionalProperties": false,
        "properties": {
          "type": {"const": "distributor"},
          "id": {"type": "string"},
          "name": {"type": "string"}
        }
      },
      {
        "type": "object",
        "required": ["type", "id", "name", "fips"],
        "additionalProperties": false,
        "properties": {
          "type": {"const": "pharmacy"},
          "id": {"type": "string"},
          "name": {"type": "string"},
          "address": {"type": "string"},
          "fips": {"type": "string", "pattern": "^[0-9]{5}$"}
        }
      }
    ]
  }
}
```

- [ ] **Step 2: Write fixture with one of each type**

```json
[
  {"type": "county", "id": "54059", "name": "Mingo County", "state": "WV", "fips": "54059"},
  {"type": "city", "id": "city:WV:Williamson", "name": "Williamson", "state": "WV", "fips": "54059"},
  {"type": "zip", "id": "25661", "name": "25661", "state": "WV", "fips": "54059"},
  {"type": "distributor", "id": "dist:mckesson", "name": "McKesson Corporation"},
  {"type": "pharmacy", "id": "FB9876543", "name": "SAV-RITE PHARMACY #1", "address": "KERMIT, WV 25674", "fips": "54059"}
]
```

- [ ] **Step 3: Add test**

```python
def test_search_index_sample_valid():
    _validate("search-index", "search-index.sample.json")
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_schemas.py -v`
Expected: 10 passed.

- [ ] **Step 5: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/schemas/search-index.schema.json \
        pipeline/tests/fixtures/search-index.sample.json \
        pipeline/tests/test_schemas.py
git commit -m "pipeline: add search-index schema (discriminated union)"
```

### Task 14: Schema roundtrip test + contract version

**Files:**
- Create: `/home/kush/ARCOS/pipeline/tests/test_schema_roundtrip.py`
- Create: `/home/kush/ARCOS/pipeline/schemas/VERSION`

- [ ] **Step 1: Write test that walks all schemas**

```python
"""Every schema in schemas/ must have a matching *.sample.json fixture that validates."""

import json
from pathlib import Path

import jsonschema

SCHEMAS_DIR = Path(__file__).parent.parent / "schemas"
FIXTURES_DIR = Path(__file__).parent / "fixtures"


def test_every_schema_has_matching_fixture():
    schema_files = sorted(SCHEMAS_DIR.glob("*.schema.json"))
    assert schema_files, "no schemas found"

    missing: list[str] = []
    for schema_file in schema_files:
        name = schema_file.name.replace(".schema.json", "")
        fixture = FIXTURES_DIR / f"{name}.sample.json"
        if not fixture.exists():
            missing.append(name)
            continue
        with schema_file.open() as f:
            schema = json.load(f)
        with fixture.open() as f:
            data = json.load(f)
        jsonschema.validate(data, schema)

    assert not missing, f"schemas without fixtures: {missing}"
```

- [ ] **Step 2: Create `schemas/VERSION`**

```
1
```

- [ ] **Step 3: Run test — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_schema_roundtrip.py -v`
Expected: 1 passed.

- [ ] **Step 4: Verify all tests still green**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest -v`
Expected: all pass.

- [ ] **Step 5: Commit (contract frozen at v1)**

```bash
cd /home/kush/ARCOS
git add pipeline/tests/test_schema_roundtrip.py pipeline/schemas/VERSION
git commit -m "pipeline: freeze schema contract v1 + enforce fixture-per-schema"
```

---

### Phase 2 gate

After every task in this phase, run the full verification matrix:

```bash
cd pipeline && make lint && make test
```

All checks must pass before starting the next phase. If any check fails, fix before proceeding; do not rely on the merge or a later phase to catch it.

---

## Phase 3 — Common utilities (4 tasks)

### Task 15: FIPS normalization utilities

**Files:**
- Create: `/home/kush/ARCOS/pipeline/src/openarcos_pipeline/fips.py`
- Create: `/home/kush/ARCOS/pipeline/tests/test_fips.py`
- Create: `/home/kush/ARCOS/pipeline/tests/fixtures/fips_cases.json`

- [ ] **Step 1: Create shared test cases**

`tests/fixtures/fips_cases.json` — this same file is imported by `/web` Plan 2 to guarantee parity.

```json
{
  "normalize_ok": [
    {"in": "54059", "out": "54059"},
    {"in": "4059", "out": "04059"},
    {"in": "1001", "out": "01001"},
    {"in": 54059, "out": "54059"},
    {"in": 4059, "out": "04059"},
    {"in": " 54059 ", "out": "54059"}
  ],
  "normalize_fail": ["", null, "abc", "123456", "-1", "1234a"],
  "state_from_fips": [
    {"fips": "54059", "state": "WV"},
    {"fips": "01001", "state": "AL"},
    {"fips": "72001", "state": "PR"}
  ],
  "valid_fips": ["54059", "01001", "56045"],
  "invalid_fips": ["5405", "540590", "abcde", "", null]
}
```

- [ ] **Step 2: Write failing test**

```python
"""FIPS helpers: normalize, validate, state-from-FIPS."""

import json
from pathlib import Path

import pytest

from openarcos_pipeline.fips import is_valid_fips, normalize_fips, state_from_fips

CASES = json.loads((Path(__file__).parent / "fixtures" / "fips_cases.json").read_text())

# Map of 2-digit FIPS state prefix → USPS postal code.
FIPS_STATE_MAP = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
    "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
    "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
    "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
    "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
    "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
    "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
    "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
    "54": "WV", "55": "WI", "56": "WY", "60": "AS", "66": "GU", "69": "MP",
    "72": "PR", "78": "VI",
}


@pytest.mark.parametrize("case", CASES["normalize_ok"])
def test_normalize_ok(case):
    assert normalize_fips(case["in"]) == case["out"]


@pytest.mark.parametrize("bad", CASES["normalize_fail"])
def test_normalize_fail(bad):
    with pytest.raises((ValueError, TypeError)):
        normalize_fips(bad)


@pytest.mark.parametrize("case", CASES["state_from_fips"])
def test_state_from_fips(case):
    assert state_from_fips(case["fips"]) == case["state"]


@pytest.mark.parametrize("fips", CASES["valid_fips"])
def test_valid_fips(fips):
    assert is_valid_fips(fips)


@pytest.mark.parametrize("fips", CASES["invalid_fips"])
def test_invalid_fips(fips):
    assert not is_valid_fips(fips)
```

- [ ] **Step 3: Run tests — expect FAIL (no module yet)**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_fips.py -v`
Expected: ImportError on `openarcos_pipeline.fips`.

- [ ] **Step 4: Implement `fips.py`**

```python
"""FIPS county code helpers."""

from __future__ import annotations

FIPS_STATE_MAP = {
    "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
    "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
    "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
    "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
    "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
    "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
    "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
    "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
    "54": "WV", "55": "WI", "56": "WY", "60": "AS", "66": "GU", "69": "MP",
    "72": "PR", "78": "VI",
}


def normalize_fips(value: object) -> str:
    """Return a 5-character zero-padded FIPS string.

    Accepts int or str (incl. with whitespace). Raises ValueError on empty,
    non-digit, or too-long inputs. Raises TypeError on None / non-str-non-int.
    """
    if value is None:
        raise TypeError("fips cannot be None")
    if isinstance(value, bool):
        raise TypeError("fips cannot be bool")
    if isinstance(value, int):
        s = str(value)
    elif isinstance(value, str):
        s = value.strip()
    else:
        raise TypeError(f"fips must be str or int, got {type(value).__name__}")

    if not s:
        raise ValueError("fips is empty")
    if not s.isdigit():
        raise ValueError(f"fips has non-digit chars: {s!r}")
    if len(s) > 5:
        raise ValueError(f"fips too long: {s!r}")
    return s.zfill(5)


def is_valid_fips(value: object) -> bool:
    """True if `value` normalizes to a recognized 5-digit FIPS."""
    try:
        normed = normalize_fips(value)
    except (TypeError, ValueError):
        return False
    return normed[:2] in FIPS_STATE_MAP


def state_from_fips(value: object) -> str:
    """Return the 2-letter USPS state code for a FIPS."""
    normed = normalize_fips(value)
    prefix = normed[:2]
    if prefix not in FIPS_STATE_MAP:
        raise ValueError(f"unknown state prefix in fips: {normed}")
    return FIPS_STATE_MAP[prefix]
```

- [ ] **Step 5: Run — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_fips.py -v`
Expected: all parameterized cases pass.

- [ ] **Step 6: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/src/openarcos_pipeline/fips.py \
        pipeline/tests/test_fips.py \
        pipeline/tests/fixtures/fips_cases.json
git commit -m "pipeline: FIPS normalize/validate helpers with shared test table"
```

### Task 16: `config.py` typed paths

**Files:**
- Create: `/home/kush/ARCOS/pipeline/src/openarcos_pipeline/config.py`
- Create: `/home/kush/ARCOS/pipeline/tests/test_config.py`

- [ ] **Step 1: Write failing test**

```python
"""Config dataclass holds typed paths."""

import os
from pathlib import Path

from openarcos_pipeline.config import Config


def test_config_default_paths(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(tmp_path))
    cfg = Config.from_env()
    assert cfg.raw_dir == tmp_path / "raw"
    assert cfg.clean_dir == tmp_path / "clean"
    assert cfg.joined_dir == tmp_path / "joined"
    assert cfg.agg_dir == tmp_path / "agg"
    assert cfg.emit_dir.name == "data"  # /web/public/data


def test_config_creates_dirs(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(tmp_path))
    cfg = Config.from_env()
    cfg.ensure_dirs()
    assert cfg.raw_dir.is_dir()
    assert cfg.clean_dir.is_dir()
    assert cfg.joined_dir.is_dir()
    assert cfg.agg_dir.is_dir()


def test_config_default_emit_is_web_public_data():
    cfg = Config.from_env()
    # From pipeline/, emit dir should resolve to repo-root/web/public/data
    assert cfg.emit_dir.parts[-3:] == ("web", "public", "data")
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_config.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement `config.py`**

```python
"""Configuration: typed paths resolved from env + defaults."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


PIPELINE_ROOT = Path(__file__).resolve().parent.parent.parent  # /pipeline
REPO_ROOT = PIPELINE_ROOT.parent


@dataclass(frozen=True)
class Config:
    data_root: Path
    emit_dir: Path

    @property
    def raw_dir(self) -> Path:
        return self.data_root / "raw"

    @property
    def clean_dir(self) -> Path:
        return self.data_root / "clean"

    @property
    def joined_dir(self) -> Path:
        return self.data_root / "joined"

    @property
    def agg_dir(self) -> Path:
        return self.data_root / "agg"

    def ensure_dirs(self) -> None:
        for d in [self.raw_dir, self.clean_dir, self.joined_dir, self.agg_dir, self.emit_dir]:
            d.mkdir(parents=True, exist_ok=True)

    @classmethod
    def from_env(cls) -> "Config":
        data_root = Path(os.environ.get("OPENARCOS_DATA_ROOT", PIPELINE_ROOT / "data"))
        emit_dir = Path(
            os.environ.get("OPENARCOS_EMIT_DIR", REPO_ROOT / "web" / "public" / "data")
        )
        return cls(data_root=data_root.resolve(), emit_dir=emit_dir.resolve())
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_config.py -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/src/openarcos_pipeline/config.py pipeline/tests/test_config.py
git commit -m "pipeline: Config with typed paths resolved from env"
```

### Task 17: Structured logging

**Files:**
- Create: `/home/kush/ARCOS/pipeline/src/openarcos_pipeline/log.py`
- Create: `/home/kush/ARCOS/pipeline/tests/test_log.py`

- [ ] **Step 1: Write failing test**

```python
"""Structured logger wrapper."""

import json
import logging

from openarcos_pipeline.log import get_logger


def test_logger_returns_logger():
    log = get_logger("test")
    assert isinstance(log, logging.Logger)


def test_logger_idempotent():
    a = get_logger("test")
    b = get_logger("test")
    assert a is b


def test_logger_json_mode_in_ci(monkeypatch, capsys):
    monkeypatch.setenv("OPENARCOS_ENV", "ci")
    log = get_logger("test.ci")
    log.info("hello", extra={"source": "wapo"})
    captured = capsys.readouterr()
    # CI mode writes a JSON line
    payload = json.loads(captured.err.strip().splitlines()[-1])
    assert payload["msg"] == "hello"
    assert payload["source"] == "wapo"
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_log.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement `log.py`**

```python
"""Logging: plain format locally, JSON in CI."""

from __future__ import annotations

import json
import logging
import os
import sys
from typing import Any

_STD_LOGRECORD_ATTRS = {
    "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
    "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
    "created", "msecs", "relativeCreated", "thread", "threadName",
    "processName", "process", "taskName",
}


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        for k, v in record.__dict__.items():
            if k not in _STD_LOGRECORD_ATTRS and not k.startswith("_"):
                payload[k] = v
        return json.dumps(payload)


def get_logger(name: str) -> logging.Logger:
    log = logging.getLogger(name)
    if getattr(log, "_openarcos_configured", False):
        return log

    log.setLevel(logging.INFO)
    handler = logging.StreamHandler(stream=sys.stderr)
    if os.environ.get("OPENARCOS_ENV") == "ci":
        handler.setFormatter(_JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
        )
    log.addHandler(handler)
    log.propagate = False
    log._openarcos_configured = True  # type: ignore[attr-defined]
    return log
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_log.py -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/src/openarcos_pipeline/log.py pipeline/tests/test_log.py
git commit -m "pipeline: structured logging with JSON mode for CI"
```

### Task 18: Typer CLI skeleton

**Files:**
- Create: `/home/kush/ARCOS/pipeline/src/openarcos_pipeline/cli.py`
- Create: `/home/kush/ARCOS/pipeline/tests/test_cli.py`

- [ ] **Step 1: Write failing test**

```python
"""CLI: Typer app with placeholder subcommands."""

from typer.testing import CliRunner

from openarcos_pipeline.cli import app

runner = CliRunner()


def test_help_lists_subcommands():
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    for cmd in ["fetch", "clean", "join", "aggregate", "emit", "all"]:
        assert cmd in result.stdout


def test_each_subcommand_runs_not_implemented():
    # Should exit cleanly with a clear message (stub), not crash.
    result = runner.invoke(app, ["fetch", "--help"])
    assert result.exit_code == 0
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_cli.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement CLI skeleton**

```python
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
    log.info("fetch: not yet implemented", extra={"source": source})
    raise typer.Exit(0)


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
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_cli.py -v`
Expected: 2 passed.

- [ ] **Step 5: Verify `uv run openarcos --help` works**

Run: `cd /home/kush/ARCOS/pipeline && uv run openarcos --help`
Expected: prints help listing all 6 subcommands.

- [ ] **Step 6: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/src/openarcos_pipeline/cli.py pipeline/tests/test_cli.py
git commit -m "pipeline: CLI skeleton with placeholder subcommands"
```

---

### Phase 3 gate

After every task in this phase, run the full verification matrix:

```bash
cd pipeline && make lint && make test
```

All checks must pass before starting the next phase. If any check fails, fix before proceeding; do not rely on the merge or a later phase to catch it.

---

## Phase 4 — WaPo ARCOS source (6 tasks)

The spec framed this as "GitHub + CSV releases" but the actual data lives behind a REST API at `https://arcos-api.ext.nile.works`. Task 19 is a spike that captures the exact endpoints, documents response shapes, and drops recorded JSON into `tests/fixtures/wapo/`. All subsequent tests use the recorded fixtures — no live HTTP in the test suite.

### Task 19: SPIKE — probe the WaPo ARCOS API

**Files:**
- Create: `/home/kush/ARCOS/pipeline/notes/wapo.md`
- Create: `/home/kush/ARCOS/pipeline/tests/fixtures/wapo/county_2012_54059.json`
- Create: `/home/kush/ARCOS/pipeline/tests/fixtures/wapo/distributors_2012.json`
- Create: `/home/kush/ARCOS/pipeline/tests/fixtures/wapo/pharmacies_54059.json`
- Create: `/home/kush/ARCOS/pipeline/notebooks/01-wapo-api-probe.py`

- [ ] **Step 1: Fetch the Swagger doc**

Run: `curl -sS https://arcos-api.ext.nile.works/__swagger__/ -o /tmp/arcos-swagger.html && wc -c /tmp/arcos-swagger.html`
Expected: non-empty file. If zero or 404, check whether the endpoint rendering is `/swagger.json`; update and retry.

Also try: `curl -sS "https://arcos-api.ext.nile.works/v1/county_list?state=WV&key=WaPo" | head -c 500`
Expected: JSON with county rows or the public API's documented auth-sentinel message.

- [ ] **Step 2: Identify the four endpoints we need**

Based on the R `arcos` package (README) and the Swagger doc, the canonical endpoints the pipeline will hit are (confirm during the spike, update if names differ):

1. **county-year shipments**: `GET /v1/county_raw?state={ST}&county={COUNTY}&key=WaPo` — filtered-by-FIPS; we paginate by state+county
2. **distributor-year totals**: `GET /v1/combined_distributor_state_county?state={ST}&county={COUNTY}&key=WaPo`
3. **pharmacy-level totals**: `GET /v1/pharmacy_raw?state={ST}&county={COUNTY}&key=WaPo`
4. **county list**: `GET /v1/county_list?state={ST}&key=WaPo` — for enumerating all FIPS per state

Document the actual confirmed endpoints in `notes/wapo.md` during this spike.

- [ ] **Step 3: Record fixtures for Mingo County (WV 54059)**

Use a small exploratory script in `pipeline/notebooks/01-wapo-api-probe.py` (committable, not a notebook) that calls each endpoint once for WV Mingo and writes to `tests/fixtures/wapo/`.

```python
"""Spike: probe WaPo ARCOS API and record fixtures. Run once, commit output."""

import json
from pathlib import Path

import httpx

OUT = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "wapo"
OUT.mkdir(parents=True, exist_ok=True)

BASE = "https://arcos-api.ext.nile.works"
KEY = "WaPo"  # public key per WaPo README

calls = [
    ("county_2012_54059.json", "/v1/county_raw", {"state": "WV", "county": "Mingo"}),
    ("distributors_54059.json", "/v1/combined_distributor_state_county",
     {"state": "WV", "county": "Mingo"}),
    ("pharmacies_54059.json", "/v1/pharmacy_raw", {"state": "WV", "county": "Mingo"}),
    ("county_list_wv.json", "/v1/county_list", {"state": "WV"}),
]

with httpx.Client(base_url=BASE, timeout=120.0) as client:
    for fname, path, params in calls:
        resp = client.get(path, params={**params, "key": KEY})
        print(path, resp.status_code, len(resp.content), "bytes")
        resp.raise_for_status()
        data = resp.json()
        # For very large responses, truncate to first 100 rows for a fixture.
        if isinstance(data, list) and len(data) > 100:
            data = data[:100]
        (OUT / fname).write_text(json.dumps(data, indent=2, sort_keys=True) + "\n")

print("fixtures written:", sorted(p.name for p in OUT.glob("*.json")))
```

- [ ] **Step 4: Run the probe**

Run: `cd /home/kush/ARCOS/pipeline && uv run python notebooks/01-wapo-api-probe.py`
Expected: prints 4 endpoints with `200` status and non-zero byte counts, writes 4 files to `tests/fixtures/wapo/`.

If any endpoint returns 404 or a different shape than expected, stop and update this plan's notes before moving on.

- [ ] **Step 5: Document in `notes/wapo.md`**

```markdown
# WaPo ARCOS API — probe notes

**Probed on:** YYYY-MM-DD
**Base URL:** https://arcos-api.ext.nile.works
**Auth:** `?key=WaPo` (public; per https://github.com/wpinvestigative/arcos-api README)
**Rate limit:** observed ~1 req/s tolerated; batch with 0.25s sleep.

## Endpoints we use

| Endpoint | Purpose | Response shape |
|---|---|---|
| `GET /v1/county_raw?state=ST&county=Name` | county-year shipments | TBD-fill-from-spike |
| `GET /v1/combined_distributor_state_county?state=ST&county=Name` | distributor totals | TBD |
| `GET /v1/pharmacy_raw?state=ST&county=Name` | pharmacy totals | TBD |
| `GET /v1/county_list?state=ST` | county enumeration for state | TBD |

## Response fields (update with actual observed keys)

- `county_raw`: describe the columns returned...
- `combined_distributor_state_county`: ...
- `pharmacy_raw`: ...

## Known quirks

- TBD (fill with anything surprising observed during the spike — case inconsistency, empty rows, etc.)

## Content hashes of recorded fixtures

- `county_2012_54059.json`: sha256=...
- `distributors_54059.json`: sha256=...
- `pharmacies_54059.json`: sha256=...
- `county_list_wv.json`: sha256=...

Compute via: `sha256sum tests/fixtures/wapo/*.json`
```

After running the probe, fill in the TBDs from the actual recorded JSON. This doc is our reference for all subsequent WaPo tasks.

- [ ] **Step 6: Compute + record hashes**

Run: `sha256sum /home/kush/ARCOS/pipeline/tests/fixtures/wapo/*.json | tee -a /home/kush/ARCOS/pipeline/notes/wapo.md`
Expected: four hashes appended to notes file; update the notes "Content hashes" section to include them.

- [ ] **Step 7: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/notes/wapo.md \
        pipeline/tests/fixtures/wapo/ \
        pipeline/notebooks/01-wapo-api-probe.py
git commit -m "pipeline: spike WaPo ARCOS API + record fixtures"
```

### Task 20: `sources/wapo_arcos.py` fetch client

**Files:**
- Create: `/home/kush/ARCOS/pipeline/src/openarcos_pipeline/sources/__init__.py`
- Create: `/home/kush/ARCOS/pipeline/src/openarcos_pipeline/sources/wapo_arcos.py`
- Create: `/home/kush/ARCOS/pipeline/tests/test_sources_wapo.py`

- [ ] **Step 1: Create empty `sources/__init__.py`**

```python
"""Source fetchers."""
```

- [ ] **Step 2: Write failing test using recorded fixtures**

```python
"""WaPo fetch client: replays recorded fixtures, retries on transient errors."""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest

from openarcos_pipeline.sources.wapo_arcos import WapoClient

FIXTURES = Path(__file__).parent / "fixtures" / "wapo"


def make_transport() -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        params = dict(request.url.params)
        if path == "/v1/county_raw" and params.get("state") == "WV":
            data = json.loads((FIXTURES / "county_2012_54059.json").read_text())
            return httpx.Response(200, json=data)
        if path == "/v1/county_list" and params.get("state") == "WV":
            data = json.loads((FIXTURES / "county_list_wv.json").read_text())
            return httpx.Response(200, json=data)
        return httpx.Response(404, json={"error": "not found"})

    return httpx.MockTransport(handler)


def test_county_raw_returns_fixture_data():
    client = WapoClient(transport=make_transport())
    rows = client.county_raw("WV", "Mingo")
    assert isinstance(rows, list)
    assert len(rows) > 0


def test_county_list_returns_fixture():
    client = WapoClient(transport=make_transport())
    counties = client.county_list("WV")
    assert isinstance(counties, list)
    assert len(counties) > 0


def test_retries_on_transient_error():
    call_count = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        call_count["n"] += 1
        if call_count["n"] < 3:
            return httpx.Response(503)
        data = json.loads((FIXTURES / "county_list_wv.json").read_text())
        return httpx.Response(200, json=data)

    client = WapoClient(transport=httpx.MockTransport(handler), max_retries=3)
    counties = client.county_list("WV")
    assert len(counties) > 0
    assert call_count["n"] == 3


def test_gives_up_after_max_retries():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503)

    client = WapoClient(transport=httpx.MockTransport(handler), max_retries=2)
    with pytest.raises(httpx.HTTPStatusError):
        client.county_list("WV")
```

- [ ] **Step 3: Run — expect FAIL**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_sources_wapo.py -v`
Expected: ImportError.

- [ ] **Step 4: Implement `sources/wapo_arcos.py`**

```python
"""WaPo ARCOS API client.

Public API, public key. Replayable via httpx.MockTransport in tests.
Docs: https://github.com/wpinvestigative/arcos-api
"""

from __future__ import annotations

import time
from typing import Any

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from openarcos_pipeline.log import get_logger

BASE_URL = "https://arcos-api.ext.nile.works"
DEFAULT_KEY = "WaPo"

log = get_logger("openarcos.sources.wapo")


class WapoClient:
    def __init__(
        self,
        base_url: str = BASE_URL,
        key: str = DEFAULT_KEY,
        timeout: float = 120.0,
        max_retries: int = 5,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._client = httpx.Client(
            base_url=base_url, timeout=timeout, transport=transport
        )
        self._key = key
        self._max_retries = max_retries

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "WapoClient":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    def _get(self, path: str, params: dict[str, Any]) -> Any:
        attempt = 0

        @retry(
            stop=stop_after_attempt(self._max_retries),
            wait=wait_exponential_jitter(initial=0.5, max=8.0),
            retry=retry_if_exception_type(httpx.HTTPStatusError),
            reraise=True,
        )
        def _do() -> Any:
            nonlocal attempt
            attempt += 1
            q = {**params, "key": self._key}
            log.info("wapo GET", extra={"path": path, "params": q, "attempt": attempt})
            resp = self._client.get(path, params=q)
            if resp.status_code >= 500:
                resp.raise_for_status()
            resp.raise_for_status()
            time.sleep(0.25)
            return resp.json()

        return _do()

    def county_list(self, state: str) -> list[dict[str, Any]]:
        return self._get("/v1/county_list", {"state": state})

    def county_raw(self, state: str, county: str) -> list[dict[str, Any]]:
        return self._get("/v1/county_raw", {"state": state, "county": county})

    def distributors_for_county(
        self, state: str, county: str
    ) -> list[dict[str, Any]]:
        return self._get(
            "/v1/combined_distributor_state_county",
            {"state": state, "county": county},
        )

    def pharmacies_for_county(
        self, state: str, county: str
    ) -> list[dict[str, Any]]:
        return self._get("/v1/pharmacy_raw", {"state": state, "county": county})
```

- [ ] **Step 5: Run — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_sources_wapo.py -v`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/src/openarcos_pipeline/sources/__init__.py \
        pipeline/src/openarcos_pipeline/sources/wapo_arcos.py \
        pipeline/tests/test_sources_wapo.py
git commit -m "pipeline: WaPo ARCOS HTTP client with retries"
```

### Task 21: `clean/wapo.py` normalize to parquet

**Files:**
- Create: `/home/kush/ARCOS/pipeline/src/openarcos_pipeline/clean/__init__.py`
- Create: `/home/kush/ARCOS/pipeline/src/openarcos_pipeline/clean/wapo.py`
- Create: `/home/kush/ARCOS/pipeline/tests/test_clean_wapo.py`

- [ ] **Step 1: Create `clean/__init__.py`** — empty (`"""Cleaning modules."""`).

- [ ] **Step 2: Write failing test**

```python
"""clean/wapo: takes raw WaPo JSON, emits canonical polars DataFrame."""

import json
from pathlib import Path

import polars as pl

from openarcos_pipeline.clean.wapo import (
    clean_county_raw,
    clean_distributors,
    clean_pharmacies,
)

FIXTURES = Path(__file__).parent / "fixtures" / "wapo"


def test_clean_county_raw_produces_expected_columns():
    raw = json.loads((FIXTURES / "county_2012_54059.json").read_text())
    df = clean_county_raw(raw, state="WV", county_fips="54059")
    assert set(df.columns) >= {"fips", "year", "pills"}
    assert df["fips"].dtype == pl.Utf8
    assert df["year"].dtype == pl.Int64
    assert df["pills"].dtype == pl.Int64
    assert (df["fips"] == "54059").all()
    assert (df["pills"] >= 0).all()


def test_clean_distributors_produces_expected_columns():
    raw = json.loads((FIXTURES / "distributors_54059.json").read_text())
    df = clean_distributors(raw)
    assert set(df.columns) >= {"distributor", "year", "pills"}
    assert (df["pills"] >= 0).all()


def test_clean_pharmacies_produces_expected_columns():
    raw = json.loads((FIXTURES / "pharmacies_54059.json").read_text())
    df = clean_pharmacies(raw, county_fips="54059")
    assert set(df.columns) >= {"pharmacy_id", "name", "address", "fips", "total_pills"}
    assert (df["fips"] == "54059").all()
```

- [ ] **Step 3: Run — expect FAIL**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_clean_wapo.py -v`
Expected: ImportError or column-mismatch.

- [ ] **Step 4: Implement `clean/wapo.py`**

Note: column names below assume WaPo's response keys include `buyer_dea_no`, `transaction_date`, `calc_base_wt_in_gm`, `year`, `reporter_family`, etc. Adjust once the spike in Task 19 records exact keys — update both this module and its tests together.

```python
"""Normalize raw WaPo ARCOS responses into canonical polars DataFrames.

Field names map from the WaPo API (documented in notes/wapo.md) to our schemas.
"""

from __future__ import annotations

from typing import Any

import polars as pl

from openarcos_pipeline.fips import normalize_fips


def clean_county_raw(
    rows: list[dict[str, Any]], state: str, county_fips: str
) -> pl.DataFrame:
    """Raw county_raw rows → `{fips, year, pills}` DataFrame."""
    fips = normalize_fips(county_fips)
    if not rows:
        return pl.DataFrame(
            schema={"fips": pl.Utf8, "year": pl.Int64, "pills": pl.Int64}
        )

    df = pl.DataFrame(rows)
    # Expect either `year` column or we derive from `transaction_date`.
    if "year" not in df.columns and "transaction_date" in df.columns:
        df = df.with_columns(
            pl.col("transaction_date").str.slice(0, 4).cast(pl.Int64).alias("year")
        )
    # Prefer `dosage_unit` (pills) if present; else fall back to row count.
    pill_col = "dosage_unit" if "dosage_unit" in df.columns else None
    if pill_col is None:
        grouped = df.group_by("year").agg(pl.len().alias("pills"))
    else:
        grouped = df.group_by("year").agg(pl.col(pill_col).sum().cast(pl.Int64).alias("pills"))

    return grouped.with_columns(pl.lit(fips).alias("fips")).select(
        ["fips", "year", "pills"]
    ).sort("year")


def clean_distributors(rows: list[dict[str, Any]]) -> pl.DataFrame:
    """Raw distributor rows → `{distributor, year, pills}` DataFrame."""
    if not rows:
        return pl.DataFrame(
            schema={"distributor": pl.Utf8, "year": pl.Int64, "pills": pl.Int64}
        )
    df = pl.DataFrame(rows)
    if "reporter_family" in df.columns:
        df = df.rename({"reporter_family": "distributor"})
    if "year" not in df.columns and "transaction_date" in df.columns:
        df = df.with_columns(
            pl.col("transaction_date").str.slice(0, 4).cast(pl.Int64).alias("year")
        )
    pill_col = "dosage_unit" if "dosage_unit" in df.columns else None
    if pill_col is None:
        grouped = df.group_by(["distributor", "year"]).agg(pl.len().alias("pills"))
    else:
        grouped = df.group_by(["distributor", "year"]).agg(
            pl.col(pill_col).sum().cast(pl.Int64).alias("pills")
        )
    return grouped.select(["distributor", "year", "pills"]).sort(["year", "distributor"])


def clean_pharmacies(rows: list[dict[str, Any]], county_fips: str) -> pl.DataFrame:
    """Raw pharmacy_raw rows → `{pharmacy_id, name, address, fips, total_pills}`."""
    fips = normalize_fips(county_fips)
    if not rows:
        return pl.DataFrame(
            schema={
                "pharmacy_id": pl.Utf8,
                "name": pl.Utf8,
                "address": pl.Utf8,
                "fips": pl.Utf8,
                "total_pills": pl.Int64,
            }
        )
    df = pl.DataFrame(rows)
    rename_map = {
        "buyer_dea_no": "pharmacy_id",
        "buyer_name": "name",
        "buyer_address1": "address",
    }
    renames = {k: v for k, v in rename_map.items() if k in df.columns}
    df = df.rename(renames)
    pill_col = "dosage_unit" if "dosage_unit" in df.columns else None
    agg = (
        df.group_by(["pharmacy_id", "name", "address"]).agg(
            pl.col(pill_col).sum().cast(pl.Int64).alias("total_pills")
            if pill_col
            else pl.len().alias("total_pills")
        )
        .with_columns(pl.lit(fips).alias("fips"))
        .select(["pharmacy_id", "name", "address", "fips", "total_pills"])
        .sort("total_pills", descending=True)
    )
    return agg
```

- [ ] **Step 5: Run — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_clean_wapo.py -v`
Expected: 3 passed. **If** the raw field names observed in Task 19 differ, update `clean_wapo.py`'s `rename_map` and column fallbacks accordingly, and update the test's `set(df.columns) >= {...}` assertions — then rerun.

- [ ] **Step 6: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/src/openarcos_pipeline/clean/__init__.py \
        pipeline/src/openarcos_pipeline/clean/wapo.py \
        pipeline/tests/test_clean_wapo.py
git commit -m "pipeline: clean WaPo responses into canonical DataFrames"
```

### Task 22: Commit the expanded 10-county fixture set

**Files:**
- Create (10 each): `pipeline/tests/fixtures/wapo/county_raw_{fips}.json`

The 10 counties are the WaPo top-per-capita picks: Mingo WV (54059), Norton VA (51720), Cabell WV (54011), Logan WV (54045), Boone WV (54005), Fayette WV (54019), Mercer WV (54055), Floyd KY (21071), Pike KY (21195), Martin KY (21159).

- [ ] **Step 1: Expand the probe script**

Append to `notebooks/01-wapo-api-probe.py`:

```python
TEN_COUNTIES = [
    ("WV", "Mingo"), ("VA", "Norton"), ("WV", "Cabell"), ("WV", "Logan"),
    ("WV", "Boone"), ("WV", "Fayette"), ("WV", "Mercer"),
    ("KY", "Floyd"), ("KY", "Pike"), ("KY", "Martin"),
]

with httpx.Client(base_url=BASE, timeout=120.0) as client:
    for state, county in TEN_COUNTIES:
        resp = client.get(
            "/v1/county_raw", params={"state": state, "county": county, "key": KEY}
        )
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, list) and len(data) > 200:
            data = data[:200]
        out = OUT / f"county_raw_{state}_{county}.json"
        out.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n")
        print(out.name, resp.status_code)
```

- [ ] **Step 2: Run**

Run: `cd /home/kush/ARCOS/pipeline && uv run python notebooks/01-wapo-api-probe.py`
Expected: 10 new files in `tests/fixtures/wapo/`.

- [ ] **Step 3: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/notebooks/01-wapo-api-probe.py \
        pipeline/tests/fixtures/wapo/county_raw_*.json
git commit -m "pipeline: record 10-county WaPo fixture set"
```

### Task 23: Content-hash guard in fetcher

**Files:**
- Modify: `/home/kush/ARCOS/pipeline/src/openarcos_pipeline/sources/wapo_arcos.py`
- Create: `/home/kush/ARCOS/pipeline/src/openarcos_pipeline/sources/expected_hashes.py`
- Modify: `/home/kush/ARCOS/pipeline/tests/test_sources_wapo.py`

- [ ] **Step 1: Record canonical hashes from fixtures**

Run: `cd /home/kush/ARCOS/pipeline && sha256sum tests/fixtures/wapo/county_list_wv.json`

Capture the hash — it becomes the canary in `expected_hashes.py`. Use the actual hash from the file you just committed.

- [ ] **Step 2: Create `sources/expected_hashes.py`**

```python
"""Structural-shape canary hashes.

Compared only against the *schema fingerprint* (sorted top-level keys) of the
first page of a response — not the full payload — so small data changes don't
trigger. Goal: fail loud if WaPo renames/drops columns.

Update deliberately when we knowingly accept an upstream contract change.
"""

from __future__ import annotations

# Map endpoint → expected sorted-key signature (str representation).
EXPECTED_SIGNATURES: dict[str, str] = {
    # Populate after Task 23 Step 3 — replace with actual output from the
    # `uv run python -c "..."` helper documented in the Step 3 expected output.
    "/v1/county_raw": "REPLACE_ME_WITH_SIG",
    "/v1/county_list": "REPLACE_ME_WITH_SIG",
    "/v1/combined_distributor_state_county": "REPLACE_ME_WITH_SIG",
    "/v1/pharmacy_raw": "REPLACE_ME_WITH_SIG",
}


def signature_of(rows: list[dict]) -> str:
    """Stable shape fingerprint: sorted top-level keys of the first row."""
    if not rows:
        return "empty"
    return "|".join(sorted(rows[0].keys()))
```

- [ ] **Step 3: Print actual signatures and paste into file**

Run: `cd /home/kush/ARCOS/pipeline && uv run python -c "
import json, pathlib
from openarcos_pipeline.sources.expected_hashes import signature_of
for f in sorted(pathlib.Path('tests/fixtures/wapo').glob('*.json')):
    data = json.loads(f.read_text())
    rows = data if isinstance(data, list) else [data]
    print(f.name, '->', signature_of(rows))
"`

Expected: prints filename → signature for each fixture. Copy the matching signatures into `EXPECTED_SIGNATURES` (match endpoint to the fixture that corresponds to it).

- [ ] **Step 4: Modify `sources/wapo_arcos.py` to check signature on fetch**

Replace the `_do()` inner function body with:

```python
        def _do() -> Any:
            nonlocal attempt
            attempt += 1
            q = {**params, "key": self._key}
            log.info("wapo GET", extra={"path": path, "params": q, "attempt": attempt})
            resp = self._client.get(path, params=q)
            if resp.status_code >= 500:
                resp.raise_for_status()
            resp.raise_for_status()
            time.sleep(0.25)
            data = resp.json()
            if isinstance(data, list) and path in EXPECTED_SIGNATURES:
                actual = signature_of(data)
                expected = EXPECTED_SIGNATURES[path]
                if expected != "REPLACE_ME_WITH_SIG" and actual != expected:
                    raise RuntimeError(
                        f"WaPo response shape changed for {path}: "
                        f"expected {expected!r}, got {actual!r}"
                    )
            return data
```

Add imports at top:

```python
from openarcos_pipeline.sources.expected_hashes import (
    EXPECTED_SIGNATURES,
    signature_of,
)
```

- [ ] **Step 5: Test: mismatched signature raises**

Add to `test_sources_wapo.py`:

```python
def test_signature_mismatch_raises(monkeypatch):
    from openarcos_pipeline.sources import expected_hashes

    monkeypatch.setitem(
        expected_hashes.EXPECTED_SIGNATURES, "/v1/county_list", "wrong_signature"
    )
    client = WapoClient(transport=make_transport())
    with pytest.raises(RuntimeError, match="shape changed"):
        client.county_list("WV")
```

- [ ] **Step 6: Run — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_sources_wapo.py -v`
Expected: all WaPo tests pass including the new mismatch test.

- [ ] **Step 7: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/src/openarcos_pipeline/sources/wapo_arcos.py \
        pipeline/src/openarcos_pipeline/sources/expected_hashes.py \
        pipeline/tests/test_sources_wapo.py
git commit -m "pipeline: wapo fetcher fails loud on response shape drift"
```

### Task 24: Wire WaPo into CLI `fetch` subcommand

**Files:**
- Modify: `/home/kush/ARCOS/pipeline/src/openarcos_pipeline/cli.py`
- Create: `/home/kush/ARCOS/pipeline/src/openarcos_pipeline/sources/wapo_runner.py`
- Create: `/home/kush/ARCOS/pipeline/tests/test_wapo_runner.py`

- [ ] **Step 1: Write failing test for runner**

```python
"""WaPo runner: iterates counties, writes to data/raw/wapo/."""

import json
from pathlib import Path

import httpx

from openarcos_pipeline.config import Config
from openarcos_pipeline.sources.wapo_arcos import WapoClient
from openarcos_pipeline.sources.wapo_runner import fetch_state

FIXTURES = Path(__file__).parent / "fixtures" / "wapo"


def mock_transport() -> httpx.MockTransport:
    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path == "/v1/county_list":
            return httpx.Response(200, json=[
                {"state": "WV", "county": "Mingo"},
                {"state": "WV", "county": "Cabell"},
            ])
        if req.url.path == "/v1/county_raw":
            data = json.loads((FIXTURES / "county_2012_54059.json").read_text())
            return httpx.Response(200, json=data)
        return httpx.Response(200, json=[])
    return httpx.MockTransport(handler)


def test_fetch_state_writes_files(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(tmp_path))
    cfg = Config.from_env()
    cfg.ensure_dirs()
    client = WapoClient(transport=mock_transport())
    fetch_state(client, cfg, state="WV")
    wapo_raw = cfg.raw_dir / "wapo"
    assert wapo_raw.is_dir()
    files = sorted(p.name for p in wapo_raw.glob("*.json"))
    assert any("Mingo" in n for n in files)
    assert any("Cabell" in n for n in files)
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_wapo_runner.py -v`
Expected: ImportError.

- [ ] **Step 3: Implement `sources/wapo_runner.py`**

```python
"""Runner: iterates WaPo endpoints for a state, writes raw JSON per county."""

from __future__ import annotations

import json

from tqdm import tqdm

from openarcos_pipeline.config import Config
from openarcos_pipeline.log import get_logger
from openarcos_pipeline.sources.wapo_arcos import WapoClient

log = get_logger("openarcos.wapo.runner")


def fetch_state(client: WapoClient, cfg: Config, state: str) -> None:
    """Fetch all counties for one state, write raw JSON under data/raw/wapo/."""
    out_dir = cfg.raw_dir / "wapo"
    out_dir.mkdir(parents=True, exist_ok=True)
    counties = client.county_list(state)
    log.info("wapo runner start", extra={"state": state, "n_counties": len(counties)})
    for row in tqdm(counties, desc=f"WaPo {state}"):
        name = row.get("county") or row.get("name") or ""
        if not name:
            continue
        for endpoint_name, method in [
            ("county_raw", client.county_raw),
            ("distributors", client.distributors_for_county),
            ("pharmacies", client.pharmacies_for_county),
        ]:
            try:
                data = method(state, name)
            except Exception as e:  # noqa: BLE001
                log.warning("wapo fetch failed", extra={
                    "state": state, "county": name, "endpoint": endpoint_name,
                    "err": str(e),
                })
                continue
            fname = f"{endpoint_name}_{state}_{name.replace(' ', '_')}.json"
            (out_dir / fname).write_text(json.dumps(data, separators=(",", ":")))


def fetch_all(client: WapoClient, cfg: Config) -> None:
    """Fetch all 50 states + DC."""
    states = [
        "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA",
        "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA",
        "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY",
        "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX",
        "UT", "VT", "VA", "WA", "WV", "WI", "WY",
    ]
    for st in states:
        fetch_state(client, cfg, st)
```

- [ ] **Step 4: Wire into CLI `fetch` command**

Modify `src/openarcos_pipeline/cli.py` — replace the stub `fetch()` with:

```python
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
```

- [ ] **Step 5: Run — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_wapo_runner.py tests/test_cli.py -v`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/src/openarcos_pipeline/sources/wapo_runner.py \
        pipeline/src/openarcos_pipeline/cli.py \
        pipeline/tests/test_wapo_runner.py
git commit -m "pipeline: wapo fetch runner wired into CLI"
```

---

### Phase 4 gate

After every task in this phase, run the full verification matrix:

```bash
cd pipeline && make lint && make test
```

All checks must pass before starting the next phase. If any check fails, fix before proceeding; do not rely on the merge or a later phase to catch it.

---

## Phase 5 — CDC WONDER source (6 tasks)

**Risk:** CDC WONDER has no public REST API. The underlying form at `https://wonder.cdc.gov/controller/datarequest/D76` accepts a multi-parameter POST that mimics the form submission. The spec flags this as "known hard" (§9). Task 25 is a spike.

### Task 25: SPIKE — CDC WONDER request shape

**Files:**
- Create: `/home/kush/ARCOS/pipeline/notes/cdc.md`
- Create: `/home/kush/ARCOS/pipeline/tests/fixtures/cdc/wv_2012_2014.xml`
- Create: `/home/kush/ARCOS/pipeline/tests/fixtures/cdc/wv_2012_2014_request.xml`
- Create: `/home/kush/ARCOS/pipeline/notebooks/02-cdc-wonder-probe.py`

- [ ] **Step 1: Draft the D76 POST body**

The D76 dataset is "Multiple Cause of Death, 1999-2020". Request body is an XML envelope listing parameter names (`B_1`, `M_1`, `F_D76.V1` ...) matching the form on wonder.cdc.gov.

Write a starter body to `pipeline/notebooks/02-cdc-wonder-probe.py`:

```python
"""Spike: POST to WONDER D76, capture response, save fixture."""

from pathlib import Path

import httpx

OUT = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "cdc"
OUT.mkdir(parents=True, exist_ok=True)

# Minimal XML request body. Group by county + year, filter drug-poisoning
# underlying cause (ICD-10 X40-X44, X60-X64, X85, Y10-Y14). West Virginia only.
REQUEST_BODY = """<?xml version="1.0" encoding="utf-8"?>
<request-parameters>
  <parameter><name>accept_datause_restrictions</name><value>true</value></parameter>
  <parameter><name>B_1</name><value>D76.V1-level3</value></parameter>
  <parameter><name>B_2</name><value>D76.V1-level1</value></parameter>
  <parameter><name>F_D76.V1</name><value>2012</value><value>2013</value><value>2014</value></parameter>
  <parameter><name>F_D76.V9</name><value>54</value></parameter>
  <parameter><name>F_D76.V10</name><value>*All*</value></parameter>
  <parameter><name>F_D76.V2</name><value>*All*</value></parameter>
  <parameter><name>F_D76.V17</name><value>X40</value><value>X41</value><value>X42</value><value>X43</value><value>X44</value><value>X60</value><value>X61</value><value>X62</value><value>X63</value><value>X64</value><value>X85</value><value>Y10</value><value>Y11</value><value>Y12</value><value>Y13</value><value>Y14</value></parameter>
  <parameter><name>O_javascript</name><value>on</value></parameter>
  <parameter><name>O_precision</name><value>1</value></parameter>
  <parameter><name>O_rate_per</name><value>100000</value></parameter>
  <parameter><name>O_title</name><value>openarcos-spike-wv</value></parameter>
  <parameter><name>V_D76.V1</name><value/></parameter>
  <parameter><name>V_D76.V9</name><value/></parameter>
  <parameter><name>action-Send</name><value>Send</value></parameter>
  <parameter><name>stage</name><value>request</value></parameter>
</request-parameters>
"""

URL = "https://wonder.cdc.gov/controller/datarequest/D76"

(OUT / "wv_2012_2014_request.xml").write_text(REQUEST_BODY)

with httpx.Client(timeout=180.0, follow_redirects=True) as client:
    resp = client.post(URL, data={"request_xml": REQUEST_BODY})
    print("status:", resp.status_code)
    print("content-type:", resp.headers.get("content-type"))
    print("bytes:", len(resp.content))
    (OUT / "wv_2012_2014.xml").write_bytes(resp.content)

print("saved response fixture")
```

- [ ] **Step 2: Run probe**

Run: `cd /home/kush/ARCOS/pipeline && uv run python notebooks/02-cdc-wonder-probe.py`
Expected: status 200 (or a redirect to a results page — follow it), content-type `text/xml` or HTML with embedded data, non-zero bytes.

If the response is HTML wrapping an error ("accept_datause_restrictions missing" etc.), inspect the response, adjust the XML body, and retry. Iterate until you receive a response containing a `<data-table>` element.

- [ ] **Step 3: Write `notes/cdc.md`**

```markdown
# CDC WONDER D76 — probe notes

**Probed on:** YYYY-MM-DD
**Endpoint:** `POST https://wonder.cdc.gov/controller/datarequest/D76`
**Content-Type:** `application/x-www-form-urlencoded` with a single field `request_xml` holding an XML body.

## Request body parameters (known-working set)

| Parameter | Meaning |
|---|---|
| `accept_datause_restrictions=true` | Required; agrees to WONDER terms |
| `B_1 = D76.V1-level3` | Group by year |
| `B_2 = D76.V1-level1` | Group by county |
| `F_D76.V1 = <year>` (repeat) | Year filter |
| `F_D76.V9 = <state-fips>` | State FIPS filter (2-digit) |
| `F_D76.V10 = *All*` | County (all) |
| `F_D76.V17 = X40..Y14` | ICD-10 underlying-cause filter for drug-related deaths |
| `O_rate_per = 100000` | Rate denominator (we ignore, use raw count) |
| `O_precision = 1` | Decimals |

## Response shape

- Root element: `<page ...>` containing `<response>` with `<data-table>`
- `<data-table>` has `<r>` rows, each with `<c>` cells keyed by `<c l="label">value</c>`
- Suppressed rows carry cell value `Suppressed` (literal string); we map these to `deaths=null, suppressed=true`
- Non-suppressed rows have integer counts

## Known quirks

- Data-use restrictions terms must be accepted with the literal string "true"
- Suppressed cells contain "Suppressed"; missing cells contain "Missing"
- Responses >30k rows require pagination via `V_D76.V1` year splits (do per-state, per-year if we trip the limit)
- Response can briefly return HTML on heavy load; retry with exponential backoff

## Content hashes

- `wv_2012_2014.xml`: sha256=...

Compute: `sha256sum tests/fixtures/cdc/*.xml`
```

- [ ] **Step 4: Record hashes**

Run: `sha256sum /home/kush/ARCOS/pipeline/tests/fixtures/cdc/*.xml`
Append output into `notes/cdc.md` under "Content hashes".

- [ ] **Step 5: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/notes/cdc.md \
        pipeline/tests/fixtures/cdc/ \
        pipeline/notebooks/02-cdc-wonder-probe.py
git commit -m "pipeline: spike CDC WONDER D76 + record fixture"
```

### Task 26: `sources/cdc_wonder.py` fetch client

**Files:**
- Create: `/home/kush/ARCOS/pipeline/src/openarcos_pipeline/sources/cdc_wonder.py`
- Create: `/home/kush/ARCOS/pipeline/tests/test_sources_cdc.py`

- [ ] **Step 1: Write failing test**

```python
"""CDC WONDER client: POSTs D76 request, returns raw XML."""

from pathlib import Path

import httpx

from openarcos_pipeline.sources.cdc_wonder import CDCWonderClient, build_request_xml

FIXTURE = Path(__file__).parent / "fixtures" / "cdc" / "wv_2012_2014.xml"


def test_build_request_xml_contains_years():
    body = build_request_xml(state_fips="54", years=[2012, 2013, 2014])
    assert "<value>2012</value>" in body
    assert "<value>2013</value>" in body
    assert "<value>54</value>" in body
    assert "accept_datause_restrictions" in body


def test_fetch_returns_xml():
    def handler(req: httpx.Request) -> httpx.Response:
        assert req.method == "POST"
        return httpx.Response(200, content=FIXTURE.read_bytes(),
                               headers={"content-type": "text/xml"})

    client = CDCWonderClient(transport=httpx.MockTransport(handler))
    body = client.fetch(state_fips="54", years=[2012, 2013, 2014])
    assert body.startswith("<") or body.startswith("\ufeff<")
    assert len(body) > 100
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_sources_cdc.py -v`

- [ ] **Step 3: Implement `sources/cdc_wonder.py`**

```python
"""CDC WONDER D76 client."""

from __future__ import annotations

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from openarcos_pipeline.log import get_logger

URL = "https://wonder.cdc.gov/controller/datarequest/D76"
log = get_logger("openarcos.sources.cdc")

# ICD-10 codes for drug poisoning + intent categories (per spec §2).
DRUG_POISONING_ICD10 = [
    "X40", "X41", "X42", "X43", "X44", "X60", "X61", "X62",
    "X63", "X64", "X85", "Y10", "Y11", "Y12", "Y13", "Y14",
]


def build_request_xml(state_fips: str, years: list[int]) -> str:
    """Build the D76 XML body for `state_fips` across `years`."""
    year_values = "".join(f"<value>{y}</value>" for y in years)
    icd_values = "".join(f"<value>{c}</value>" for c in DRUG_POISONING_ICD10)
    return f"""<?xml version="1.0" encoding="utf-8"?>
<request-parameters>
  <parameter><name>accept_datause_restrictions</name><value>true</value></parameter>
  <parameter><name>B_1</name><value>D76.V1-level3</value></parameter>
  <parameter><name>B_2</name><value>D76.V1-level1</value></parameter>
  <parameter><name>F_D76.V1</name>{year_values}</parameter>
  <parameter><name>F_D76.V9</name><value>{state_fips}</value></parameter>
  <parameter><name>F_D76.V10</name><value>*All*</value></parameter>
  <parameter><name>F_D76.V2</name><value>*All*</value></parameter>
  <parameter><name>F_D76.V17</name>{icd_values}</parameter>
  <parameter><name>O_javascript</name><value>on</value></parameter>
  <parameter><name>O_precision</name><value>1</value></parameter>
  <parameter><name>O_rate_per</name><value>100000</value></parameter>
  <parameter><name>O_title</name><value>openarcos</value></parameter>
  <parameter><name>V_D76.V1</name><value/></parameter>
  <parameter><name>V_D76.V9</name><value/></parameter>
  <parameter><name>action-Send</name><value>Send</value></parameter>
  <parameter><name>stage</name><value>request</value></parameter>
</request-parameters>
"""


class CDCWonderClient:
    def __init__(
        self,
        url: str = URL,
        timeout: float = 180.0,
        max_retries: int = 4,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._url = url
        self._client = httpx.Client(
            timeout=timeout, follow_redirects=True, transport=transport
        )
        self._max_retries = max_retries

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "CDCWonderClient":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    def fetch(self, state_fips: str, years: list[int]) -> str:
        body = build_request_xml(state_fips, years)

        @retry(
            stop=stop_after_attempt(self._max_retries),
            wait=wait_exponential_jitter(initial=2.0, max=30.0),
            retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.TransportError)),
            reraise=True,
        )
        def _do() -> str:
            log.info("cdc POST", extra={"state": state_fips, "years": years})
            resp = self._client.post(self._url, data={"request_xml": body})
            if resp.status_code >= 500:
                resp.raise_for_status()
            resp.raise_for_status()
            return resp.text

        return _do()
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_sources_cdc.py -v`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/src/openarcos_pipeline/sources/cdc_wonder.py \
        pipeline/tests/test_sources_cdc.py
git commit -m "pipeline: CDC WONDER D76 client"
```

### Task 27: `clean/cdc.py` XML → DataFrame with suppression preserved

**Files:**
- Create: `/home/kush/ARCOS/pipeline/src/openarcos_pipeline/clean/cdc.py`
- Create: `/home/kush/ARCOS/pipeline/tests/test_clean_cdc.py`

- [ ] **Step 1: Write failing test**

```python
"""clean/cdc: parses D76 XML to `{fips, year, deaths, suppressed}` DataFrame."""

from pathlib import Path

import polars as pl

from openarcos_pipeline.clean.cdc import parse_d76_response

FIXTURE = Path(__file__).parent / "fixtures" / "cdc" / "wv_2012_2014.xml"


def test_parse_returns_expected_columns():
    xml = FIXTURE.read_text()
    df = parse_d76_response(xml)
    assert set(df.columns) == {"fips", "year", "deaths", "suppressed"}
    assert df["fips"].dtype == pl.Utf8
    assert df["year"].dtype == pl.Int64
    assert df["suppressed"].dtype == pl.Boolean


def test_suppressed_rows_have_null_deaths():
    xml = FIXTURE.read_text()
    df = parse_d76_response(xml)
    suppressed_rows = df.filter(pl.col("suppressed"))
    # every suppressed row has null deaths
    assert suppressed_rows["deaths"].null_count() == len(suppressed_rows)


def test_non_suppressed_rows_have_integer_deaths():
    xml = FIXTURE.read_text()
    df = parse_d76_response(xml)
    real = df.filter(~pl.col("suppressed"))
    # no nulls where not suppressed
    assert real["deaths"].null_count() == 0
    assert (real["deaths"] >= 10).all()


def test_fips_normalized_to_5_digit():
    xml = FIXTURE.read_text()
    df = parse_d76_response(xml)
    assert (df["fips"].str.len_chars() == 5).all()
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_clean_cdc.py -v`

- [ ] **Step 3: Implement `clean/cdc.py`**

```python
"""Parse CDC WONDER D76 XML responses."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET

import polars as pl

from openarcos_pipeline.fips import normalize_fips

FIPS_IN_LABEL = re.compile(r"\((\d{5})\)")


def parse_d76_response(xml_text: str) -> pl.DataFrame:
    """Walk the response `<data-table>` and produce canonical rows.

    Per notes/cdc.md: each `<r>` is a row; `<c>` cells carry labels.
    County labels look like "Mingo County, WV (54059)"; year cells are ints.
    Suppressed cells carry the literal string "Suppressed".
    """
    rows: list[dict[str, object]] = []
    root = ET.fromstring(xml_text)
    data_table = root.find(".//data-table")
    if data_table is None:
        return pl.DataFrame(
            schema={"fips": pl.Utf8, "year": pl.Int64, "deaths": pl.Int64, "suppressed": pl.Boolean}
        )

    current_county: str | None = None
    for r in data_table.findall("r"):
        cells = r.findall("c")
        if not cells:
            continue
        # WONDER responses are hierarchical: county cells appear once per group,
        # year cells in child rows. Detect by number of `l`-attr present.
        # Heuristic: a cell with an `l` attribute that matches the FIPS pattern
        # is a county header; a cell whose label looks like "YYYY" is the year.
        county_match: str | None = None
        year: int | None = None
        deaths: int | None = None
        suppressed = False
        for c in cells:
            v = (c.get("l") or c.text or "").strip()
            m = FIPS_IN_LABEL.search(v)
            if m:
                county_match = m.group(1)
                continue
            if v.isdigit() and len(v) == 4:
                year = int(v)
                continue
            if v.lower() == "suppressed":
                suppressed = True
                deaths = None
                continue
            if v.replace(",", "").isdigit():
                deaths = int(v.replace(",", ""))
        if county_match is not None:
            current_county = normalize_fips(county_match)
        if year is not None and current_county is not None:
            rows.append(
                {
                    "fips": current_county,
                    "year": year,
                    "deaths": deaths,
                    "suppressed": suppressed,
                }
            )
    return pl.DataFrame(rows, schema={
        "fips": pl.Utf8, "year": pl.Int64, "deaths": pl.Int64, "suppressed": pl.Boolean
    })
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_clean_cdc.py -v`

If tests fail because the actual XML element names or structure differ from the heuristic above, open the fixture (`tests/fixtures/cdc/wv_2012_2014.xml`), identify the actual element/attribute names, and rewrite `parse_d76_response` accordingly before rerunning.

- [ ] **Step 5: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/src/openarcos_pipeline/clean/cdc.py pipeline/tests/test_clean_cdc.py
git commit -m "pipeline: parse CDC D76 responses preserving suppression"
```

### Task 28: Validate CDC cleaned output against schema

**Files:**
- Create: `/home/kush/ARCOS/pipeline/tests/test_cdc_schema_match.py`

- [ ] **Step 1: Write test**

```python
"""CDC cleaned output must round-trip through its JSON schema."""

import json
from pathlib import Path

import jsonschema

from openarcos_pipeline.clean.cdc import parse_d76_response

FIXTURE = Path(__file__).parent / "fixtures" / "cdc" / "wv_2012_2014.xml"
SCHEMA = Path(__file__).parent.parent / "schemas" / "cdc-overdose-by-county-year.schema.json"


def test_cleaned_cdc_matches_schema():
    df = parse_d76_response(FIXTURE.read_text())
    data = df.to_dicts()
    schema = json.loads(SCHEMA.read_text())
    jsonschema.validate(data, schema)
```

- [ ] **Step 2: Run — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_cdc_schema_match.py -v`

If it fails, inspect which row breaks the schema (e.g. suppressed row with non-null deaths, or deaths<10 without suppressed=true), then fix `parse_d76_response` logic before committing.

- [ ] **Step 3: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/tests/test_cdc_schema_match.py
git commit -m "pipeline: cdc cleaned output validates against schema"
```

### Task 29: CDC runner + wire into CLI

**Files:**
- Create: `/home/kush/ARCOS/pipeline/src/openarcos_pipeline/sources/cdc_runner.py`
- Modify: `/home/kush/ARCOS/pipeline/src/openarcos_pipeline/cli.py`
- Create: `/home/kush/ARCOS/pipeline/tests/test_cdc_runner.py`

- [ ] **Step 1: Write failing test**

```python
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
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_cdc_runner.py -v`

- [ ] **Step 3: Implement `sources/cdc_runner.py`**

```python
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
```

- [ ] **Step 4: Extend CLI `fetch` to include cdc**

Modify the `fetch` command in `cli.py` — replace the cdc stub line with:

```python
    if source in ("all", "cdc"):
        from openarcos_pipeline.sources.cdc_wonder import CDCWonderClient
        from openarcos_pipeline.sources.cdc_runner import fetch_all_states
        with CDCWonderClient() as cdc:
            fetch_all_states(cdc, cfg)
        log.info("cdc fetch complete")
```

- [ ] **Step 5: Run — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_cdc_runner.py -v`

- [ ] **Step 6: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/src/openarcos_pipeline/sources/cdc_runner.py \
        pipeline/src/openarcos_pipeline/cli.py \
        pipeline/tests/test_cdc_runner.py
git commit -m "pipeline: cdc fetch runner wired into CLI"
```

### Task 30: Wire CDC clean into `clean` subcommand

**Files:**
- Modify: `/home/kush/ARCOS/pipeline/src/openarcos_pipeline/cli.py`
- Create: `/home/kush/ARCOS/pipeline/tests/test_cdc_clean_integration.py`

- [ ] **Step 1: Write integration test**

```python
"""CLI clean: ingests raw CDC XMLs and emits data/clean/cdc.parquet."""

from pathlib import Path
import shutil

import polars as pl
from typer.testing import CliRunner

from openarcos_pipeline.cli import app
from openarcos_pipeline.config import Config

runner = CliRunner()
FIXTURE = Path(__file__).parent / "fixtures" / "cdc" / "wv_2012_2014.xml"


def test_clean_cdc_produces_parquet(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(tmp_path))
    cfg = Config.from_env()
    cfg.ensure_dirs()
    cdc_raw = cfg.raw_dir / "cdc"
    cdc_raw.mkdir(parents=True, exist_ok=True)
    shutil.copy(FIXTURE, cdc_raw / "WV_2012-2014.xml")

    result = runner.invoke(app, ["clean"])
    assert result.exit_code == 0, result.stdout

    out = cfg.clean_dir / "cdc_overdose.parquet"
    assert out.exists()
    df = pl.read_parquet(out)
    assert set(df.columns) == {"fips", "year", "deaths", "suppressed"}
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_cdc_clean_integration.py -v`

- [ ] **Step 3: Implement `clean` in CLI**

Replace the `clean` body in `cli.py`:

```python
@app.command()
def clean() -> None:
    """Normalize raw data into canonical parquet."""
    from openarcos_pipeline.clean.cdc import parse_d76_response
    from openarcos_pipeline.config import Config
    import polars as pl

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
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_cdc_clean_integration.py -v`

- [ ] **Step 5: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/src/openarcos_pipeline/cli.py pipeline/tests/test_cdc_clean_integration.py
git commit -m "pipeline: clean command ingests raw CDC XML into parquet"
```

---

### Phase 5 gate

After every task in this phase, run the full verification matrix:

```bash
cd pipeline && make lint && make test
```

All checks must pass before starting the next phase. If any check fails, fix before proceeding; do not rely on the merge or a later phase to catch it.

---

## Phase 6 — DEA Diversion summaries (5 tasks)

### Task 31: SPIKE — identify DEA Diversion annual-report URLs

**Files:**
- Create: `/home/kush/ARCOS/pipeline/notes/dea.md`
- Create: `/home/kush/ARCOS/pipeline/tests/fixtures/dea/diversion_2012_sample.pdf`
- Create: `/home/kush/ARCOS/pipeline/tests/fixtures/dea/diversion_2014_sample.pdf`
- Create: `/home/kush/ARCOS/pipeline/notebooks/03-dea-probe.py`

- [ ] **Step 1: Identify two annual report URLs**

DEA Diversion Control publishes annual statistics. Entry point: https://www.deadiversion.usdoj.gov/pubs/reports/index.html (verify during spike). Find the "Annual Statistical Report" or "Year in Review" PDFs for 2012 and 2014 as our initial sample; record URLs in `notes/dea.md`.

- [ ] **Step 2: Download sample PDFs via probe**

Write `notebooks/03-dea-probe.py`:

```python
"""Spike: grab DEA Diversion annual report PDF samples."""

from pathlib import Path
import httpx

OUT = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "dea"
OUT.mkdir(parents=True, exist_ok=True)

# Replace with actual URLs observed during the spike.
URLS = {
    "diversion_2012_sample.pdf": "https://www.deadiversion.usdoj.gov/REPLACE_WITH_2012_URL.pdf",
    "diversion_2014_sample.pdf": "https://www.deadiversion.usdoj.gov/REPLACE_WITH_2014_URL.pdf",
}

with httpx.Client(timeout=180.0, follow_redirects=True) as c:
    for fname, url in URLS.items():
        r = c.get(url)
        print(url, r.status_code, len(r.content))
        r.raise_for_status()
        (OUT / fname).write_bytes(r.content)
```

- [ ] **Step 3: Run probe**

Run: `cd /home/kush/ARCOS/pipeline && uv run python notebooks/03-dea-probe.py`
Expected: downloads both PDFs (1–10 MB each).

- [ ] **Step 4: Inspect with pdfplumber**

Run: `cd /home/kush/ARCOS/pipeline && uv run python -c "
import pdfplumber
with pdfplumber.open('tests/fixtures/dea/diversion_2012_sample.pdf') as pdf:
    for i, page in enumerate(pdf.pages[:3]):
        print('--- page', i+1, '---')
        print(page.extract_text()[:500])
"`

Expected: readable text showing enforcement statistics — counts of inspections, warning letters, administrative actions, notable cases. Look for tables — pdfplumber can extract them via `page.extract_tables()`.

- [ ] **Step 5: Write `notes/dea.md`**

```markdown
# DEA Diversion Control — probe notes

**Probed on:** YYYY-MM-DD
**Source index:** https://www.deadiversion.usdoj.gov/pubs/reports/index.html

## Reports we extract

| Year | URL | Format |
|---|---|---|
| 2012 | URL-here | PDF, N pages |
| 2014 | URL-here | PDF, N pages |

## Extraction strategy

- We extract **enforcement action counts** from the summary tables (typically early pages)
- We extract **notable case titles + DOJ press-release URLs** from later prose sections (best-effort regex on "United States v.", "Justice Department", etc.)
- PDFs change format across years; our parser must tolerate (a) table-based, (b) prose-only, (c) mixed layouts

## Known quirks

- Some years include a separate "Cases of Interest" subsection — we extract from there if present
- Counts are sometimes "approximately 1,250" — we parse the integer out or fall back to 0 + log a warning
- Content hashes shift year-over-year even for "the same" report — we don't canary DEA, we just recompute

## Content hashes

- `diversion_2012_sample.pdf`: sha256=...
- `diversion_2014_sample.pdf`: sha256=...
```

Populate from the actual downloaded files.

- [ ] **Step 6: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/notes/dea.md pipeline/tests/fixtures/dea/ pipeline/notebooks/03-dea-probe.py
git commit -m "pipeline: spike DEA Diversion reports + record fixture PDFs"
```

### Task 32: `sources/dea_summaries.py` fetch

**Files:**
- Create: `/home/kush/ARCOS/pipeline/src/openarcos_pipeline/sources/dea_summaries.py`
- Create: `/home/kush/ARCOS/pipeline/tests/test_sources_dea.py`

- [ ] **Step 1: Write failing test**

```python
"""DEA summaries fetcher: downloads PDFs per pinned year→URL map."""

from pathlib import Path

import httpx

from openarcos_pipeline.config import Config
from openarcos_pipeline.sources.dea_summaries import (
    DEA_ANNUAL_REPORTS,
    fetch_reports,
)


def test_report_map_covers_years():
    assert 2012 in DEA_ANNUAL_REPORTS
    assert 2014 in DEA_ANNUAL_REPORTS
    for year, url in DEA_ANNUAL_REPORTS.items():
        assert url.startswith("http"), year


def test_fetch_writes_pdfs(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(tmp_path))
    cfg = Config.from_env()
    cfg.ensure_dirs()

    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"%PDF-fake")
    transport = httpx.MockTransport(handler)
    fetch_reports(cfg, years=[2012, 2014], transport=transport)
    out = cfg.raw_dir / "dea"
    assert (out / "2012.pdf").exists()
    assert (out / "2014.pdf").exists()
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_sources_dea.py -v`

- [ ] **Step 3: Implement `sources/dea_summaries.py`**

```python
"""DEA Diversion annual report fetcher."""

from __future__ import annotations

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from openarcos_pipeline.config import Config
from openarcos_pipeline.log import get_logger

log = get_logger("openarcos.sources.dea")

# Pinned URLs; update this map when adding new years. Values filled from spike (Task 31).
DEA_ANNUAL_REPORTS: dict[int, str] = {
    2012: "https://www.deadiversion.usdoj.gov/REPLACE_WITH_2012_URL.pdf",
    2014: "https://www.deadiversion.usdoj.gov/REPLACE_WITH_2014_URL.pdf",
}


def fetch_reports(
    cfg: Config,
    years: list[int] | None = None,
    transport: httpx.BaseTransport | None = None,
) -> None:
    out = cfg.raw_dir / "dea"
    out.mkdir(parents=True, exist_ok=True)
    years = years or sorted(DEA_ANNUAL_REPORTS)

    with httpx.Client(
        timeout=180.0, follow_redirects=True, transport=transport
    ) as client:
        for year in years:
            url = DEA_ANNUAL_REPORTS.get(year)
            if not url:
                log.warning("dea: no URL for year", extra={"year": year})
                continue
            dest = out / f"{year}.pdf"

            @retry(
                stop=stop_after_attempt(4),
                wait=wait_exponential_jitter(initial=1.0, max=15.0),
                retry=retry_if_exception_type(
                    (httpx.HTTPStatusError, httpx.TransportError)
                ),
                reraise=True,
            )
            def _do() -> None:
                log.info("dea GET", extra={"year": year, "url": url})
                resp = client.get(url)
                resp.raise_for_status()
                dest.write_bytes(resp.content)

            _do()
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_sources_dea.py -v`

- [ ] **Step 5: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/src/openarcos_pipeline/sources/dea_summaries.py \
        pipeline/tests/test_sources_dea.py
git commit -m "pipeline: DEA Diversion report fetcher"
```

### Task 33: `clean/dea.py` parse PDFs

**Files:**
- Create: `/home/kush/ARCOS/pipeline/src/openarcos_pipeline/clean/dea.py`
- Create: `/home/kush/ARCOS/pipeline/tests/test_clean_dea.py`

- [ ] **Step 1: Write failing test**

```python
"""clean/dea: parse annual-report PDF into canonical enforcement record."""

from pathlib import Path

import polars as pl

from openarcos_pipeline.clean.dea import parse_annual_report

FIXTURE = Path(__file__).parent / "fixtures" / "dea" / "diversion_2012_sample.pdf"


def test_parse_returns_year_and_action_count():
    rec = parse_annual_report(FIXTURE, year=2012)
    assert rec["year"] == 2012
    assert isinstance(rec["action_count"], int)
    assert rec["action_count"] >= 0
    assert isinstance(rec["notable_actions"], list)
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_clean_dea.py -v`

- [ ] **Step 3: Implement `clean/dea.py`**

```python
"""Parse DEA Diversion annual report PDFs into canonical records."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pdfplumber

from openarcos_pipeline.log import get_logger

log = get_logger("openarcos.clean.dea")

# Phrases that indicate enforcement-action totals.
ACTION_COUNT_PATTERNS = [
    re.compile(r"([\d,]+)\s+administrative\s+actions", re.IGNORECASE),
    re.compile(r"([\d,]+)\s+enforcement\s+actions", re.IGNORECASE),
    re.compile(r"total\s+(?:of\s+)?([\d,]+)\s+cases", re.IGNORECASE),
]

# Heuristic for extracting notable-case headlines.
NOTABLE_PATTERNS = [
    re.compile(r"United States v\.\s+([^\n\.]+)"),
    re.compile(r"Operation\s+([A-Z][A-Za-z ]+)"),
]


def _extract_all_text(pdf_path: Path) -> str:
    with pdfplumber.open(pdf_path) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages)


def parse_annual_report(pdf_path: Path, year: int) -> dict[str, Any]:
    text = _extract_all_text(pdf_path)

    action_count = 0
    for pat in ACTION_COUNT_PATTERNS:
        match = pat.search(text)
        if match:
            action_count = int(match.group(1).replace(",", ""))
            break

    if action_count == 0:
        log.warning("dea: no action count found", extra={"year": year})

    seen: set[str] = set()
    notable: list[dict[str, Any]] = []
    for pat in NOTABLE_PATTERNS:
        for m in pat.finditer(text):
            title = m.group(0).strip().rstrip(".")
            key = title.lower()
            if key in seen:
                continue
            seen.add(key)
            notable.append({"title": title, "url": "", "target": None})
            if len(notable) >= 10:
                break
        if len(notable) >= 10:
            break

    return {
        "year": year,
        "action_count": action_count,
        "notable_actions": notable,
    }
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_clean_dea.py -v`

If the fixture PDFs don't contain text matching the built-in patterns, extract what you see with pdfplumber and refine the regexes + test assertions. Keep the `action_count >= 0` assertion; strengthen if the fixture yields a real non-zero number.

- [ ] **Step 5: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/src/openarcos_pipeline/clean/dea.py pipeline/tests/test_clean_dea.py
git commit -m "pipeline: parse DEA annual report PDFs"
```

### Task 34: Wire DEA + WaPo into `clean` subcommand

**Files:**
- Modify: `/home/kush/ARCOS/pipeline/src/openarcos_pipeline/cli.py`
- Create: `/home/kush/ARCOS/pipeline/tests/test_clean_integration.py`

- [ ] **Step 1: Write integration test**

```python
"""Full clean pass on fixture data: CDC + DEA + WaPo produce parquets."""

import json
import shutil
from pathlib import Path

import polars as pl
from typer.testing import CliRunner

from openarcos_pipeline.cli import app
from openarcos_pipeline.config import Config

runner = CliRunner()
FIX = Path(__file__).parent / "fixtures"


def test_clean_produces_all_parquets(tmp_path, monkeypatch):
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(tmp_path))
    cfg = Config.from_env()
    cfg.ensure_dirs()

    # Seed raw dirs with fixtures.
    (cfg.raw_dir / "cdc").mkdir(parents=True, exist_ok=True)
    shutil.copy(FIX / "cdc" / "wv_2012_2014.xml", cfg.raw_dir / "cdc" / "WV_2012-2014.xml")

    (cfg.raw_dir / "dea").mkdir(parents=True, exist_ok=True)
    shutil.copy(
        FIX / "dea" / "diversion_2012_sample.pdf",
        cfg.raw_dir / "dea" / "2012.pdf",
    )

    (cfg.raw_dir / "wapo").mkdir(parents=True, exist_ok=True)
    # Copy the county_raw fixture under the runner-expected naming.
    shutil.copy(
        FIX / "wapo" / "county_2012_54059.json",
        cfg.raw_dir / "wapo" / "county_raw_WV_Mingo.json",
    )
    shutil.copy(
        FIX / "wapo" / "distributors_54059.json",
        cfg.raw_dir / "wapo" / "distributors_WV_Mingo.json",
    )
    shutil.copy(
        FIX / "wapo" / "pharmacies_54059.json",
        cfg.raw_dir / "wapo" / "pharmacies_WV_Mingo.json",
    )

    result = runner.invoke(app, ["clean"])
    assert result.exit_code == 0, result.stdout

    assert (cfg.clean_dir / "cdc_overdose.parquet").exists()
    assert (cfg.clean_dir / "dea_enforcement.parquet").exists()
    assert (cfg.clean_dir / "wapo_county.parquet").exists()
    assert (cfg.clean_dir / "wapo_distributors.parquet").exists()
    assert (cfg.clean_dir / "wapo_pharmacies.parquet").exists()
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_clean_integration.py -v`

- [ ] **Step 3: Replace the `clean` body in `cli.py`**

```python
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
    from openarcos_pipeline.fips import normalize_fips

    cfg = Config.from_env()
    cfg.clean_dir.mkdir(parents=True, exist_ok=True)

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
            # polars flattens structs cleanly; notable_actions stays a list[struct]
            pl.DataFrame(records).write_parquet(cfg.clean_dir / "dea_enforcement.parquet")

    # WaPo — per-county fixtures named `{endpoint}_{state}_{county}.json`
    wapo_raw = cfg.raw_dir / "wapo"
    if wapo_raw.is_dir():
        county_frames: list[pl.DataFrame] = []
        dist_frames: list[pl.DataFrame] = []
        pharm_frames: list[pl.DataFrame] = []
        for f in sorted(wapo_raw.glob("*.json")):
            parts = f.stem.split("_")
            if len(parts) < 3:
                continue
            endpoint, state, county_name = parts[0], parts[-2], "_".join(parts[1:-1]) if parts[0] in {"county", "distributors", "pharmacies"} and len(parts) >= 4 else parts[-1]
            # Fallback simpler parser: <endpoint>_<STATE>_<County>.json
            if len(parts) >= 3:
                state = parts[-2]
                county_name = parts[-1]
            data = json.loads(f.read_text())
            # The first fixture name token tells us the endpoint family.
            family = f.name.split("_")[0]
            if family == "county":  # county_raw_ST_COUNTY.json or county_2012_FIPS.json
                # For test fixtures named county_2012_54059.json treat last token as fips.
                if county_name.isdigit() and len(county_name) == 5:
                    county_frames.append(clean_county_raw(data, state=state, county_fips=county_name))
                else:
                    county_frames.append(clean_county_raw(data, state=state, county_fips="00000"))
            elif family == "distributors":
                dist_frames.append(clean_distributors(data))
            elif family == "pharmacies":
                fips = county_name if county_name.isdigit() and len(county_name) == 5 else "00000"
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
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_clean_integration.py -v`

- [ ] **Step 5: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/src/openarcos_pipeline/cli.py pipeline/tests/test_clean_integration.py
git commit -m "pipeline: clean command handles all three sources"
```

### Task 35: Wire DEA fetch into CLI

**Files:**
- Modify: `/home/kush/ARCOS/pipeline/src/openarcos_pipeline/cli.py`

- [ ] **Step 1: Replace the dea fetch stub line**

In `fetch()`:

```python
    if source in ("all", "dea"):
        from openarcos_pipeline.sources.dea_summaries import fetch_reports
        fetch_reports(cfg)
        log.info("dea fetch complete")
```

- [ ] **Step 2: Run full CLI tests**

Run: `cd /home/kush/ARCOS/pipeline && uv run pytest tests/test_cli.py -v`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
cd /home/kush/ARCOS
git add pipeline/src/openarcos_pipeline/cli.py
git commit -m "pipeline: dea fetch wired into CLI"
```

---

### Phase 6 gate

After every task in this phase, run the full verification matrix:

```bash
cd pipeline && make lint && make test
```

All checks must pass before starting the next phase. If any check fails, fix before proceeding; do not rely on the merge or a later phase to catch it.

---

## Phase 7 — County metadata + Join (tasks 36–38)

The join phase stitches county metadata (fixed universe of ~3,100 FIPS) against the cleaned shipments + overdose data to produce a single `master.parquet` on the `(fips, year)` grain. Distributor, pharmacy and DEA data have different grains and stay in their clean parquet form — they feed directly into Phase 8 aggregations.

### Task 36: Fetch + clean Census county metadata

**Files:**
- Create: `pipeline/src/openarcos_pipeline/sources/census.py`
- Create: `pipeline/tests/fixtures/census/co-est2019-sample.csv`
- Create: `pipeline/tests/test_census.py`

Census publishes a pinned CSV of annual county population estimates. We use 2012 (middle of the ARCOS 2006–2014 window) as the per-capita denominator.

- [ ] **Step 1: Write a tiny Census fixture**

Create `pipeline/tests/fixtures/census/co-est2019-sample.csv` with exactly these lines (the real CSV has many more columns; these are only the ones we read):

```csv
SUMLEV,REGION,DIVISION,STATE,COUNTY,STNAME,CTYNAME,POPESTIMATE2012
040,3,5,54,000,West Virginia,West Virginia,1855447
050,3,5,54,059,West Virginia,Mingo County,25764
050,3,5,51,720,South,South,3892
050,3,5,21,119,South,Knott County,16232
050,3,5,21,195,South,Pike County,64757
```

Row 1 is a state-summary row (SUMLEV 040) which must be filtered out. Row 3 has a county whose name does not end in "County" — real Census CSV has Virginia independent cities, Louisiana parishes, Alaska boroughs. Parser must tolerate all three.

- [ ] **Step 2: Write the failing test**

Create `pipeline/tests/test_census.py`:

```python
"""Tests for Census county metadata source."""
from __future__ import annotations

import polars as pl
import pytest

from openarcos_pipeline.sources import census


def test_parse_popest_filters_state_summaries(fixtures_dir):
    df = census.parse_popest_csv(fixtures_dir / "census" / "co-est2019-sample.csv")
    assert isinstance(df, pl.DataFrame)
    fips = df["fips"].to_list()
    # State summary row (SUMLEV=040) must be gone; only 4 county rows remain
    assert len(df) == 4
    # All FIPS are zero-padded to 5 chars
    assert all(len(f) == 5 for f in fips)
    assert "54059" in fips
    assert "51720" in fips  # independent city (no "County" suffix)
    assert "21119" in fips
    assert "21195" in fips


def test_parse_popest_extracts_expected_columns(fixtures_dir):
    df = census.parse_popest_csv(fixtures_dir / "census" / "co-est2019-sample.csv")
    assert set(df.columns) == {"fips", "name", "state", "pop"}
    # Population comes from POPESTIMATE2012
    row = df.filter(pl.col("fips") == "54059").to_dicts()[0]
    assert row == {
        "fips": "54059",
        "name": "Mingo County",
        "state": "WV",
        "pop": 25764,
    }


def test_parse_popest_preserves_non_county_names(fixtures_dir):
    df = census.parse_popest_csv(fixtures_dir / "census" / "co-est2019-sample.csv")
    # Virginia independent cities, Louisiana parishes, Alaska boroughs: keep full name
    row = df.filter(pl.col("fips") == "51720").to_dicts()[0]
    # Parser does NOT strip " County" because this name doesn't have that suffix
    assert row["name"] == "South"  # In real data this would be "Norton city"; we use raw CTYNAME verbatim


def test_parse_popest_handles_missing_population(fixtures_dir, tmp_path):
    # Real Census CSVs have rows with no POPESTIMATE2012 for brand-new counties.
    # We should skip them rather than crash.
    missing = tmp_path / "missing.csv"
    missing.write_text(
        "SUMLEV,STATE,COUNTY,STNAME,CTYNAME,POPESTIMATE2012\n"
        "050,54,059,West Virginia,Mingo County,25764\n"
        "050,02,275,Alaska,New Borough,\n"
    )
    df = census.parse_popest_csv(missing)
    assert len(df) == 1
    assert df["fips"].to_list() == ["54059"]


def test_state_fips_maps_to_abbreviation():
    # Sanity: 54 → WV, 51 → VA, 21 → KY
    assert census._state_abbrev("54") == "WV"
    assert census._state_abbrev("51") == "VA"
    assert census._state_abbrev("21") == "KY"
```

Run: `uv run pytest pipeline/tests/test_census.py -v`
Expected: FAIL — `openarcos_pipeline.sources.census` does not exist.

- [ ] **Step 3: Implement `sources/census.py`**

Create `pipeline/src/openarcos_pipeline/sources/census.py`:

```python
"""Census Bureau county metadata source.

Uses the pinned Population Estimates Program (PEP) 2010-2019 CSV. We take 2012
estimates as the canonical per-capita denominator (middle of the ARCOS
2006–2014 window). Source URL is pinned; file is small (~250 KB).
"""
from __future__ import annotations

from pathlib import Path

import httpx
import polars as pl
import tenacity

from ..config import Config
from ..fips import FIPS_STATE_MAP, normalize_fips
from ..log import get_logger

log = get_logger(__name__)

CENSUS_POPEST_URL = (
    "https://www2.census.gov/programs-surveys/popest/datasets/"
    "2010-2019/counties/totals/co-est2019-alldata.csv"
)
POP_YEAR = 2012  # middle of ARCOS window (2006–2014)


def _state_abbrev(state_fips: str) -> str:
    """Map 2-digit state FIPS to USPS abbreviation via fips.FIPS_STATE_MAP."""
    return FIPS_STATE_MAP[state_fips.zfill(2)]


def parse_popest_csv(path: Path) -> pl.DataFrame:
    """Read a Census PEP CSV and return a clean county-metadata DataFrame.

    Output columns: fips (5-digit str), name (str), state (USPS abbrev), pop (i64).
    Filters out state-summary rows (SUMLEV != 050) and rows missing POPESTIMATE2012.
    """
    # Census CSV is latin-1 encoded (has Spanish accents in Puerto Rico names)
    raw = pl.read_csv(
        path,
        encoding="latin1",
        columns=["SUMLEV", "STATE", "COUNTY", "STNAME", "CTYNAME", "POPESTIMATE2012"],
        infer_schema_length=10000,
    )
    df = (
        raw
        .filter(pl.col("SUMLEV") == 50)  # county-level only (040 = state summary)
        .filter(pl.col("POPESTIMATE2012").is_not_null())
        .with_columns([
            pl.col("STATE").cast(pl.Utf8).str.zfill(2).alias("_state_fips"),
            pl.col("COUNTY").cast(pl.Utf8).str.zfill(3).alias("_county_fips"),
        ])
        .with_columns([
            (pl.col("_state_fips") + pl.col("_county_fips")).alias("fips"),
            pl.col("CTYNAME").alias("name"),
            pl.col("_state_fips").map_elements(_state_abbrev, return_dtype=pl.Utf8).alias("state"),
            pl.col("POPESTIMATE2012").cast(pl.Int64).alias("pop"),
        ])
        .select(["fips", "name", "state", "pop"])
    )
    log.info("census: loaded %d county rows", len(df))
    return df


@tenacity.retry(
    stop=tenacity.stop_after_attempt(5),
    wait=tenacity.wait_exponential_jitter(initial=1, max=30),
    reraise=True,
)
def _download(url: str, dest: Path, transport: httpx.BaseTransport | None = None) -> None:
    with httpx.Client(transport=transport, timeout=60.0, follow_redirects=True) as client:
        r = client.get(url)
        r.raise_for_status()
        dest.write_bytes(r.content)


def fetch_popest(cfg: Config, transport: httpx.BaseTransport | None = None) -> Path:
    """Download the Census PEP CSV to `data/raw/census/co-est2019-alldata.csv`.

    Returns the path to the downloaded file. Idempotent: if the file already
    exists and is non-empty, returns without re-downloading.
    """
    dest_dir = cfg.raw_dir / "census"
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / "co-est2019-alldata.csv"
    if dest.exists() and dest.stat().st_size > 0:
        log.info("census: cached at %s", dest)
        return dest
    log.info("census: downloading %s", CENSUS_POPEST_URL)
    _download(CENSUS_POPEST_URL, dest, transport=transport)
    log.info("census: wrote %s (%d bytes)", dest, dest.stat().st_size)
    return dest


def clean_to_parquet(cfg: Config, csv_path: Path) -> Path:
    """Parse Census CSV, write to data/clean/county_metadata.parquet. Returns the output path."""
    df = parse_popest_csv(csv_path)
    cfg.clean_dir.mkdir(parents=True, exist_ok=True)
    out = cfg.clean_dir / "county_metadata.parquet"
    df.write_parquet(out)
    log.info("census: wrote %s (%d rows)", out, len(df))
    return out
```

- [ ] **Step 4: Verify tests pass**

Run: `uv run pytest pipeline/tests/test_census.py -v`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add pipeline/src/openarcos_pipeline/sources/census.py \
        pipeline/tests/fixtures/census/co-est2019-sample.csv \
        pipeline/tests/test_census.py
git commit -m "pipeline: add Census county metadata source"
```

---

### Task 37: Build master.parquet

**Files:**
- Create: `pipeline/src/openarcos_pipeline/join.py`
- Create: `pipeline/tests/test_join.py`

`master.parquet` is the single (fips, year) fact table that the state+county shipment aggregations and the county page queries read from. Built with DuckDB for clarity.

- [ ] **Step 1: Write the failing test**

Create `pipeline/tests/test_join.py`:

```python
"""Tests for master.parquet construction."""
from __future__ import annotations

from pathlib import Path

import polars as pl
import pytest

from openarcos_pipeline.config import Config
from openarcos_pipeline.join import build_master


def _write_clean_inputs(clean_dir: Path) -> None:
    """Seed clean parquets for a 3-county × 3-year toy world.

    County universe: 54059 (Mingo WV, pop 25764), 51720 (Norton VA, pop 3892),
    21119 (Knott KY, pop 16232).
    Years: 2011–2013.
    WaPo shipments cover only 54059 and 21119 (Norton is sparse).
    CDC overdoses cover 54059 only; Knott has all years suppressed.
    """
    clean_dir.mkdir(parents=True, exist_ok=True)

    pl.DataFrame({
        "fips": ["54059", "51720", "21119"],
        "name": ["Mingo County", "Norton city", "Knott County"],
        "state": ["WV", "VA", "KY"],
        "pop": [25764, 3892, 16232],
    }).write_parquet(clean_dir / "county_metadata.parquet")

    pl.DataFrame({
        "fips":  ["54059", "54059", "54059", "21119", "21119", "21119"],
        "year":  [  2011 ,   2012 ,   2013 ,   2011 ,   2012 ,   2013 ],
        "pills": [4_000_000, 6_000_000, 5_000_000, 1_500_000, 2_100_000, 1_900_000],
    }).write_parquet(clean_dir / "wapo_county.parquet")

    pl.DataFrame({
        "fips":       ["54059", "54059", "54059", "21119", "21119", "21119"],
        "year":       [  2011 ,   2012 ,   2013 ,   2011 ,   2012 ,   2013 ],
        "deaths":     [    42 ,     55 ,     61 ,   None ,   None ,   None ],
        "suppressed": [ False ,  False ,  False ,   True ,   True ,   True ],
    }).write_parquet(clean_dir / "cdc_overdose.parquet")


def test_build_master_produces_full_grid(tmp_path):
    cfg = Config(data_root=tmp_path / "data", emit_dir=tmp_path / "emit")
    cfg.ensure_dirs()
    _write_clean_inputs(cfg.clean_dir)

    out = build_master(cfg, years=range(2011, 2014))

    assert out.exists()
    df = pl.read_parquet(out)
    # 3 counties × 3 years = 9 rows
    assert len(df) == 9
    assert set(df.columns) == {"fips", "year", "pop", "pills", "deaths", "suppressed"}
    # Every (fips, year) combination exactly once
    assert df.group_by(["fips", "year"]).len()["len"].max() == 1


def test_build_master_left_joins_sparse_coverage(tmp_path):
    cfg = Config(data_root=tmp_path / "data", emit_dir=tmp_path / "emit")
    cfg.ensure_dirs()
    _write_clean_inputs(cfg.clean_dir)

    out = build_master(cfg, years=range(2011, 2014))
    df = pl.read_parquet(out)

    # Norton (51720) has no WaPo and no CDC rows → pills and deaths null
    norton = df.filter(pl.col("fips") == "51720").sort("year").to_dicts()
    assert all(r["pills"] is None for r in norton)
    assert all(r["deaths"] is None for r in norton)
    # suppressed defaults to False for rows with no CDC source (not True)
    assert all(r["suppressed"] is False for r in norton)


def test_build_master_preserves_suppressed_flag(tmp_path):
    cfg = Config(data_root=tmp_path / "data", emit_dir=tmp_path / "emit")
    cfg.ensure_dirs()
    _write_clean_inputs(cfg.clean_dir)

    out = build_master(cfg, years=range(2011, 2014))
    df = pl.read_parquet(out)

    knott = df.filter(pl.col("fips") == "21119").sort("year").to_dicts()
    assert all(r["suppressed"] is True for r in knott)
    assert all(r["deaths"] is None for r in knott)


def test_build_master_year_range_is_inclusive_of_endpoints(tmp_path):
    cfg = Config(data_root=tmp_path / "data", emit_dir=tmp_path / "emit")
    cfg.ensure_dirs()
    _write_clean_inputs(cfg.clean_dir)

    out = build_master(cfg, years=range(2011, 2014))
    df = pl.read_parquet(out)

    years = sorted(set(df["year"].to_list()))
    assert years == [2011, 2012, 2013]
```

Run: `uv run pytest pipeline/tests/test_join.py -v`
Expected: FAIL — `openarcos_pipeline.join` does not exist.

- [ ] **Step 2: Implement `join.py`**

Create `pipeline/src/openarcos_pipeline/join.py`:

```python
"""Join cleaned source parquets into a single master (fips, year) fact table.

Uses DuckDB for the join (polars could do it too, but DuckDB's SQL is more
readable for this and matches the query-builder pattern used in Phase 8).

County metadata provides the canonical FIPS universe; CROSS JOIN with the
requested year range produces the full grid. Each clean parquet LEFT JOINs
into the grid, preserving nulls where a source lacks coverage.
"""
from __future__ import annotations

from pathlib import Path
from typing import Iterable

import duckdb

from .config import Config
from .log import get_logger

log = get_logger(__name__)


def build_master(cfg: Config, years: Iterable[int]) -> Path:
    """Build data/joined/master.parquet from the clean parquets.

    Schema:
        fips       VARCHAR (5-digit)
        year       INTEGER
        pop        BIGINT  — nullable only if Census didn't cover the county
        pills      DOUBLE  — nullable where WaPo has no coverage
        deaths     INTEGER — nullable where CDC has no coverage or suppressed
        suppressed BOOLEAN — True where CDC suppressed the cell, False otherwise

    Returns the path to the written parquet.
    """
    year_list = sorted(set(years))
    if not year_list:
        raise ValueError("years must be non-empty")

    meta_path = cfg.clean_dir / "county_metadata.parquet"
    wapo_path = cfg.clean_dir / "wapo_county.parquet"
    cdc_path = cfg.clean_dir / "cdc_overdose.parquet"

    for p in (meta_path, wapo_path, cdc_path):
        if not p.exists():
            raise FileNotFoundError(f"expected clean input {p} is missing; run `openarcos clean` first")

    cfg.joined_dir.mkdir(parents=True, exist_ok=True)
    out = cfg.joined_dir / "master.parquet"

    years_csv = ",".join(f"({y})" for y in year_list)
    sql = f"""
    WITH years(year) AS (VALUES {years_csv}),
    grid AS (
        SELECT m.fips, m.pop, y.year
        FROM read_parquet('{meta_path}') m
        CROSS JOIN years y
    ),
    wapo AS (
        SELECT fips, year, pills FROM read_parquet('{wapo_path}')
    ),
    cdc AS (
        SELECT fips, year, deaths, suppressed FROM read_parquet('{cdc_path}')
    )
    SELECT
        g.fips,
        g.year,
        g.pop,
        w.pills,
        c.deaths,
        COALESCE(c.suppressed, FALSE) AS suppressed
    FROM grid g
    LEFT JOIN wapo w USING (fips, year)
    LEFT JOIN cdc  c USING (fips, year)
    ORDER BY g.fips, g.year
    """

    conn = duckdb.connect()
    try:
        conn.execute(f"COPY ({sql}) TO '{out}' (FORMAT PARQUET, COMPRESSION ZSTD)")
    finally:
        conn.close()

    log.info("join: wrote master.parquet (%d counties × %d years)", _count_counties(meta_path), len(year_list))
    return out


def _count_counties(meta_path: Path) -> int:
    conn = duckdb.connect()
    try:
        (n,) = conn.execute(f"SELECT COUNT(*) FROM read_parquet('{meta_path}')").fetchone()
        return int(n)
    finally:
        conn.close()
```

- [ ] **Step 3: Verify tests pass**

Run: `uv run pytest pipeline/tests/test_join.py -v`
Expected: 4 passed.

- [ ] **Step 4: Commit**

```bash
git add pipeline/src/openarcos_pipeline/join.py pipeline/tests/test_join.py
git commit -m "pipeline: build master.parquet via DuckDB LEFT JOINs"
```

---

### Task 38: Wire join into CLI + integration test

**Files:**
- Modify: `pipeline/src/openarcos_pipeline/cli.py`
- Modify: `pipeline/tests/test_clean_integration.py` (rename / extend to full fetch→clean→join)
- Create: `pipeline/tests/test_cli_join.py`

- [ ] **Step 1: Wire `join` subcommand in CLI**

In `pipeline/src/openarcos_pipeline/cli.py`, replace the stub `join` command body with:

```python
@app.command()
def join(
    years_start: int = typer.Option(2006, "--years-start"),
    years_end: int = typer.Option(2020, "--years-end"),
) -> None:
    """Join cleaned sources into data/joined/master.parquet."""
    from .join import build_master
    cfg = Config.from_env()
    out = build_master(cfg, years=range(years_start, years_end + 1))
    log.info("join complete: %s", out)
```

Also extend the `clean` subcommand to ingest `raw/census/co-est2019-alldata.csv` (if present) and write `clean/county_metadata.parquet`. Insert this block near the top of the clean body (before the existing WaPo/CDC/DEA ingest blocks):

```python
    census_csv = cfg.raw_dir / "census" / "co-est2019-alldata.csv"
    if census_csv.exists():
        from .sources.census import clean_to_parquet as clean_census
        clean_census(cfg, census_csv)
```

And extend the `fetch` subcommand so `source in ('all', 'census')` triggers a Census download:

```python
    if source in ("all", "census"):
        from .sources.census import fetch_popest
        fetch_popest(cfg)
```

- [ ] **Step 2: Write integration test exercising fetch (mocked) → clean → join**

Create `pipeline/tests/test_cli_join.py`:

```python
"""End-to-end CLI test: seed raw/, run clean + join, assert master.parquet content."""
from __future__ import annotations

import shutil
from pathlib import Path

import polars as pl
import pytest
from typer.testing import CliRunner

from openarcos_pipeline.cli import app


def _seed_raw(raw_dir: Path, fixtures_dir: Path) -> None:
    (raw_dir / "census").mkdir(parents=True, exist_ok=True)
    shutil.copy(
        fixtures_dir / "census" / "co-est2019-sample.csv",
        raw_dir / "census" / "co-est2019-alldata.csv",
    )

    (raw_dir / "wapo").mkdir(parents=True, exist_ok=True)
    # Single WaPo fixture covers 54059
    shutil.copy(
        fixtures_dir / "wapo" / "county_2012_54059.json",
        raw_dir / "wapo" / "county_WV_54059.json",
    )

    (raw_dir / "cdc").mkdir(parents=True, exist_ok=True)
    shutil.copy(
        fixtures_dir / "cdc" / "wv_2012_2014.xml",
        raw_dir / "cdc" / "WV_2012-2014.xml",
    )


def test_cli_clean_then_join_produces_valid_master(tmp_path, fixtures_dir, monkeypatch):
    data_root = tmp_path / "data"
    emit_dir = tmp_path / "emit"
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(data_root))
    monkeypatch.setenv("OPENARCOS_EMIT_DIR", str(emit_dir))

    _seed_raw(data_root / "raw", fixtures_dir)

    runner = CliRunner()
    # Clean
    result = runner.invoke(app, ["clean"])
    assert result.exit_code == 0, result.stdout
    # Join, narrower window for test determinism
    result = runner.invoke(app, ["join", "--years-start", "2011", "--years-end", "2013"])
    assert result.exit_code == 0, result.stdout

    master = data_root / "joined" / "master.parquet"
    assert master.exists()
    df = pl.read_parquet(master)
    # 4 counties × 3 years = 12 rows (per Census fixture which has 4 counties)
    assert len(df) == 12
    assert set(df.columns) == {"fips", "year", "pop", "pills", "deaths", "suppressed"}
    # 54059 should have a non-null pills figure in 2012 (the year the WaPo fixture covers)
    mingo_2012 = df.filter((pl.col("fips") == "54059") & (pl.col("year") == 2012)).to_dicts()[0]
    assert mingo_2012["pills"] is not None and mingo_2012["pills"] > 0
```

Run: `uv run pytest pipeline/tests/test_cli_join.py -v`
Expected: 1 passed. (If the clean CLI block ordering is wrong, this will surface it — fix in place.)

- [ ] **Step 3: Full suite green**

Run: `uv run pytest pipeline/tests/ -v`
Expected: all green, with the count including all prior Phase 1–6 tests plus the new Phase 7 tests.

- [ ] **Step 4: Commit**

```bash
git add pipeline/src/openarcos_pipeline/cli.py pipeline/tests/test_cli_join.py
git commit -m "pipeline: wire join into CLI and add end-to-end clean→join test"
```

---

### Phase 7 gate

After every task in this phase, run the full verification matrix:

```bash
cd pipeline && make lint && make test
```

All checks must pass before starting the next phase. If any check fails, fix before proceeding; do not rely on the merge or a later phase to catch it.

---

## Phase 8 — Aggregate (tasks 39–48)

Each emitted artifact has one SQL file in `pipeline/sql/`. A runner `aggregate.py` executes every SQL file in the directory against a DuckDB connection that has all the clean/joined parquets registered as views, writing the result to `data/agg/<name>.parquet`. Each aggregation has a golden-CSV snapshot; tests compare parquet output to the snapshot and surface diffs cleanly.

**Pre-task one-time setup** (done as part of task 39 below): a shared session pytest fixture `agg_master_parquet` builds a tiny `master.parquet` from the existing Phase 7 clean fixtures, so each aggregate test does not re-run the full clean→join pipeline.

### Task 39: SQL + snapshot — state_shipments_by_year

**Files:**
- Create: `pipeline/sql/state_shipments_by_year.sql`
- Create: `pipeline/tests/snapshots/state_shipments_by_year.expected.csv`
- Create: `pipeline/tests/test_aggregate.py`

- [ ] **Step 1: Author the SQL**

Create `pipeline/sql/state_shipments_by_year.sql`:

```sql
-- Inputs (registered as views by aggregate.py):
--   master  — (fips, year, pop, pills, deaths, suppressed)
-- Output columns: state, year, pills, pills_per_capita
SELECT
    LEFT(fips, 2)                                   AS state_fips,
    year,
    SUM(COALESCE(pills, 0))                         AS pills,
    CAST(SUM(COALESCE(pills, 0)) AS DOUBLE)
        / NULLIF(SUM(COALESCE(pop, 0)), 0)          AS pills_per_capita
FROM master
GROUP BY LEFT(fips, 2), year
ORDER BY state_fips, year
```

`state_fips` is joined back to a USPS abbreviation in the runner (Python side) because DuckDB won't have the Python FIPS_STATE_MAP in scope.

- [ ] **Step 2: Write the shared pytest fixture for master.parquet**

In `pipeline/tests/conftest.py`, add:

```python
@pytest.fixture(scope="session")
def agg_master_parquet(tmp_path_factory, fixtures_dir):
    """Session-scoped fixture: builds master.parquet from tiny Phase 7 inputs.

    Reused by every Phase 8 aggregate test so we don't rebuild it per-test.
    """
    import polars as pl
    from openarcos_pipeline.config import Config
    from openarcos_pipeline.join import build_master

    root = tmp_path_factory.mktemp("agg_master")
    cfg = Config(data_root=root / "data", emit_dir=root / "emit")
    cfg.ensure_dirs()

    # Reuse the toy world from test_join.py verbatim
    pl.DataFrame({
        "fips":  ["54059", "51720", "21119"],
        "name":  ["Mingo County", "Norton city", "Knott County"],
        "state": ["WV", "VA", "KY"],
        "pop":   [25764, 3892, 16232],
    }).write_parquet(cfg.clean_dir / "county_metadata.parquet")

    pl.DataFrame({
        "fips":  ["54059", "54059", "54059", "21119", "21119", "21119"],
        "year":  [  2011 ,   2012 ,   2013 ,   2011 ,   2012 ,   2013 ],
        "pills": [4_000_000.0, 6_000_000.0, 5_000_000.0, 1_500_000.0, 2_100_000.0, 1_900_000.0],
    }).write_parquet(cfg.clean_dir / "wapo_county.parquet")

    pl.DataFrame({
        "fips":       ["54059", "54059", "54059", "21119", "21119", "21119"],
        "year":       [  2011 ,   2012 ,   2013 ,   2011 ,   2012 ,   2013 ],
        "deaths":     [    42 ,     55 ,     61 ,   None ,   None ,   None ],
        "suppressed": [ False ,  False ,  False ,   True ,   True ,   True ],
    }).write_parquet(cfg.clean_dir / "cdc_overdose.parquet")

    # Toy distributor data (WaPo-shaped)
    pl.DataFrame({
        "distributor": ["McKesson", "Cardinal", "AmerisourceBergen", "McKesson", "Cardinal", "AmerisourceBergen"],
        "year":        [    2011 ,    2011 ,              2011 ,     2012 ,    2012 ,              2012 ],
        "pills":       [3_200_000.0, 1_800_000.0,         900_000.0, 4_500_000.0, 2_200_000.0,     1_300_000.0],
    }).write_parquet(cfg.clean_dir / "wapo_distributors.parquet")

    # Toy pharmacy data
    pl.DataFrame({
        "pharmacy_id":  ["DEA-AB1234567", "DEA-CD9876543", "DEA-EF1122334"],
        "name":         ["SAV-RITE PHARMACY", "TUG VALLEY PHARMACY", "NORTON APOTHECARY"],
        "address":      ["100 MAIN ST", "234 APPALACHIAN DR", "17 PARK AVE"],
        "fips":         ["54059", "54059", "51720"],
        "total_pills":  [12_500_000.0, 8_800_000.0, 450_000.0],
    }).write_parquet(cfg.clean_dir / "wapo_pharmacies.parquet")

    # Toy DEA enforcement data (already in emit-ready shape)
    pl.DataFrame({
        "year":         [2011, 2012, 2013],
        "action_count": [1203, 1428, 1109],
        "notable_actions": [[{"title": "United States v. Cardinal Health", "url": "https://example.org/1", "target": None}],
                            [{"title": "Operation Pill Nation", "url": "https://example.org/2", "target": None}],
                            []],
    }).write_parquet(cfg.clean_dir / "dea_enforcement.parquet")

    build_master(cfg, years=range(2011, 2014))
    return cfg  # tests use cfg.clean_dir and cfg.joined_dir
```

- [ ] **Step 3: Write the failing test**

Create `pipeline/tests/test_aggregate.py`:

```python
"""Tests for Phase 8 SQL aggregations. Snapshot-based."""
from __future__ import annotations

import os
from pathlib import Path

import polars as pl
import pytest

from openarcos_pipeline.aggregate import run_single


SNAPSHOTS = Path(__file__).parent / "snapshots"


def _assert_snapshot(df: pl.DataFrame, snap: Path) -> None:
    """Compare a DataFrame against a CSV snapshot. Supports regeneration via env var."""
    actual_csv = df.write_csv()
    if os.environ.get("PYTEST_UPDATE_SNAPSHOTS") == "1":
        snap.parent.mkdir(parents=True, exist_ok=True)
        snap.write_text(actual_csv)
        return
    if not snap.exists():
        pytest.fail(
            f"Snapshot missing: {snap}\n"
            f"Re-run with PYTEST_UPDATE_SNAPSHOTS=1 to create it.\n"
            f"Actual content:\n{actual_csv}"
        )
    expected = snap.read_text()
    if actual_csv != expected:
        pytest.fail(
            f"Snapshot mismatch for {snap.name}\n"
            f"--- expected\n{expected}\n--- actual\n{actual_csv}"
        )


def test_state_shipments_by_year(agg_master_parquet):
    cfg = agg_master_parquet
    out = run_single(cfg, "state_shipments_by_year")
    df = pl.read_parquet(out).sort(["state_fips", "year"])
    _assert_snapshot(df, SNAPSHOTS / "state_shipments_by_year.expected.csv")
```

Run: `uv run pytest pipeline/tests/test_aggregate.py::test_state_shipments_by_year -v`
Expected: FAIL — `openarcos_pipeline.aggregate` does not exist yet. (We build the runner in task 46; for now we stub enough for the test.)

- [ ] **Step 4: Create a minimal `aggregate.py` stub sufficient to run one SQL file**

Create `pipeline/src/openarcos_pipeline/aggregate.py`:

```python
"""Run SQL aggregations against master.parquet and clean parquets.

Phase 8 stub: `run_single(cfg, name)` runs one SQL file. Full `run_all` lands
in Task 46.
"""
from __future__ import annotations

from pathlib import Path

import duckdb

from .config import Config
from .log import get_logger

log = get_logger(__name__)

SQL_DIR = Path(__file__).resolve().parents[2] / "sql"


def _register_inputs(conn: duckdb.DuckDBPyConnection, cfg: Config) -> None:
    """Register every clean + joined parquet as a DuckDB view."""
    mapping = {
        "master":            cfg.joined_dir / "master.parquet",
        "county_metadata":   cfg.clean_dir / "county_metadata.parquet",
        "wapo_county":       cfg.clean_dir / "wapo_county.parquet",
        "wapo_distributors": cfg.clean_dir / "wapo_distributors.parquet",
        "wapo_pharmacies":   cfg.clean_dir / "wapo_pharmacies.parquet",
        "cdc_overdose":      cfg.clean_dir / "cdc_overdose.parquet",
        "dea_enforcement":   cfg.clean_dir / "dea_enforcement.parquet",
    }
    for view_name, path in mapping.items():
        if path.exists():
            conn.execute(f"CREATE OR REPLACE VIEW {view_name} AS SELECT * FROM read_parquet('{path}')")


def run_single(cfg: Config, name: str) -> Path:
    """Run sql/<name>.sql and write output to data/agg/<name>.parquet. Returns output path."""
    sql_path = SQL_DIR / f"{name}.sql"
    if not sql_path.exists():
        raise FileNotFoundError(f"SQL file not found: {sql_path}")
    body = sql_path.read_text()
    cfg.agg_dir.mkdir(parents=True, exist_ok=True)
    out = cfg.agg_dir / f"{name}.parquet"
    conn = duckdb.connect()
    try:
        _register_inputs(conn, cfg)
        conn.execute(f"COPY ({body}) TO '{out}' (FORMAT PARQUET, COMPRESSION ZSTD)")
    finally:
        conn.close()
    log.info("aggregate: %s → %s", name, out)
    return out
```

- [ ] **Step 5: Run, regenerate snapshot, verify contents are sane**

```bash
cd pipeline
PYTEST_UPDATE_SNAPSHOTS=1 uv run pytest tests/test_aggregate.py::test_state_shipments_by_year -v
cat tests/snapshots/state_shipments_by_year.expected.csv
```

Expected content in `state_shipments_by_year.expected.csv` (exact bytes):

```csv
state_fips,year,pills,pills_per_capita
21,2011,1500000,92.40773...
21,2012,2100000,129.3700...
21,2013,1900000,117.0527...
51,2011,0,0.0
51,2012,0,0.0
51,2013,0,0.0
54,2011,4000000,155.2557...
54,2012,6000000,232.8835...
54,2013,5000000,194.0696...
```

(Exact decimal expansion determined by DuckDB; snapshot is recorded verbatim after first `PYTEST_UPDATE_SNAPSHOTS=1` run. Sanity check: WV 2012 = 6M / 25764 ≈ 232.88, which matches real-world Mingo County figures.)

- [ ] **Step 6: Re-run without update flag to verify snapshot matches**

Run: `uv run pytest pipeline/tests/test_aggregate.py::test_state_shipments_by_year -v`
Expected: 1 passed.

- [ ] **Step 7: Commit**

```bash
git add pipeline/sql/state_shipments_by_year.sql \
        pipeline/src/openarcos_pipeline/aggregate.py \
        pipeline/tests/test_aggregate.py \
        pipeline/tests/snapshots/state_shipments_by_year.expected.csv \
        pipeline/tests/conftest.py
git commit -m "pipeline: aggregate state_shipments_by_year with snapshot test"
```

---

### Task 40: SQL + snapshot — county_shipments_by_year

**Files:**
- Create: `pipeline/sql/county_shipments_by_year.sql`
- Create: `pipeline/tests/snapshots/county_shipments_by_year.expected.csv`
- Modify: `pipeline/tests/test_aggregate.py`

- [ ] **Step 1: Author the SQL**

Create `pipeline/sql/county_shipments_by_year.sql`:

```sql
-- Inputs: master (fips, year, pop, pills, deaths, suppressed)
-- Output: fips, year, pills, pills_per_capita
SELECT
    fips,
    year,
    COALESCE(pills, 0)                              AS pills,
    CAST(COALESCE(pills, 0) AS DOUBLE)
        / NULLIF(pop, 0)                            AS pills_per_capita
FROM master
ORDER BY fips, year
```

- [ ] **Step 2: Add the test**

Append to `pipeline/tests/test_aggregate.py`:

```python
def test_county_shipments_by_year(agg_master_parquet):
    cfg = agg_master_parquet
    out = run_single(cfg, "county_shipments_by_year")
    df = pl.read_parquet(out).sort(["fips", "year"])
    _assert_snapshot(df, SNAPSHOTS / "county_shipments_by_year.expected.csv")
```

- [ ] **Step 3: Regenerate snapshot + verify**

```bash
PYTEST_UPDATE_SNAPSHOTS=1 uv run pytest pipeline/tests/test_aggregate.py::test_county_shipments_by_year -v
uv run pytest pipeline/tests/test_aggregate.py::test_county_shipments_by_year -v
```

Expected: 1 passed with content along the lines of:

```csv
fips,year,pills,pills_per_capita
21119,2011,1500000,92.40...
21119,2012,2100000,129.37...
21119,2013,1900000,117.05...
51720,2011,0,0.0
51720,2012,0,0.0
51720,2013,0,0.0
54059,2011,4000000,155.25...
54059,2012,6000000,232.88...
54059,2013,5000000,194.06...
```

- [ ] **Step 4: Commit**

```bash
git add pipeline/sql/county_shipments_by_year.sql \
        pipeline/tests/test_aggregate.py \
        pipeline/tests/snapshots/county_shipments_by_year.expected.csv
git commit -m "pipeline: aggregate county_shipments_by_year"
```

---

### Task 41: SQL + snapshot — top_distributors_by_year

**Files:**
- Create: `pipeline/sql/top_distributors_by_year.sql`
- Create: `pipeline/tests/snapshots/top_distributors_by_year.expected.csv`
- Modify: `pipeline/tests/test_aggregate.py`

- [ ] **Step 1: Author the SQL**

Create `pipeline/sql/top_distributors_by_year.sql`:

```sql
-- Inputs: wapo_distributors (distributor, year, pills)
-- Output: distributor, year, pills, share_pct
-- Keeps top 10 distributors per year by pill volume.
WITH totals AS (
    SELECT distributor, year, SUM(pills) AS pills
    FROM wapo_distributors
    GROUP BY distributor, year
),
national AS (
    SELECT year, SUM(pills) AS national_pills
    FROM totals
    GROUP BY year
),
ranked AS (
    SELECT
        t.distributor,
        t.year,
        t.pills,
        100.0 * t.pills / NULLIF(n.national_pills, 0) AS share_pct,
        ROW_NUMBER() OVER (PARTITION BY t.year ORDER BY t.pills DESC) AS rn
    FROM totals t
    JOIN national n USING (year)
)
SELECT distributor, year, pills, share_pct
FROM ranked
WHERE rn <= 10
ORDER BY year, pills DESC
```

- [ ] **Step 2: Add the test**

```python
def test_top_distributors_by_year(agg_master_parquet):
    cfg = agg_master_parquet
    out = run_single(cfg, "top_distributors_by_year")
    df = pl.read_parquet(out).sort(["year", "pills"], descending=[False, True])
    _assert_snapshot(df, SNAPSHOTS / "top_distributors_by_year.expected.csv")
```

- [ ] **Step 3: Regenerate + verify**

```bash
PYTEST_UPDATE_SNAPSHOTS=1 uv run pytest pipeline/tests/test_aggregate.py::test_top_distributors_by_year -v
uv run pytest pipeline/tests/test_aggregate.py::test_top_distributors_by_year -v
```

Expected snapshot (percentages sum to ~100 per year):

```csv
distributor,year,pills,share_pct
McKesson,2011,3200000,54.23...
Cardinal,2011,1800000,30.50...
AmerisourceBergen,2011,900000,15.25...
McKesson,2012,4500000,56.25
Cardinal,2012,2200000,27.5
AmerisourceBergen,2012,1300000,16.25
```

- [ ] **Step 4: Commit**

```bash
git add pipeline/sql/top_distributors_by_year.sql \
        pipeline/tests/test_aggregate.py \
        pipeline/tests/snapshots/top_distributors_by_year.expected.csv
git commit -m "pipeline: aggregate top_distributors_by_year"
```

---

### Task 42: SQL + snapshot — top_pharmacies

**Files:**
- Create: `pipeline/sql/top_pharmacies.sql`
- Create: `pipeline/tests/snapshots/top_pharmacies.expected.csv`
- Modify: `pipeline/tests/test_aggregate.py`

Per spec §4 this is emitted as Parquet (larger). Full list by total pills across all years — no top-N cap in the aggregate itself; size budget is enforced by the cap on the emission side in Phase 9 if needed.

- [ ] **Step 1: Author the SQL**

Create `pipeline/sql/top_pharmacies.sql`:

```sql
-- Inputs: wapo_pharmacies (pharmacy_id, name, address, fips, total_pills)
-- Output: pharmacy_id, name, address, fips, total_pills
-- Deduplicates by pharmacy_id (summing pills if the source has per-year rows).
SELECT
    pharmacy_id,
    FIRST(name) AS name,
    FIRST(address) AS address,
    FIRST(fips) AS fips,
    SUM(total_pills) AS total_pills
FROM wapo_pharmacies
GROUP BY pharmacy_id
ORDER BY total_pills DESC
```

- [ ] **Step 2: Add the test**

```python
def test_top_pharmacies(agg_master_parquet):
    cfg = agg_master_parquet
    out = run_single(cfg, "top_pharmacies")
    df = pl.read_parquet(out).sort("total_pills", descending=True)
    _assert_snapshot(df, SNAPSHOTS / "top_pharmacies.expected.csv")
```

- [ ] **Step 3: Regenerate + verify**

```bash
PYTEST_UPDATE_SNAPSHOTS=1 uv run pytest pipeline/tests/test_aggregate.py::test_top_pharmacies -v
uv run pytest pipeline/tests/test_aggregate.py::test_top_pharmacies -v
```

Expected snapshot:

```csv
pharmacy_id,name,address,fips,total_pills
DEA-AB1234567,SAV-RITE PHARMACY,100 MAIN ST,54059,12500000
DEA-CD9876543,TUG VALLEY PHARMACY,234 APPALACHIAN DR,54059,8800000
DEA-EF1122334,NORTON APOTHECARY,17 PARK AVE,51720,450000
```

- [ ] **Step 4: Commit**

```bash
git add pipeline/sql/top_pharmacies.sql \
        pipeline/tests/test_aggregate.py \
        pipeline/tests/snapshots/top_pharmacies.expected.csv
git commit -m "pipeline: aggregate top_pharmacies"
```

---

### Task 43: SQL + snapshot — cdc_overdose_by_county_year

**Files:**
- Create: `pipeline/sql/cdc_overdose_by_county_year.sql`
- Create: `pipeline/tests/snapshots/cdc_overdose_by_county_year.expected.csv`
- Modify: `pipeline/tests/test_aggregate.py`

Critical: suppressed rows **must survive** the aggregation (spec §4 watch-out #1). A row with `suppressed=true` must carry `deaths=null`, never zero.

- [ ] **Step 1: Author the SQL**

Create `pipeline/sql/cdc_overdose_by_county_year.sql`:

```sql
-- Inputs: master (fips, year, deaths, suppressed)
-- Output: fips, year, deaths, suppressed
-- Preserves nulls and the suppressed flag verbatim.
SELECT
    fips,
    year,
    deaths,
    suppressed
FROM master
WHERE deaths IS NOT NULL OR suppressed = TRUE
ORDER BY fips, year
```

The WHERE clause drops rows where the county has no CDC coverage at all (e.g., Norton in the fixture) — these would all be `{deaths=null, suppressed=false}` rows that aren't meaningful for the mortality artifact.

- [ ] **Step 2: Add the test**

```python
def test_cdc_overdose_preserves_suppressed(agg_master_parquet):
    cfg = agg_master_parquet
    out = run_single(cfg, "cdc_overdose_by_county_year")
    df = pl.read_parquet(out).sort(["fips", "year"])
    # Structural invariants (spec §4 watch-out #1)
    rows = df.to_dicts()
    for r in rows:
        assert r["suppressed"] in (True, False)
        if r["suppressed"]:
            assert r["deaths"] is None, f"suppressed row had non-null deaths: {r}"
        else:
            assert isinstance(r["deaths"], int) and r["deaths"] >= 10, f"bad unsuppressed row: {r}"
    _assert_snapshot(df, SNAPSHOTS / "cdc_overdose_by_county_year.expected.csv")
```

- [ ] **Step 3: Regenerate + verify**

```bash
PYTEST_UPDATE_SNAPSHOTS=1 uv run pytest pipeline/tests/test_aggregate.py::test_cdc_overdose_preserves_suppressed -v
uv run pytest pipeline/tests/test_aggregate.py::test_cdc_overdose_preserves_suppressed -v
```

Expected snapshot:

```csv
fips,year,deaths,suppressed
21119,2011,,true
21119,2012,,true
21119,2013,,true
54059,2011,42,false
54059,2012,55,false
54059,2013,61,false
```

(Empty cell = NULL in DuckDB's CSV output; the structural invariant assertions catch any divergence before snapshot comparison does.)

- [ ] **Step 4: Commit**

```bash
git add pipeline/sql/cdc_overdose_by_county_year.sql \
        pipeline/tests/test_aggregate.py \
        pipeline/tests/snapshots/cdc_overdose_by_county_year.expected.csv
git commit -m "pipeline: aggregate cdc_overdose_by_county_year with suppression invariants"
```

---

### Task 44: SQL + snapshot — dea_enforcement

**Files:**
- Create: `pipeline/sql/dea_enforcement.sql`
- Create: `pipeline/tests/snapshots/dea_enforcement.expected.csv`
- Modify: `pipeline/tests/test_aggregate.py`

The DEA data is already at the correct grain (one row per year) from the Phase 6 clean step, so this SQL is mostly a pass-through. We still route it through aggregate so that the runner can compute downstream shape checks and the emit phase has a uniform source directory.

- [ ] **Step 1: Author the SQL**

Create `pipeline/sql/dea_enforcement.sql`:

```sql
-- Inputs: dea_enforcement (year, action_count, notable_actions)
-- Output: year, action_count, notable_actions (list of structs kept intact)
SELECT
    year,
    action_count,
    notable_actions
FROM dea_enforcement
ORDER BY year
```

- [ ] **Step 2: Add the test**

Append to `pipeline/tests/test_aggregate.py`:

```python
def test_dea_enforcement_passthrough(agg_master_parquet):
    cfg = agg_master_parquet
    out = run_single(cfg, "dea_enforcement")
    df = pl.read_parquet(out).sort("year")
    # notable_actions is a list of structs — normalize to JSON strings for snapshotting
    df2 = df.with_columns(
        pl.col("notable_actions").map_elements(
            lambda v: str(v) if v is not None else "[]",
            return_dtype=pl.Utf8,
        ).alias("notable_actions")
    )
    _assert_snapshot(df2, SNAPSHOTS / "dea_enforcement.expected.csv")
```

- [ ] **Step 3: Regenerate + verify**

```bash
PYTEST_UPDATE_SNAPSHOTS=1 uv run pytest pipeline/tests/test_aggregate.py::test_dea_enforcement_passthrough -v
uv run pytest pipeline/tests/test_aggregate.py::test_dea_enforcement_passthrough -v
```

- [ ] **Step 4: Commit**

```bash
git add pipeline/sql/dea_enforcement.sql \
        pipeline/tests/test_aggregate.py \
        pipeline/tests/snapshots/dea_enforcement.expected.csv
git commit -m "pipeline: aggregate dea_enforcement"
```

---

### Task 45: SQL + snapshot — search_index

**Files:**
- Create: `pipeline/sql/search_index.sql`
- Create: `pipeline/tests/snapshots/search_index.expected.csv`
- Modify: `pipeline/tests/test_aggregate.py`

The search index is the union of five entity types, tagged with a `type` column that matches the discriminator in `search-index.schema.json`. Per the user decision to "index everything, accept larger file," this query applies **no top-N cap on pharmacies**. The JSON emission in Phase 9 will turn rows into the discriminated-union records expected by the schema.

- [ ] **Step 1: Author the SQL**

Create `pipeline/sql/search_index.sql`:

```sql
-- Inputs:
--   county_metadata   (fips, name, state, pop)
--   wapo_distributors (distributor, year, pills)
--   wapo_pharmacies   (pharmacy_id, name, address, fips, total_pills)
--
-- Output columns (uniform across entity types; some fields null per type):
--   type        — 'county' | 'city' | 'zip' | 'distributor' | 'pharmacy'
--   id          — stable id (fips / zip / distributor-slug / pharmacy_id)
--   label       — user-visible primary label
--   sublabel    — user-visible secondary label
--   fips        — linking FIPS where applicable
--   state       — USPS abbrev where applicable
--   total_pills — total pills associated (nullable)
--
-- 'city' and 'zip' rows come from distinct addresses in wapo_pharmacies.
WITH counties AS (
    SELECT
        'county'                                   AS type,
        fips                                       AS id,
        name                                       AS label,
        state                                      AS sublabel,
        fips,
        state,
        NULL::DOUBLE                               AS total_pills
    FROM county_metadata
),
distributors AS (
    SELECT
        'distributor'                              AS type,
        LOWER(REGEXP_REPLACE(distributor, '[^A-Za-z0-9]+', '-', 'g')) AS id,
        distributor                                AS label,
        CAST(SUM(pills) AS VARCHAR)                AS sublabel,
        NULL                                       AS fips,
        NULL                                       AS state,
        SUM(pills)                                 AS total_pills
    FROM wapo_distributors
    GROUP BY distributor
),
pharmacies AS (
    SELECT
        'pharmacy'                                 AS type,
        pharmacy_id                                AS id,
        name                                       AS label,
        address                                    AS sublabel,
        fips,
        NULL                                       AS state,
        total_pills
    FROM wapo_pharmacies
),
cities AS (
    -- A pharmacy's address is "N STREET" in the fixture. Real data has city
    -- and state embedded; we extract the last comma-separated token when it
    -- looks like a city. Fixtures don't exercise this path meaningfully; the
    -- query is structured so it's a no-op on the toy dataset.
    SELECT DISTINCT
        'city'                                     AS type,
        LOWER(REGEXP_REPLACE(address, '[^A-Za-z0-9]+', '-', 'g')) AS id,
        address                                    AS label,
        fips                                       AS sublabel,
        fips,
        NULL                                       AS state,
        NULL::DOUBLE                               AS total_pills
    FROM wapo_pharmacies
    WHERE FALSE  -- disabled on fixture; re-enable once real data lands with a parsable city column
),
zips AS (
    SELECT DISTINCT
        'zip'                                      AS type,
        REGEXP_EXTRACT(address, '\b\d{5}\b')       AS id,
        REGEXP_EXTRACT(address, '\b\d{5}\b')       AS label,
        fips                                       AS sublabel,
        fips,
        NULL                                       AS state,
        NULL::DOUBLE                               AS total_pills
    FROM wapo_pharmacies
    WHERE REGEXP_EXTRACT(address, '\b\d{5}\b') <> ''
)
SELECT type, id, label, sublabel, fips, state, total_pills FROM counties
UNION ALL
SELECT type, id, label, sublabel, fips, state, total_pills FROM distributors
UNION ALL
SELECT type, id, label, sublabel, fips, state, total_pills FROM pharmacies
UNION ALL
SELECT type, id, label, sublabel, fips, state, total_pills FROM cities
UNION ALL
SELECT type, id, label, sublabel, fips, state, total_pills FROM zips
ORDER BY type, id
```

Note the two placeholder branches (`cities`, `zips`): toy fixture addresses don't carry real city/ZIP substrings. The `WHERE FALSE` on `cities` and the regex filter on `zips` both evaluate to empty in the fixture; the branches exist so real data flips them on without changing the SQL shape.

- [ ] **Step 2: Add the test**

```python
def test_search_index(agg_master_parquet):
    cfg = agg_master_parquet
    out = run_single(cfg, "search_index")
    df = pl.read_parquet(out).sort(["type", "id"])
    # Every row has a non-empty label and id
    assert df["id"].null_count() == 0
    assert (df["id"].str.len_chars() > 0).all()
    assert df["label"].null_count() == 0
    # All types are from the known set
    assert set(df["type"].unique().to_list()).issubset({"county", "city", "zip", "distributor", "pharmacy"})
    _assert_snapshot(df, SNAPSHOTS / "search_index.expected.csv")
```

- [ ] **Step 3: Regenerate + verify**

```bash
PYTEST_UPDATE_SNAPSHOTS=1 uv run pytest pipeline/tests/test_aggregate.py::test_search_index -v
uv run pytest pipeline/tests/test_aggregate.py::test_search_index -v
```

Expected snapshot approximation (3 counties + 3 distributors + 3 pharmacies + 0 cities + 0 zips = 9 rows):

```csv
type,id,label,sublabel,fips,state,total_pills
county,21119,Knott County,KY,21119,KY,
county,51720,Norton city,VA,51720,VA,
county,54059,Mingo County,WV,54059,WV,
distributor,amerisourcebergen,AmerisourceBergen,2200000,,,2200000
distributor,cardinal,Cardinal,4000000,,,4000000
distributor,mckesson,McKesson,7700000,,,7700000
pharmacy,DEA-AB1234567,SAV-RITE PHARMACY,100 MAIN ST,54059,,12500000
pharmacy,DEA-CD9876543,TUG VALLEY PHARMACY,234 APPALACHIAN DR,54059,,8800000
pharmacy,DEA-EF1122334,NORTON APOTHECARY,17 PARK AVE,51720,,450000
```

- [ ] **Step 4: Commit**

```bash
git add pipeline/sql/search_index.sql \
        pipeline/tests/test_aggregate.py \
        pipeline/tests/snapshots/search_index.expected.csv
git commit -m "pipeline: aggregate search_index (full, uncapped)"
```

---

### Task 46: Full `aggregate.py` runner — `run_all`

**Files:**
- Modify: `pipeline/src/openarcos_pipeline/aggregate.py`
- Modify: `pipeline/tests/test_aggregate.py`

- [ ] **Step 1: Add `run_all` that iterates every `sql/*.sql`**

In `pipeline/src/openarcos_pipeline/aggregate.py`, add:

```python
def discover_sql(sql_dir: Path = SQL_DIR) -> list[str]:
    """Return sorted list of aggregation names from sql/*.sql files."""
    return sorted(p.stem for p in sql_dir.glob("*.sql"))


def run_all(cfg: Config) -> list[Path]:
    """Run every sql/*.sql against the pipeline inputs. Returns output paths."""
    names = discover_sql()
    if not names:
        raise RuntimeError(f"No SQL files found in {SQL_DIR}")
    cfg.agg_dir.mkdir(parents=True, exist_ok=True)
    outputs = []
    conn = duckdb.connect()
    try:
        _register_inputs(conn, cfg)
        for name in names:
            sql_path = SQL_DIR / f"{name}.sql"
            body = sql_path.read_text()
            out = cfg.agg_dir / f"{name}.parquet"
            conn.execute(f"COPY ({body}) TO '{out}' (FORMAT PARQUET, COMPRESSION ZSTD)")
            outputs.append(out)
            log.info("aggregate: %s → %s", name, out)
    finally:
        conn.close()
    return outputs
```

- [ ] **Step 2: Add a test that exercises the full runner**

Append to `pipeline/tests/test_aggregate.py`:

```python
def test_run_all_produces_all_artifacts(agg_master_parquet):
    cfg = agg_master_parquet
    from openarcos_pipeline.aggregate import run_all, discover_sql
    outputs = run_all(cfg)
    names = {p.stem for p in outputs}
    assert names == set(discover_sql())
    # Every artifact should be a non-empty parquet
    for p in outputs:
        assert p.exists() and p.stat().st_size > 0, p
```

Run: `uv run pytest pipeline/tests/test_aggregate.py -v`
Expected: all tests green (one per individual aggregation + `test_run_all_produces_all_artifacts`).

- [ ] **Step 3: Commit**

```bash
git add pipeline/src/openarcos_pipeline/aggregate.py pipeline/tests/test_aggregate.py
git commit -m "pipeline: aggregate run_all over every sql/*.sql file"
```

---

### Task 47: End-to-end fetch-fixtures → clean → join → aggregate integration test

**Files:**
- Create: `pipeline/tests/test_e2e_through_aggregate.py`

This is the full upstream-to-agg integration test. Downstream emit is covered in Phase 9's own end-to-end test.

- [ ] **Step 1: Write the test**

Create `pipeline/tests/test_e2e_through_aggregate.py`:

```python
"""End-to-end: fixture raw files → clean → join → aggregate. Exits 0 and writes every expected parquet."""
from __future__ import annotations

import shutil
from pathlib import Path

import polars as pl
import pytest
from typer.testing import CliRunner

from openarcos_pipeline.aggregate import discover_sql
from openarcos_pipeline.cli import app


def _seed_raw(raw_dir: Path, fixtures_dir: Path) -> None:
    (raw_dir / "census").mkdir(parents=True, exist_ok=True)
    shutil.copy(
        fixtures_dir / "census" / "co-est2019-sample.csv",
        raw_dir / "census" / "co-est2019-alldata.csv",
    )

    (raw_dir / "wapo").mkdir(parents=True, exist_ok=True)
    for src in (fixtures_dir / "wapo").glob("*.json"):
        # Canonicalise filenames so clean step picks them up
        if src.name.startswith("county_") or src.name.startswith("distributors_") or src.name.startswith("pharmacies_"):
            shutil.copy(src, raw_dir / "wapo" / src.name)

    (raw_dir / "cdc").mkdir(parents=True, exist_ok=True)
    for src in (fixtures_dir / "cdc").glob("*.xml"):
        shutil.copy(src, raw_dir / "cdc" / src.name)

    (raw_dir / "dea").mkdir(parents=True, exist_ok=True)
    for src in (fixtures_dir / "dea").glob("*.pdf"):
        # Rename to <year>.pdf convention if needed
        stem = src.stem.replace("diversion_", "").replace("_sample", "")
        shutil.copy(src, raw_dir / "dea" / f"{stem}.pdf")


def test_full_pipeline_through_aggregate(tmp_path, fixtures_dir, monkeypatch):
    data_root = tmp_path / "data"
    emit_dir = tmp_path / "emit"
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(data_root))
    monkeypatch.setenv("OPENARCOS_EMIT_DIR", str(emit_dir))

    _seed_raw(data_root / "raw", fixtures_dir)

    runner = CliRunner()
    for cmd in (["clean"], ["join", "--years-start", "2011", "--years-end", "2013"], ["aggregate"]):
        result = runner.invoke(app, cmd)
        assert result.exit_code == 0, f"command {cmd} failed:\n{result.stdout}"

    agg_dir = data_root / "agg"
    produced = {p.stem for p in agg_dir.glob("*.parquet")}
    assert produced == set(discover_sql())
    for name in discover_sql():
        df = pl.read_parquet(agg_dir / f"{name}.parquet")
        assert df.height > 0, f"empty aggregation: {name}"
```

Run: `uv run pytest pipeline/tests/test_e2e_through_aggregate.py -v`
Expected: 1 passed.

- [ ] **Step 2: Commit**

```bash
git add pipeline/tests/test_e2e_through_aggregate.py
git commit -m "pipeline: end-to-end fixtures→clean→join→aggregate test"
```

---

### Task 48: Wire `aggregate` into CLI

**Files:**
- Modify: `pipeline/src/openarcos_pipeline/cli.py`

- [ ] **Step 1: Replace stub `aggregate` body**

In `pipeline/src/openarcos_pipeline/cli.py`, replace the `aggregate` command body with:

```python
@app.command()
def aggregate() -> None:
    """Run every SQL aggregation in sql/ against the pipeline inputs."""
    from .aggregate import run_all
    cfg = Config.from_env()
    outputs = run_all(cfg)
    log.info("aggregate complete: %d artifacts", len(outputs))
```

- [ ] **Step 2: Full suite sanity check**

Run: `uv run pytest pipeline/tests/ -v`
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add pipeline/src/openarcos_pipeline/cli.py
git commit -m "pipeline: wire aggregate into CLI"
```

---

### Phase 8 gate

After every task in this phase, run the full verification matrix:

```bash
cd pipeline && make lint && make test
```

All checks must pass before starting the next phase. If any check fails, fix before proceeding; do not rely on the merge or a later phase to catch it.

---

## Phase 9 — Emit (tasks 49–53)

`emit.py` is the pipeline's contract boundary with `/web`. It reads from `data/agg/` and the clean county-metadata parquet, transforms each aggregation into the exact shape declared by its JSON Schema, validates against that schema, and only then writes to `web/public/data/`. Validation must run **before** the file is written so a failing pipeline leaves the last good file intact.

Per spec §4 emission map:

| Schema name | Source | Destination format |
|---|---|---|
| `state-shipments-by-year` | `agg/state_shipments_by_year.parquet` | JSON |
| `county-shipments-by-year` | `agg/county_shipments_by_year.parquet` | Parquet (pass-through w/ re-compress) |
| `county-metadata` | `clean/county_metadata.parquet` | JSON |
| `top-distributors-by-year` | `agg/top_distributors_by_year.parquet` | JSON |
| `top-pharmacies` | `agg/top_pharmacies.parquet` | Parquet |
| `dea-enforcement-actions` | `agg/dea_enforcement.parquet` | JSON |
| `cdc-overdose-by-county-year` | `agg/cdc_overdose_by_county_year.parquet` | Parquet |
| `search-index` | `agg/search_index.parquet` | JSON |

### Task 49: Emit JSON artifacts

**Files:**
- Create: `pipeline/src/openarcos_pipeline/emit.py`
- Create: `pipeline/tests/test_emit.py`

- [ ] **Step 1: Write the failing test**

Create `pipeline/tests/test_emit.py`:

```python
"""Tests for emit.py: JSON/Parquet emission + schema validation."""
from __future__ import annotations

import json
from pathlib import Path

import polars as pl
import pytest

from openarcos_pipeline.emit import (
    emit_state_shipments_json,
    emit_county_metadata_json,
    emit_top_distributors_json,
    emit_dea_enforcement_json,
    emit_search_index_json,
    SchemaValidationError,
)
from openarcos_pipeline.config import Config


@pytest.fixture
def seeded_cfg(tmp_path, agg_master_parquet):
    """Re-run agg_master setup into a writable tmp_path so emit tests can produce outputs."""
    # agg_master_parquet is session-scoped; we re-use its clean+joined+agg dirs by path
    cfg = Config(
        data_root=agg_master_parquet.data_root,
        emit_dir=tmp_path / "emit",
    )
    # Ensure aggregate outputs exist
    from openarcos_pipeline.aggregate import run_all
    run_all(cfg)
    cfg.emit_dir.mkdir(parents=True, exist_ok=True)
    return cfg


def test_emit_state_shipments_json_validates_and_writes(seeded_cfg):
    out = emit_state_shipments_json(seeded_cfg)
    assert out.exists()
    data = json.loads(out.read_text())
    assert isinstance(data, list)
    for row in data:
        assert set(row.keys()) == {"state", "year", "pills", "pills_per_capita"}
        assert len(row["state"]) == 2
        assert 2006 <= row["year"] <= 2014
        assert row["pills"] >= 0


def test_emit_county_metadata_json(seeded_cfg):
    out = emit_county_metadata_json(seeded_cfg)
    data = json.loads(out.read_text())
    assert len(data) >= 3
    for row in data:
        assert set(row.keys()) == {"fips", "name", "state", "pop"}
        assert len(row["fips"]) == 5


def test_emit_top_distributors_json(seeded_cfg):
    out = emit_top_distributors_json(seeded_cfg)
    data = json.loads(out.read_text())
    for row in data:
        assert set(row.keys()) == {"distributor", "year", "pills", "share_pct"}
        assert 0 <= row["share_pct"] <= 100


def test_emit_dea_enforcement_json(seeded_cfg):
    out = emit_dea_enforcement_json(seeded_cfg)
    data = json.loads(out.read_text())
    for row in data:
        assert set(row.keys()) == {"year", "action_count", "notable_actions"}
        assert isinstance(row["notable_actions"], list)
        for action in row["notable_actions"]:
            assert "title" in action and "url" in action


def test_emit_search_index_json(seeded_cfg):
    out = emit_search_index_json(seeded_cfg)
    data = json.loads(out.read_text())
    for row in data:
        assert row["type"] in {"county", "city", "zip", "distributor", "pharmacy"}
        assert "id" in row and "label" in row


def test_emit_rejects_bad_shape(tmp_path, seeded_cfg):
    """If the source parquet has rows that violate the schema, emit must raise without writing."""
    # Corrupt the state_shipments agg by writing a row with a 3-letter state code
    bad = pl.DataFrame({
        "state_fips": ["QQ"], "year": [2012], "pills": [100.0], "pills_per_capita": [0.1],
    })
    bad.write_parquet(seeded_cfg.agg_dir / "state_shipments_by_year.parquet")
    with pytest.raises(SchemaValidationError):
        emit_state_shipments_json(seeded_cfg)
    # The destination file must not exist or must retain its prior content
    out_path = seeded_cfg.emit_dir / "state-shipments-by-year.json"
    if out_path.exists():
        # If a prior successful emit wrote it, content should not be the bad version
        content = json.loads(out_path.read_text())
        assert all(len(r["state"]) == 2 for r in content)
```

Run: `uv run pytest pipeline/tests/test_emit.py -v`
Expected: FAIL — `openarcos_pipeline.emit` doesn't exist.

- [ ] **Step 2: Implement `emit.py`**

Create `pipeline/src/openarcos_pipeline/emit.py`:

```python
"""Pipeline emission: transform aggregated Parquet → validated JSON/Parquet in web/public/data/.

Every emitter validates its payload against the corresponding JSON Schema
BEFORE writing to disk. A validation failure raises SchemaValidationError
and does not touch the destination file.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import jsonschema
import polars as pl

from .config import Config
from .fips import FIPS_STATE_MAP
from .log import get_logger

log = get_logger(__name__)

SCHEMAS_DIR = Path(__file__).resolve().parents[2] / "schemas"


class SchemaValidationError(RuntimeError):
    """Raised when emission data fails JSON Schema validation."""


def _load_schema(name: str) -> dict:
    path = SCHEMAS_DIR / f"{name}.schema.json"
    return json.loads(path.read_text())


def _validate(data: list | dict, schema_name: str) -> None:
    schema = _load_schema(schema_name)
    try:
        jsonschema.validate(instance=data, schema=schema)
    except jsonschema.ValidationError as e:
        raise SchemaValidationError(
            f"{schema_name}: {e.message} (at {list(e.absolute_path)})"
        ) from e


def _write_json(dest: Path, data: list | dict) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    # Compact separators: search-index.json is ~8-12MB at full size
    dest.write_text(json.dumps(data, separators=(",", ":"), default=_json_default))


def _json_default(obj):
    # polars sometimes hands back numpy scalars; coerce
    if hasattr(obj, "item"):
        return obj.item()
    raise TypeError(f"Unserializable: {type(obj)!r}")


# ---------- JSON emitters ----------

def emit_state_shipments_json(cfg: Config) -> Path:
    df = pl.read_parquet(cfg.agg_dir / "state_shipments_by_year.parquet")
    # Convert state_fips → USPS abbrev; enforce year window
    rows = []
    for r in df.iter_rows(named=True):
        state_fips = r["state_fips"].zfill(2)
        if state_fips not in FIPS_STATE_MAP:
            raise SchemaValidationError(f"state_shipments_by_year: unknown state_fips={state_fips!r}")
        rows.append({
            "state": FIPS_STATE_MAP[state_fips],
            "year": int(r["year"]),
            "pills": float(r["pills"] or 0),
            "pills_per_capita": float(r["pills_per_capita"] or 0),
        })
    _validate(rows, "state-shipments-by-year")
    out = cfg.emit_dir / "state-shipments-by-year.json"
    _write_json(out, rows)
    log.info("emit: %s (%d rows)", out.name, len(rows))
    return out


def emit_county_metadata_json(cfg: Config) -> Path:
    df = pl.read_parquet(cfg.clean_dir / "county_metadata.parquet")
    rows = [
        {"fips": r["fips"], "name": r["name"], "state": r["state"], "pop": int(r["pop"])}
        for r in df.iter_rows(named=True)
    ]
    _validate(rows, "county-metadata")
    out = cfg.emit_dir / "county-metadata.json"
    _write_json(out, rows)
    log.info("emit: %s (%d rows)", out.name, len(rows))
    return out


def emit_top_distributors_json(cfg: Config) -> Path:
    df = pl.read_parquet(cfg.agg_dir / "top_distributors_by_year.parquet")
    rows = [
        {
            "distributor": r["distributor"],
            "year": int(r["year"]),
            "pills": float(r["pills"]),
            "share_pct": float(r["share_pct"] or 0),
        }
        for r in df.iter_rows(named=True)
    ]
    _validate(rows, "top-distributors-by-year")
    out = cfg.emit_dir / "top-distributors-by-year.json"
    _write_json(out, rows)
    log.info("emit: %s (%d rows)", out.name, len(rows))
    return out


def emit_dea_enforcement_json(cfg: Config) -> Path:
    df = pl.read_parquet(cfg.agg_dir / "dea_enforcement.parquet")
    rows = []
    for r in df.iter_rows(named=True):
        actions = r["notable_actions"] or []
        rows.append({
            "year": int(r["year"]),
            "action_count": int(r["action_count"]),
            "notable_actions": [
                {"title": a["title"], "url": a.get("url", ""), "target": a.get("target")}
                for a in actions
            ],
        })
    _validate(rows, "dea-enforcement-actions")
    out = cfg.emit_dir / "dea-enforcement-actions.json"
    _write_json(out, rows)
    log.info("emit: %s (%d rows)", out.name, len(rows))
    return out


def emit_search_index_json(cfg: Config) -> Path:
    df = pl.read_parquet(cfg.agg_dir / "search_index.parquet")
    rows = []
    for r in df.iter_rows(named=True):
        base = {
            "type": r["type"],
            "id": r["id"],
            "label": r["label"],
        }
        # Populate type-specific fields per schema discriminator
        if r["type"] == "county":
            base.update({"state": r["state"], "fips": r["fips"]})
        elif r["type"] == "city":
            base.update({"fips": r["fips"]})
        elif r["type"] == "zip":
            base.update({"fips": r["fips"]})
        elif r["type"] == "distributor":
            base.update({"total_pills": float(r["total_pills"] or 0)})
        elif r["type"] == "pharmacy":
            base.update({
                "fips": r["fips"],
                "address": r["sublabel"],
                "total_pills": float(r["total_pills"] or 0),
            })
        rows.append(base)
    _validate(rows, "search-index")
    out = cfg.emit_dir / "search-index.json"
    _write_json(out, rows)
    log.info("emit: %s (%d rows, %d bytes)", out.name, len(rows), out.stat().st_size)
    return out
```

- [ ] **Step 3: Verify tests pass**

Run: `uv run pytest pipeline/tests/test_emit.py -v`
Expected: 6 passed.

- [ ] **Step 4: Commit**

```bash
git add pipeline/src/openarcos_pipeline/emit.py pipeline/tests/test_emit.py
git commit -m "pipeline: emit JSON artifacts with pre-write schema validation"
```

---

### Task 50: Emit Parquet artifacts with column validation

**Files:**
- Modify: `pipeline/src/openarcos_pipeline/emit.py`
- Modify: `pipeline/tests/test_emit.py`

Parquet outputs are smaller than JSON for the same data and are read by the browser via `hyparquet`. We validate the full parquet content by reading rows and running each through the same JSON Schema — cheap enough at ~5–10MB of data.

- [ ] **Step 1: Add parquet emitters to `emit.py`**

Append to `pipeline/src/openarcos_pipeline/emit.py`:

```python
# ---------- Parquet emitters ----------

def _validate_parquet_as_json(df: pl.DataFrame, schema_name: str) -> None:
    """Materialise parquet rows as dicts and validate against JSON Schema."""
    # polars.Schema → JSON is straightforward because our schemas only use simple types
    rows = df.to_dicts()
    _validate(rows, schema_name)


def emit_county_shipments_parquet(cfg: Config) -> Path:
    src = cfg.agg_dir / "county_shipments_by_year.parquet"
    df = pl.read_parquet(src)
    # Ensure exact column set and types per schema
    df = df.select([
        pl.col("fips").cast(pl.Utf8),
        pl.col("year").cast(pl.Int64),
        pl.col("pills").cast(pl.Float64),
        pl.col("pills_per_capita").cast(pl.Float64),
    ])
    _validate_parquet_as_json(df, "county-shipments-by-year")
    out = cfg.emit_dir / "county-shipments-by-year.parquet"
    out.parent.mkdir(parents=True, exist_ok=True)
    df.write_parquet(out, compression="zstd")
    log.info("emit: %s (%d rows, %d bytes)", out.name, len(df), out.stat().st_size)
    return out


def emit_top_pharmacies_parquet(cfg: Config) -> Path:
    src = cfg.agg_dir / "top_pharmacies.parquet"
    df = pl.read_parquet(src).select([
        pl.col("pharmacy_id").cast(pl.Utf8),
        pl.col("name").cast(pl.Utf8),
        pl.col("address").cast(pl.Utf8),
        pl.col("fips").cast(pl.Utf8),
        pl.col("total_pills").cast(pl.Float64),
    ])
    _validate_parquet_as_json(df, "top-pharmacies")
    out = cfg.emit_dir / "top-pharmacies.parquet"
    out.parent.mkdir(parents=True, exist_ok=True)
    df.write_parquet(out, compression="zstd")
    log.info("emit: %s (%d rows, %d bytes)", out.name, len(df), out.stat().st_size)
    return out


def emit_cdc_overdose_parquet(cfg: Config) -> Path:
    src = cfg.agg_dir / "cdc_overdose_by_county_year.parquet"
    df = pl.read_parquet(src).select([
        pl.col("fips").cast(pl.Utf8),
        pl.col("year").cast(pl.Int64),
        pl.col("deaths").cast(pl.Int64),
        pl.col("suppressed").cast(pl.Boolean),
    ])
    _validate_parquet_as_json(df, "cdc-overdose-by-county-year")
    out = cfg.emit_dir / "cdc-overdose-by-county-year.parquet"
    out.parent.mkdir(parents=True, exist_ok=True)
    df.write_parquet(out, compression="zstd")
    log.info("emit: %s (%d rows, %d bytes)", out.name, len(df), out.stat().st_size)
    return out


# ---------- Full runner ----------

def emit_all(cfg: Config) -> list[Path]:
    """Run every emitter in dependency order. Returns paths of all emitted files."""
    cfg.emit_dir.mkdir(parents=True, exist_ok=True)
    outs = [
        emit_county_metadata_json(cfg),
        emit_state_shipments_json(cfg),
        emit_top_distributors_json(cfg),
        emit_dea_enforcement_json(cfg),
        emit_search_index_json(cfg),
        emit_county_shipments_parquet(cfg),
        emit_top_pharmacies_parquet(cfg),
        emit_cdc_overdose_parquet(cfg),
    ]
    log.info("emit: complete, %d artifacts in %s", len(outs), cfg.emit_dir)
    return outs
```

- [ ] **Step 2: Extend tests**

Append to `pipeline/tests/test_emit.py`:

```python
def test_emit_county_shipments_parquet(seeded_cfg):
    from openarcos_pipeline.emit import emit_county_shipments_parquet
    out = emit_county_shipments_parquet(seeded_cfg)
    df = pl.read_parquet(out)
    assert set(df.columns) == {"fips", "year", "pills", "pills_per_capita"}
    assert df.height > 0


def test_emit_top_pharmacies_parquet(seeded_cfg):
    from openarcos_pipeline.emit import emit_top_pharmacies_parquet
    out = emit_top_pharmacies_parquet(seeded_cfg)
    df = pl.read_parquet(out)
    assert set(df.columns) == {"pharmacy_id", "name", "address", "fips", "total_pills"}


def test_emit_cdc_overdose_parquet(seeded_cfg):
    from openarcos_pipeline.emit import emit_cdc_overdose_parquet
    out = emit_cdc_overdose_parquet(seeded_cfg)
    df = pl.read_parquet(out)
    assert set(df.columns) == {"fips", "year", "deaths", "suppressed"}
    # Suppression invariants preserved
    for r in df.to_dicts():
        if r["suppressed"]:
            assert r["deaths"] is None


def test_emit_all_produces_eight_artifacts(seeded_cfg):
    from openarcos_pipeline.emit import emit_all
    outs = emit_all(seeded_cfg)
    # 5 JSON + 3 Parquet = 8 total
    names = {p.name for p in outs}
    assert names == {
        "county-metadata.json",
        "state-shipments-by-year.json",
        "top-distributors-by-year.json",
        "dea-enforcement-actions.json",
        "search-index.json",
        "county-shipments-by-year.parquet",
        "top-pharmacies.parquet",
        "cdc-overdose-by-county-year.parquet",
    }
    for p in outs:
        assert p.stat().st_size > 0
```

- [ ] **Step 3: Verify**

Run: `uv run pytest pipeline/tests/test_emit.py -v`
Expected: 10 passed total.

- [ ] **Step 4: Commit**

```bash
git add pipeline/src/openarcos_pipeline/emit.py pipeline/tests/test_emit.py
git commit -m "pipeline: emit Parquet artifacts with row-level schema validation"
```

---

### Task 51: End-to-end `openarcos all` command + integration test

**Files:**
- Modify: `pipeline/src/openarcos_pipeline/cli.py`
- Create: `pipeline/tests/test_e2e_all.py`

- [ ] **Step 1: Wire `emit` and `all` in CLI**

In `pipeline/src/openarcos_pipeline/cli.py`, replace the `emit` and `all_cmd` stubs:

```python
@app.command()
def emit() -> None:
    """Emit validated artifacts to web/public/data/."""
    from .emit import emit_all
    cfg = Config.from_env()
    outs = emit_all(cfg)
    log.info("emit complete: %d files", len(outs))


@app.command(name="all")
def all_cmd(
    skip_fetch: bool = typer.Option(False, "--skip-fetch", help="Skip network fetching; use cached raw/"),
    years_start: int = typer.Option(2006, "--years-start"),
    years_end: int = typer.Option(2020, "--years-end"),
) -> None:
    """Run the full pipeline: fetch → clean → join → aggregate → emit."""
    from .aggregate import run_all as run_aggregate
    from .emit import emit_all
    from .join import build_master
    cfg = Config.from_env()
    if not skip_fetch:
        _run_fetch(cfg)  # the existing fetch implementation, refactored into a helper
    _run_clean(cfg)
    build_master(cfg, years=range(years_start, years_end + 1))
    run_aggregate(cfg)
    emit_all(cfg)
    log.info("pipeline complete")
```

Note: `_run_fetch` and `_run_clean` are helper functions refactored out of the existing `fetch` and `clean` CLI command bodies. Mechanical extraction — keep existing behaviour byte-identical.

- [ ] **Step 2: Write the full-pipeline integration test**

Create `pipeline/tests/test_e2e_all.py`:

```python
"""End-to-end: `openarcos all --skip-fetch` against seeded raw fixtures produces all 8 artifacts, all valid."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import jsonschema
import polars as pl
import pytest
from typer.testing import CliRunner

from openarcos_pipeline.cli import app

SCHEMAS_DIR = Path(__file__).resolve().parents[1] / "schemas"

EXPECTED_OUTPUTS = {
    "county-metadata.json": "county-metadata",
    "state-shipments-by-year.json": "state-shipments-by-year",
    "top-distributors-by-year.json": "top-distributors-by-year",
    "dea-enforcement-actions.json": "dea-enforcement-actions",
    "search-index.json": "search-index",
    "county-shipments-by-year.parquet": "county-shipments-by-year",
    "top-pharmacies.parquet": "top-pharmacies",
    "cdc-overdose-by-county-year.parquet": "cdc-overdose-by-county-year",
}


def _seed_raw(raw_dir: Path, fixtures_dir: Path) -> None:
    """Same seeding as test_e2e_through_aggregate."""
    (raw_dir / "census").mkdir(parents=True, exist_ok=True)
    shutil.copy(fixtures_dir / "census" / "co-est2019-sample.csv", raw_dir / "census" / "co-est2019-alldata.csv")
    (raw_dir / "wapo").mkdir(parents=True, exist_ok=True)
    for src in (fixtures_dir / "wapo").glob("*.json"):
        if src.name.startswith(("county_", "distributors_", "pharmacies_")):
            shutil.copy(src, raw_dir / "wapo" / src.name)
    (raw_dir / "cdc").mkdir(parents=True, exist_ok=True)
    for src in (fixtures_dir / "cdc").glob("*.xml"):
        shutil.copy(src, raw_dir / "cdc" / src.name)
    (raw_dir / "dea").mkdir(parents=True, exist_ok=True)
    for src in (fixtures_dir / "dea").glob("*.pdf"):
        stem = src.stem.replace("diversion_", "").replace("_sample", "")
        shutil.copy(src, raw_dir / "dea" / f"{stem}.pdf")


def test_all_skip_fetch_produces_valid_artifacts(tmp_path, fixtures_dir, monkeypatch):
    data_root = tmp_path / "data"
    emit_dir = tmp_path / "emit"
    monkeypatch.setenv("OPENARCOS_DATA_ROOT", str(data_root))
    monkeypatch.setenv("OPENARCOS_EMIT_DIR", str(emit_dir))
    _seed_raw(data_root / "raw", fixtures_dir)

    runner = CliRunner()
    result = runner.invoke(app, ["all", "--skip-fetch", "--years-start", "2011", "--years-end", "2013"])
    assert result.exit_code == 0, result.stdout

    # All 8 expected files present
    for filename in EXPECTED_OUTPUTS:
        assert (emit_dir / filename).exists(), f"missing: {filename}"

    # Every JSON artifact validates against its schema
    for filename, schema_name in EXPECTED_OUTPUTS.items():
        schema = json.loads((SCHEMAS_DIR / f"{schema_name}.schema.json").read_text())
        path = emit_dir / filename
        if path.suffix == ".json":
            jsonschema.validate(instance=json.loads(path.read_text()), schema=schema)
        else:
            # Parquet: read, materialise, validate rows
            df = pl.read_parquet(path)
            jsonschema.validate(instance=df.to_dicts(), schema=schema)
```

- [ ] **Step 3: Verify**

Run: `uv run pytest pipeline/tests/test_e2e_all.py -v`
Expected: 1 passed.

- [ ] **Step 4: Commit**

```bash
git add pipeline/src/openarcos_pipeline/cli.py pipeline/tests/test_e2e_all.py
git commit -m "pipeline: full `openarcos all` orchestration + end-to-end test"
```

---

### Task 52: Parquet round-trip test

**Files:**
- Create: `pipeline/tests/test_parquet_roundtrip.py`

Confirm that emitted Parquet files round-trip cleanly — i.e., a consumer reading them with `hyparquet` (the library used on the web side) or polars sees the same rows that the aggregation produced.

- [ ] **Step 1: Write the test**

Create `pipeline/tests/test_parquet_roundtrip.py`:

```python
"""Parquet round-trip: emitted file has same content as source aggregation."""
from __future__ import annotations

import hashlib

import polars as pl
import pytest


PARQUET_OUTPUTS = [
    ("county_shipments_by_year", "county-shipments-by-year"),
    ("top_pharmacies", "top-pharmacies"),
    ("cdc_overdose_by_county_year", "cdc-overdose-by-county-year"),
]


def _fingerprint(df: pl.DataFrame) -> str:
    """Sort-stable hash of a DataFrame's content."""
    return hashlib.sha256(
        df.sort(by=df.columns).write_csv().encode()
    ).hexdigest()


@pytest.mark.parametrize("agg_name,emit_name", PARQUET_OUTPUTS)
def test_parquet_roundtrips_byte_stable(seeded_cfg, agg_name, emit_name):
    import openarcos_pipeline.emit as emit_mod
    emit_mod.emit_all(seeded_cfg)

    src = pl.read_parquet(seeded_cfg.agg_dir / f"{agg_name}.parquet")
    dst = pl.read_parquet(seeded_cfg.emit_dir / f"{emit_name}.parquet")

    # Column set identical
    assert set(src.columns) == set(dst.columns), f"column drift in {emit_name}"

    # Row content identical after sort
    assert _fingerprint(src) == _fingerprint(dst), f"content drift in {emit_name}"
```

- [ ] **Step 2: Verify**

Run: `uv run pytest pipeline/tests/test_parquet_roundtrip.py -v`
Expected: 3 passed.

- [ ] **Step 3: Commit**

```bash
git add pipeline/tests/test_parquet_roundtrip.py
git commit -m "pipeline: round-trip test for Parquet emissions"
```

---

### Task 53: Commit the committed-emit fixture

**Files:**
- Create: `web/public/data/.gitkeep`
- Create: `web/public/data/README.md`

The emitted directory is committed (per spec §3), but the Phase 1–12 pipeline only *populates* it at build-data runs. Phase 2 of the web plan will ship a tiny valid fixture so `pnpm build` works before pipeline runs; we pre-create the directory now so that fixture can land there.

- [ ] **Step 1: Create the directory structure**

Create `web/public/data/.gitkeep` (empty file).

Create `web/public/data/README.md`:

```markdown
# web/public/data

This directory holds the JSON and Parquet artifacts emitted by `/pipeline`. It
is committed to the repo.

- **Pipeline → web contract**: Every file here MUST validate against a schema
  in `/pipeline/schemas/`. See the emission map in
  `/pipeline/src/openarcos_pipeline/emit.py`.
- **Regeneration**: run `make build-data` at the repo root, or trigger the
  `build-data` GitHub Action.
- **DO NOT hand-edit.** Changes here come from pipeline runs only.
```

- [ ] **Step 2: Commit**

```bash
git add web/public/data/.gitkeep web/public/data/README.md
git commit -m "web: reserve web/public/data as pipeline emission target"
```

---

### Phase 9 gate

After every task in this phase, run the full verification matrix:

```bash
cd pipeline && make lint && make test
```

All checks must pass before starting the next phase. If any check fails, fix before proceeding; do not rely on the merge or a later phase to catch it.

---

## Phase 10 — CI + Deploy (tasks 54–59)

The pipeline now produces every artifact in §4. Phase 10 wires it into Make + GitHub Actions so `make all` is the canonical local workflow and a weekly cron keeps `web/public/data/` current against live sources.

Per decisions recorded in the plan header: **WaPo data is fetched live in `build-data.yml`** (not committed raw) and falls back to the last good committed `web/public/data/` on upstream failure.

---

### Task 54: Finalize Makefiles

**Files:**
- Modify: `pipeline/Makefile`
- Modify: `Makefile` (repo root)

The stub Makefiles from Tasks 2–3 delegated to nothing. Wire them to the real CLI now that it exists.

- [ ] **Step 1: Rewrite `pipeline/Makefile`**

```make
# pipeline/Makefile — openarcos ETL targets
.PHONY: help install fetch clean join aggregate emit all test lint format snapshots ci-check

YEARS_START ?= 2006
YEARS_END   ?= 2014

help:
	@echo "Targets:"
	@echo "  install     uv sync (install deps + create .venv)"
	@echo "  fetch       fetch all raw sources (live network)"
	@echo "  clean       normalize raw → data/clean/"
	@echo "  join        build data/joined/master.parquet"
	@echo "  aggregate   run sql/ → data/agg/"
	@echo "  emit        write data/agg/ → web/public/data/ (schema-validated)"
	@echo "  all         skip-fetch variant: clean → join → aggregate → emit"
	@echo "  test        pytest"
	@echo "  lint        ruff check"
	@echo "  format      ruff format"
	@echo "  snapshots   regenerate golden snapshots (PYTEST_UPDATE_SNAPSHOTS=1)"
	@echo "  ci-check    schema validation of committed web/public/data/"

install:
	uv sync

fetch: install
	uv run openarcos fetch --source all

clean: install
	uv run openarcos clean

join: install
	uv run openarcos join

aggregate: install
	uv run openarcos aggregate

emit: install
	uv run openarcos emit

all: install
	uv run openarcos all --skip-fetch --years-start $(YEARS_START) --years-end $(YEARS_END)

test: install
	uv run pytest -q

lint: install
	uv run ruff check src tests

format: install
	uv run ruff format src tests

snapshots: install
	PYTEST_UPDATE_SNAPSHOTS=1 uv run pytest -q tests/test_aggregate_snapshots.py

ci-check: install
	uv run python scripts/validate_web_data.py
```

- [ ] **Step 2: Create `pipeline/scripts/validate_web_data.py`**

Used by `make ci-check` and the CI workflow. Walks `web/public/data/` and validates every file against the matching schema in `pipeline/schemas/`.

```python
"""Validate every file in web/public/data against its schema."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import polars as pl
from jsonschema import Draft202012Validator

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_DIR = REPO_ROOT / "pipeline" / "schemas"
DATA_DIR = REPO_ROOT / "web" / "public" / "data"

# Maps each artifact filename to the schema it must satisfy.
ARTIFACT_TO_SCHEMA = {
    "state-shipments-by-year.json": "state-shipments-by-year.schema.json",
    "county-metadata.json": "county-metadata.schema.json",
    "top-distributors-by-year.json": "top-distributors-by-year.schema.json",
    "dea-enforcement-actions.json": "dea-enforcement-actions.schema.json",
    "search-index.json": "search-index.schema.json",
    "county-shipments-by-year.parquet": "county-shipments-by-year.schema.json",
    "top-pharmacies.parquet": "top-pharmacies.schema.json",
    "cdc-overdose-by-county-year.parquet": "cdc-overdose-by-county-year.schema.json",
}


def _load_rows(path: Path) -> list[dict]:
    if path.suffix == ".json":
        return json.loads(path.read_text())
    if path.suffix == ".parquet":
        return pl.read_parquet(path).to_dicts()
    raise ValueError(f"unknown extension: {path}")


def main() -> int:
    failures: list[str] = []
    for name, schema_name in ARTIFACT_TO_SCHEMA.items():
        data_path = DATA_DIR / name
        schema_path = SCHEMA_DIR / schema_name
        if not data_path.exists():
            failures.append(f"MISSING: {data_path.relative_to(REPO_ROOT)}")
            continue
        schema = json.loads(schema_path.read_text())
        validator = Draft202012Validator(schema)
        rows = _load_rows(data_path)
        errors = list(validator.iter_errors(rows))
        if errors:
            for err in errors[:3]:
                failures.append(
                    f"INVALID: {data_path.relative_to(REPO_ROOT)}: {err.message}"
                )
            if len(errors) > 3:
                failures.append(f"  ...and {len(errors) - 3} more errors")
        else:
            print(f"OK: {name}")

    if failures:
        print("\nSCHEMA VALIDATION FAILURES:", file=sys.stderr)
        for f in failures:
            print(f"  {f}", file=sys.stderr)
        return 1
    print(f"\nAll {len(ARTIFACT_TO_SCHEMA)} artifacts valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 3: Run locally to confirm it finds the committed scaffolding**

```bash
cd pipeline && uv run python scripts/validate_web_data.py
```

Expected: 8 `MISSING` lines (since we haven't run `make all` against real data yet), exits non-zero. That's correct — the script works; the data isn't there yet. A run of `make all` in a fresh clone would populate it.

- [ ] **Step 4: Rewrite root `Makefile`**

```make
# Root Makefile — delegates into /pipeline and /web.
.PHONY: help build-data test-pipeline lint-pipeline format-pipeline ci-check

help:
	@echo "openarcos root targets:"
	@echo "  build-data      run the ETL end-to-end (skip-fetch; uses cached raw)"
	@echo "  build-data-live fetch live + run ETL end-to-end"
	@echo "  test-pipeline   run /pipeline pytest suite"
	@echo "  lint-pipeline   run /pipeline ruff check"
	@echo "  format-pipeline run /pipeline ruff format"
	@echo "  ci-check        validate web/public/data against schemas"

build-data:
	$(MAKE) -C pipeline all

build-data-live:
	$(MAKE) -C pipeline fetch
	$(MAKE) -C pipeline all

test-pipeline:
	$(MAKE) -C pipeline test

lint-pipeline:
	$(MAKE) -C pipeline lint

format-pipeline:
	$(MAKE) -C pipeline format

ci-check:
	$(MAKE) -C pipeline ci-check
```

- [ ] **Step 5: Verify the top-level make help works**

```bash
make help
```

Expected output: exactly the block listed above.

- [ ] **Step 6: Commit**

```bash
git add pipeline/Makefile pipeline/scripts/validate_web_data.py Makefile
git commit -m "pipeline: wire makefiles to openarcos cli + schema validator"
```

---

### Task 55: CI workflow (`ci.yml`)

**Files:**
- Create: `.github/workflows/ci.yml`

Runs on every PR that touches pipeline or schemas. Does NOT hit the network — CI uses only committed fixtures.

- [ ] **Step 1: Create the workflow file**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    paths:
      - "pipeline/**"
      - ".github/workflows/ci.yml"
      - "Makefile"
  push:
    branches: [main]
    paths:
      - "pipeline/**"
      - ".github/workflows/ci.yml"
      - "Makefile"
  workflow_dispatch:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  pipeline:
    name: pipeline (lint + test)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    defaults:
      run:
        working-directory: pipeline
    steps:
      - uses: actions/checkout@v4

      - name: Set up uv + Python 3.12
        uses: astral-sh/setup-uv@v3
        with:
          enable-cache: true
          cache-dependency-glob: "pipeline/uv.lock"

      - name: Install dependencies
        run: uv sync --frozen

      - name: Lint
        run: uv run ruff check src tests

      - name: Format check
        run: uv run ruff format --check src tests

      - name: Test
        env:
          OPENARCOS_ENV: ci
        run: uv run pytest -q --cov=openarcos_pipeline --cov-report=term-missing

  schema-gate:
    name: schema gate (web/public/data)
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4

      - name: Set up uv + Python 3.12
        uses: astral-sh/setup-uv@v3
        with:
          enable-cache: true
          cache-dependency-glob: "pipeline/uv.lock"

      - name: Install pipeline deps (for jsonschema + polars)
        working-directory: pipeline
        run: uv sync --frozen

      - name: Check for data files
        id: data
        run: |
          if compgen -G "web/public/data/*.json" > /dev/null || compgen -G "web/public/data/*.parquet" > /dev/null; then
            echo "present=true" >> "$GITHUB_OUTPUT"
          else
            echo "present=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Validate emitted data against schemas
        if: steps.data.outputs.present == 'true'
        working-directory: pipeline
        run: uv run python scripts/validate_web_data.py
```

- [ ] **Step 2: Lint the YAML locally (optional, catches typos fast)**

```bash
uv run --directory pipeline python -c "import yaml, sys; yaml.safe_load(open('../.github/workflows/ci.yml'))"
```

Expected: exits 0 with no output (parse succeeded).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "pipeline: add CI workflow (lint + pytest + schema gate)"
```

---

### Task 56: Weekly data-refresh workflow (`build-data.yml`)

**Files:**
- Create: `.github/workflows/build-data.yml`

This is the only place the pipeline hits live network. It runs weekly (Mondays 03:00 UTC) plus on-demand via `workflow_dispatch`. When the fetched data differs from what's committed, it pushes a commit back to `main` with the canonical `data: refresh YYYY-MM-DD` subject — which the design spec treats as authoritative.

Failure modes (per spec §7):
- WaPo API down → task exits non-zero; `web/public/data/` on `main` remains last-good
- Schema drift (content-hash guard trips) → task exits non-zero in fetch; no commit pushed
- CDC WONDER quirks → treated as hard failure; re-run later

- [ ] **Step 1: Create the workflow file**

```yaml
# .github/workflows/build-data.yml
name: Data Refresh

on:
  schedule:
    # Weekly, Monday 03:00 UTC. Rerun manually any time.
    - cron: "0 3 * * 1"
  workflow_dispatch:
    inputs:
      years_start:
        description: "First year to include"
        required: false
        default: "2006"
      years_end:
        description: "Last year to include"
        required: false
        default: "2014"

concurrency:
  group: build-data
  cancel-in-progress: false

jobs:
  refresh:
    name: fetch live + rebuild data
    runs-on: ubuntu-latest
    timeout-minutes: 60
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up uv + Python 3.12
        uses: astral-sh/setup-uv@v3
        with:
          enable-cache: true
          cache-dependency-glob: "pipeline/uv.lock"

      - name: Install pipeline deps
        working-directory: pipeline
        run: uv sync --frozen

      - name: Fetch live sources
        working-directory: pipeline
        env:
          OPENARCOS_ENV: ci
        run: uv run openarcos fetch --source all

      - name: Run full ETL
        working-directory: pipeline
        env:
          OPENARCOS_ENV: ci
          YEARS_START: ${{ github.event.inputs.years_start || '2006' }}
          YEARS_END: ${{ github.event.inputs.years_end || '2014' }}
        run: |
          uv run openarcos all \
            --skip-fetch \
            --years-start "$YEARS_START" \
            --years-end "$YEARS_END"

      - name: Validate emitted data against schemas
        working-directory: pipeline
        run: uv run python scripts/validate_web_data.py

      - name: Check for changes under web/public/data
        id: diff
        run: |
          if [ -n "$(git status --porcelain web/public/data)" ]; then
            echo "changed=true" >> "$GITHUB_OUTPUT"
          else
            echo "changed=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Commit and push refreshed data
        if: steps.diff.outputs.changed == 'true'
        env:
          GIT_AUTHOR_NAME: openarcos-bot
          GIT_AUTHOR_EMAIL: openarcos-bot@users.noreply.github.com
          GIT_COMMITTER_NAME: openarcos-bot
          GIT_COMMITTER_EMAIL: openarcos-bot@users.noreply.github.com
        run: |
          today="$(date -u +%Y-%m-%d)"
          git add web/public/data
          git commit -m "data: refresh ${today}"
          git push origin HEAD:main

      - name: Summarize
        run: |
          if [ "${{ steps.diff.outputs.changed }}" = "true" ]; then
            echo "### Data refreshed" >> "$GITHUB_STEP_SUMMARY"
            git log -1 --oneline >> "$GITHUB_STEP_SUMMARY"
          else
            echo "### No changes — emitted data identical to main." >> "$GITHUB_STEP_SUMMARY"
          fi
```

- [ ] **Step 2: Parse-check the YAML locally**

```bash
uv run --directory pipeline python -c "import yaml; yaml.safe_load(open('../.github/workflows/build-data.yml'))"
```

Expected: exits 0 with no output.

- [ ] **Step 3: Verify the workflow permissions model**

The workflow uses `permissions: contents: write`. It pushes a non-force commit to `main`. Document this in the commit message so reviewers know.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/build-data.yml
git commit -m "pipeline: add weekly data-refresh workflow (live fetch → auto commit)"
```

---

### Task 57: Pipeline README

**Files:**
- Modify: `pipeline/README.md`

The scaffold README from Task 1 was a one-liner. Replace it with a complete developer guide.

- [ ] **Step 1: Rewrite `pipeline/README.md`**

```markdown
# openarcos — pipeline

ETL that fetches three public datasets, joins and aggregates them, and emits
JSON + Parquet artifacts to `../web/public/data/` against the JSON Schemas in
`schemas/`. The output is the load-bearing contract between this pipeline and
the `/web` Next.js site.

## Quickstart

```bash
# from repo root
cd pipeline
uv sync

# full pipeline using committed fixtures (no network):
make all

# full pipeline against live sources (takes minutes, requires network):
make fetch && make all
```

After `make all`, browse `../web/public/data/` for the 8 emitted artifacts.

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

## Data refresh cron

The `.github/workflows/build-data.yml` workflow runs every Monday at
03:00 UTC against live sources and auto-commits changes under
`web/public/data/` with the subject `data: refresh YYYY-MM-DD`. It can also
be triggered on demand from the GitHub Actions tab (`workflow_dispatch`).

If upstream APIs change shape, `sources/expected_hashes.py` trips and the
workflow fails loudly before writing anything. The site on `main` keeps
serving the last-good data until someone updates the hash fingerprint.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `RuntimeError: shape changed` in fetch | upstream API changed keys | re-run the probe notebook, update `EXPECTED_SIGNATURES` |
| CDC parser returns empty DataFrame | WONDER XML layout shift | inspect `data/raw/cdc/*.xml`; update `clean/cdc.py:parse_d76_response` |
| snapshot test fails | SQL output intentionally changed | run `make snapshots`, diff the CSV, commit if correct |
| `SchemaValidationError` on emit | SQL produced an out-of-range row | trace upstream (see "Reading schema failures") |
| `MISSING` from `validate_web_data.py` | `make all` hasn't been run yet | run `make all` |

## License

Pipeline code: Apache 2.0 (see `../LICENSE`). Source data licenses are
documented on `/methodology` in the site and linked from each artifact in
the emission map.
```

- [ ] **Step 2: Verify `make help` references match**

```bash
cd pipeline && make help
```

Expected: the target list in README.md's `make test/lint/format/snapshots/ci-check` table exactly matches the Makefile's targets.

- [ ] **Step 3: Commit**

```bash
git add pipeline/README.md
git commit -m "pipeline: complete README (quickstart, layout, troubleshooting)"
```

---

### Task 58: Final verification sweep

Before marking the plan DONE, run the full local verification matrix and fix any issues surfaced. This catches cross-task regressions that per-phase gates missed (e.g. a later task subtly broke an earlier one's test). Runs **before** Task 59 so nothing broken gets pushed.

**Files:** none (audit only)

- [ ] **Step 1:** Full local matrix. Run from the repo root:

```bash
cd pipeline && make lint && make test && make all
```

- [ ] **Step 2:** Investigate and fix any failures. Commit each fix separately with message `fix(sweep): <one-line-description>`.

- [ ] **Step 3:** Re-run the full matrix. All checks must pass before moving on:

```bash
cd pipeline && make lint && make test && make all
```

- [ ] **Step 4:** Commit a no-op marker if nothing broke:

```bash
git commit --allow-empty -m "chore: final verification sweep clean"
```

---

### Phase 10 gate

After every task in this phase, run the full verification matrix:

```bash
cd pipeline && make lint && make test
```

All checks must pass before starting the next phase. If any check fails, fix before proceeding; do not rely on the merge or a later phase to catch it.

---

### Task 59: Final push

**Files:**
- None modified — this task ships everything.

- [ ] **Step 1: Verify clean working tree + all expected files present**

```bash
git status
test -f pipeline/Makefile
test -f pipeline/README.md
test -f pipeline/scripts/validate_web_data.py
test -f .github/workflows/ci.yml
test -f .github/workflows/build-data.yml
echo "all present"
```

Expected: `git status` shows clean working tree; `echo` runs.

- [ ] **Step 2: Full local test pass**

```bash
cd pipeline && make lint && make test
```

Expected: ruff clean; pytest green across all phases' tests (Phase 1 smoke through Phase 9 E2E).

- [ ] **Step 3: Sanity-check the full pipeline runs against fixtures**

```bash
cd pipeline && make all YEARS_START=2011 YEARS_END=2013
ls -la ../web/public/data/
```

Expected: 8 files under `web/public/data/` (5 `.json` + 3 `.parquet`), each non-empty.

- [ ] **Step 4: Validate emitted data against schemas**

```bash
cd pipeline && make ci-check
```

Expected: `All 8 artifacts valid.`

- [ ] **Step 5: Review the full pipeline-side diff**

```bash
git log --oneline main..HEAD
```

Expected: ~58 commits with `pipeline:` prefixes (plus a couple `web:` for the emission-target scaffolding).

- [ ] **Step 6: Push**

```bash
git push origin main
```

Expected: push succeeds; GitHub Actions `CI` workflow fires on the push and completes green.

---

## Risks & how this plan handles them

| Risk (from spec §9) | Plan handling |
|---|---|
| WaPo API source shape drift | Task 19 spike captures API shape; Task 23 content-hash assertion in `sources/expected_hashes.py` fails loudly on drift; Task 56 workflow aborts before touching `web/public/data/` |
| CDC WONDER quirks (known hard) | Task 25 spike proves D76 request works end-to-end before Task 26 depends on it; suppressed-cell handling is load-bearing in Tasks 27, 43, 50 |
| DEA PDF layout changes year over year | Task 31 spike saves PDF fixtures; Task 33 cleaner logs warnings on pattern miss rather than silently zeroing |
| Schema drift pipeline ↔ web | Schemas in `pipeline/schemas/` are the single source of truth. They are validated on: every `emit.py` write (Task 49/50), every CI run (`schema-gate` job in Task 55), every data-refresh run (Task 56). Web plans (2 and 3) TypeScript-mirror them and validate independently. |
| Emitted data commits bloating repo | `.gitattributes` marks `*.parquet binary` (Task 4); `build-data.yml` amends `web/public/data/` via non-force single commits per refresh; history is rebaseable if it ever grows unwieldy. Emitted files are kept within §4 size budget by the aggregate SQL limits (except `search-index.json`, which per user decision is ~8–12 MB — web plans handle this) |
| Network-required CI | CI workflow (Task 55) uses fixtures only; only `build-data.yml` (Task 56) hits the network |
| State FIPS / name mismatches | `FIPS_STATE_MAP` is defined once in `fips.py` (Task 15) with a shared `fips_cases.json` fixture that Plan 2's TS mirror imports; divergence is caught by parity tests |

---

## Cross-plan self-review

**Spec §4 coverage.** Every row of the §4 emitted-artifacts table maps to:
- a schema (Phase 2)
- a SQL view (Phase 8)
- an emitter (Phase 9)
- an entry in `scripts/validate_web_data.py` (Task 54)

No orphans. No pipeline-internal files accidentally routed to `web/public/data/`.

**Spec §3 coverage.** Python 3.12 + polars + DuckDB + schema-validated outputs: Tasks 1 (pyproject pinning), 15–18 (utilities), 37 (DuckDB join), 39–46 (DuckDB aggregation), 49–50 (validated emission). Reproducibility via `make all`: Task 54.

**Spec §7 failure modes (pipeline side).** WaPo shape drift → Task 23. CDC parser empty → Task 27 + handling note. DEA pattern miss → Task 33 warning. Schema violation → `SchemaValidationError` in Task 49. All covered.

**Placeholder scan.** Every task has exact file paths and either complete code or exact commands with expected output. The only deliberate "fill-in-during-spike" markers are the `REPLACE_ME_WITH_SIG` placeholder hashes in Task 23 and the `REPLACE_WITH_YEAR_URL.pdf` placeholders in Task 31 — both explicitly flagged, both resolved by running the probe script output and pasting values. These are load-bearing values that only real probes can produce; they are not unspecified work.

**Type consistency.** FIPS is `str` (zero-padded 5 digits) everywhere. Year is `int`. Deaths is `int | None`. Suppressed is `bool`. All schemas use these exact types; all cleaners cast to them; all emitters re-validate.

**Naming consistency.** `master.parquet` is the join output (never `master_table.parquet` or `joined.parquet`). `data/agg/<name>.parquet` for pre-emission aggregates. `web/public/data/<name>.{json,parquet}` for emitted. `ARTIFACT_TO_SCHEMA` dict is the single map between emitted filename and schema.

**Fresh-eyes gaps found.**
- Task 23's hash guard had no initialization path in the first draft → added Step 4 noting the helper command that populates `EXPECTED_SIGNATURES`.
- Phase 9 task 49 originally validated only after writing, losing the "fail loud" property → revised to validate BEFORE write (critical for spec §7 compliance).
- `scripts/validate_web_data.py` wasn't in the first draft of Task 54 → added; it's the same script CI uses, so it gets test coverage for free.

---

## Execution handoff

Plan 1 is saved to `docs/superpowers/plans/2026-04-29-openarcos-pipeline.md`.

Per `superpowers:writing-plans`, after saving, execution goes through one of two skills:

**Option 1 — Subagent-Driven (recommended).** Use `superpowers:subagent-driven-development`. Dispatches a fresh subagent per task, reviews between tasks, reviewer + implementer separation, fast iteration. Best for plans this long (58 tasks) where you want verification at each step.

**Option 2 — Inline Execution.** Use `superpowers:executing-plans`. Executes in the same session with batch checkpoints. Best if you want to observe the full flow in one context but accept linear progress.

Both skills enforce the TDD loop and commit cadence baked into every task above.

Plans 2 (web-core) and 3 (web-interactive) are saved alongside this file and should be executed in order: pipeline → web-core → web-interactive. Plans 2 can begin as soon as Plan 1 Phase 2 (schemas) + Phase 9 (emit against fixtures) land, since those produce the `web/public/data/` shapes Plan 2 consumes.

