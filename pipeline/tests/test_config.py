"""Config dataclass holds typed paths."""

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
