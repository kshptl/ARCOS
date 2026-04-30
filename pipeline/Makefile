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
	uv sync --extra dev

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
	PYTEST_UPDATE_SNAPSHOTS=1 uv run pytest -q tests/test_aggregate.py

ci-check: install
	uv run python scripts/validate_web_data.py
