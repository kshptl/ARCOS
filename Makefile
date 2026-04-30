# Root Makefile — delegates into /pipeline and /web.
.PHONY: help build-data build-data-live test-pipeline lint-pipeline format-pipeline ci-check

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
