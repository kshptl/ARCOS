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
