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
