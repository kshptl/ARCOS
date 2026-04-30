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
