"""Shared paths and helpers for the /taste pipeline.

Everything the pipeline reads or writes lives under taste/ in the private
benklosky-data Space. Scripts work in a temporary directory, so nothing stays
on this machine. See src/app/taste/README.md for the order to run them in.
"""

from __future__ import annotations

import gzip
import json
import os
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPTS))

from space import download, list_keys, upload, workdir  # noqa: E402

ROOT = SCRIPTS.parent
HERE = Path(__file__).resolve().parent
QUESTIONS_DIR = HERE / "questions"
DOMAINS = ("movies", "books", "art")
PREFIX = "taste"


def key(*parts: str) -> str:
    return "/".join((PREFIX, *parts))


def load_secret(name: str, required: bool = True) -> str:
    value = os.environ.get(name, "").strip()
    if value:
        return value
    env_path = ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            found, value = line.split("=", 1)
            if found.strip() == name:
                return value.strip().strip('"').strip("'")
    if required:
        raise SystemExit(f"{name} is not set")
    return ""


def exists(object_key: str) -> bool:
    return object_key in set(list_keys(object_key))


def fetch(object_key: str, destination: Path, required: bool = True) -> bool:
    return download(object_key, destination, required=required)


def read_json(object_key: str, tmp: Path):
    path = tmp / object_key.replace("/", "__")
    download(object_key, path)
    if object_key.endswith(".gz"):
        with gzip.open(path, "rt") as handle:
            return json.load(handle)
    return json.loads(path.read_text())


def write_json(value, object_key: str, tmp: Path) -> None:
    path = tmp / object_key.replace("/", "__")
    if object_key.endswith(".gz"):
        with gzip.open(path, "wt") as handle:
            json.dump(value, handle, separators=(",", ":"))
    else:
        path.write_text(json.dumps(value, separators=(",", ":")))
    upload(path, object_key)


def load_questions(domain: str) -> list[dict]:
    return json.loads((QUESTIONS_DIR / f"{domain}.json").read_text())


__all__ = [
    "DOMAINS",
    "HERE",
    "QUESTIONS_DIR",
    "ROOT",
    "download",
    "exists",
    "fetch",
    "key",
    "list_keys",
    "load_questions",
    "load_secret",
    "read_json",
    "upload",
    "workdir",
    "write_json",
]
