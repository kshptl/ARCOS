.PHONY: build-data test-pipeline lint-pipeline

build-data:
	$(MAKE) -C pipeline all

test-pipeline:
	$(MAKE) -C pipeline test

lint-pipeline:
	$(MAKE) -C pipeline lint
