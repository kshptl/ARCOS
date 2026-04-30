"""Smoke test: all runtime dependencies importable."""


def test_imports_work():
    import duckdb
    import httpx  # noqa: F401
    import jsonschema  # noqa: F401
    import pdfplumber  # noqa: F401
    import polars as pl
    import tenacity  # noqa: F401
    import tqdm  # noqa: F401
    import typer  # noqa: F401

    # Check minimum versions
    assert int(pl.__version__.split(".")[0]) >= 1
    assert duckdb.__version__ is not None


def test_package_importable():
    import openarcos_pipeline

    assert openarcos_pipeline.__version__ == "0.1.0"
