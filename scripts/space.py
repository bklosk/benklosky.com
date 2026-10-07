"""Read and write the private benklosky-data Space.

Scripts work on copies in a temporary directory that is deleted when they
finish, so no dataset stays on this machine. Credentials come from the
environment or from .env: SPACES_ENDPOINT, SPACES_BUCKET, SPACES_KEY,
SPACES_SECRET.
"""

from __future__ import annotations

import os
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

ROOT = Path(__file__).resolve().parents[1]
NAMES = ("SPACES_ENDPOINT", "SPACES_BUCKET", "SPACES_KEY", "SPACES_SECRET")


def settings() -> dict[str, str]:
    values = {name: os.environ.get(name, "").strip() for name in NAMES}
    env_path = ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            name, value = line.split("=", 1)
            name = name.strip()
            if name in values and not values[name]:
                values[name] = value.strip().strip('"').strip("'")
    missing = [name for name, value in values.items() if not value]
    if missing:
        raise SystemExit(f"missing {', '.join(missing)}")
    return values


def _client():
    values = settings()
    client = boto3.client(
        "s3",
        endpoint_url=values["SPACES_ENDPOINT"],
        # Spaces ignores the region, but botocore requires one.
        region_name="us-east-1",
        aws_access_key_id=values["SPACES_KEY"],
        aws_secret_access_key=values["SPACES_SECRET"],
        # Spaces rejects botocore's default CRC checksums.
        config=Config(
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required",
        ),
    )
    return client, values["SPACES_BUCKET"]


def download(key: str, destination: Path, required: bool = True) -> bool:
    client, bucket = _client()
    try:
        client.download_file(bucket, key, str(destination))
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") in {"404", "NoSuchKey"} and not required:
            return False
        raise
    return True


def upload(source: Path, key: str) -> None:
    client, bucket = _client()
    client.upload_file(str(source), bucket, key, ExtraArgs={"ACL": "private"})
    print(f"uploaded {key} to {bucket}", flush=True)


def list_keys(prefix: str) -> list[str]:
    client, bucket = _client()
    keys: list[str] = []
    for page in client.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            keys.append(obj["Key"])
    return keys


@contextmanager
def workdir() -> Iterator[Path]:
    with tempfile.TemporaryDirectory(prefix="benklosky-data-") as path:
        yield Path(path)
