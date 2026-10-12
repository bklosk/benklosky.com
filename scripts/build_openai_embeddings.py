#!/usr/bin/env python3
"""Embed every encounter note with OpenAI text-embedding-3-large.

Reads note_text from patient_profiles.db in the [REDACTED] Space. Writes
openai_embeddings.db: one row per encounter, the native 3072-d vector stored
as little-endian float32. Re-running skips encounters already embedded with
this model.

    uv run --python 3.12 --with numpy --with boto3 python scripts/build_openai_embeddings.py
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np

from space import download, upload, workdir

ROOT = Path(__file__).resolve().parents[1]
PATIENTS_KEY = "patient_profiles.db"
OUTPUT_KEY = "openai_embeddings.db"
MODEL = "text-embedding-3-large"
DIMS = 3072
ENDPOINT = "https://api.openai.com/v1/embeddings"
BATCH = 64
RETRY_STATUSES = {429, 500, 502, 503}


def load_key() -> str:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if key:
        return key
    env_path = ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            name, value = line.split("=", 1)
            if name.strip() == "OPENAI_API_KEY":
                return value.strip().strip('"').strip("'")
    raise SystemExit("OPENAI_API_KEY is not set")


def open_db(path: Path) -> sqlite3.Connection:
    con = sqlite3.connect(path)
    con.execute("PRAGMA journal_mode=DELETE")
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS embeddings (
            encounter_id INTEGER PRIMARY KEY,
            model TEXT NOT NULL,
            dims INTEGER NOT NULL,
            embedding BLOB NOT NULL
        )
        """
    )
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        """
    )
    stored = con.execute("SELECT value FROM meta WHERE key = 'model'").fetchone()
    if stored is not None and stored[0] != MODEL:
        raise SystemExit(f"{OUTPUT_KEY} was built with {stored[0]}, not {MODEL}")
    con.execute(
        "INSERT INTO meta(key, value) VALUES('model', ?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (MODEL,),
    )
    con.execute(
        "INSERT INTO meta(key, value) VALUES('dims', ?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (str(DIMS),),
    )
    con.commit()
    return con


def pending(patients_db: Path, embeddings_db: sqlite3.Connection, limit: int | None) -> list[tuple[int, str]]:
    done = {row[0] for row in embeddings_db.execute("SELECT encounter_id FROM embeddings")}
    patients = sqlite3.connect(f"file:{patients_db}?mode=ro", uri=True)
    rows: list[tuple[int, str]] = []
    for encounter_id, note in patients.execute(
        "SELECT encounter_id, note_text FROM encounters ORDER BY encounter_id"
    ):
        if encounter_id in done:
            continue
        if not note or not str(note).strip():
            raise SystemExit(f"encounter {encounter_id} has an empty note")
        rows.append((int(encounter_id), str(note)))
        if limit is not None and len(rows) >= limit:
            break
    patients.close()
    return rows


def embed_batch(key: str, notes: list[str]) -> tuple[list[bytes], int]:
    body = json.dumps({"model": MODEL, "input": notes}).encode()
    delay = 1.0
    last_error = "no response"
    for attempt in range(8):
        request = urllib.request.Request(
            ENDPOINT,
            data=body,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                payload = json.loads(response.read().decode())
            break
        except urllib.error.HTTPError as error:
            detail = error.read().decode(errors="replace")[:500]
            last_error = f"HTTP {error.code}: {detail}"
            if error.code not in RETRY_STATUSES or attempt == 7:
                raise RuntimeError(last_error) from error
            retry_after = error.headers.get("Retry-After")
            wait = float(retry_after) if retry_after else delay
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            last_error = str(error)
            if attempt == 7:
                raise RuntimeError(last_error) from error
            wait = delay
        time.sleep(wait)
        delay = min(delay * 2, 30)
    else:
        raise RuntimeError(last_error)

    data = payload.get("data")
    if not isinstance(data, list) or len(data) != len(notes):
        raise RuntimeError(f"expected {len(notes)} embeddings, got {len(data) if isinstance(data, list) else 0}")
    ordered = sorted(data, key=lambda item: item["index"])
    blobs: list[bytes] = []
    for item in ordered:
        vector = np.asarray(item["embedding"], dtype="<f4")
        if vector.shape != (DIMS,) or not np.isfinite(vector).all():
            raise RuntimeError(f"embedding is {vector.shape}, expected {(DIMS,)}")
        blobs.append(vector.tobytes())
    usage = payload.get("usage") or {}
    tokens = int(usage.get("total_tokens") or 0)
    return blobs, tokens


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()

    key = load_key()
    with workdir() as work:
        patients_db = work / PATIENTS_KEY
        embeddings_db = work / OUTPUT_KEY
        download(PATIENTS_KEY, patients_db)
        download(OUTPUT_KEY, embeddings_db, required=False)
        con = open_db(embeddings_db)
        try:
            rows = pending(patients_db, con, args.limit)
            failed = embed_all(key, con, embeddings_db, rows, args.workers)
        finally:
            con.commit()
            con.close()
            upload(embeddings_db, OUTPUT_KEY)
    if failed:
        raise SystemExit(1)


def embed_all(
    key: str,
    con: sqlite3.Connection,
    embeddings_db: Path,
    rows: list[tuple[int, str]],
    workers: int,
) -> int:
    total = len(rows)
    print(f"pending {total} notes, model {MODEL}, workers {workers}", flush=True)
    if total == 0:
        return 0

    batches = [rows[start : start + BATCH] for start in range(0, total, BATCH)]
    done = 0
    failed = 0
    tokens = 0
    since_upload = 0
    started = time.time()

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(embed_batch, key, [note for _, note in batch]): batch for batch in batches
        }
        for future in as_completed(futures):
            batch = futures[future]
            try:
                blobs, used = future.result()
            except Exception as error:
                failed += 1
                print(f"fail {failed}: {error}", flush=True)
                continue
            con.executemany(
                "INSERT INTO embeddings(encounter_id, model, dims, embedding) VALUES (?, ?, ?, ?)",
                (
                    (encounter_id, MODEL, DIMS, blob)
                    for (encounter_id, _), blob in zip(batch, blobs, strict=True)
                ),
            )
            con.commit()
            done += len(batch)
            tokens += used
            since_upload += len(batch)
            elapsed = time.time() - started
            rate = done / elapsed if elapsed else 0
            print(
                f"saved {done}/{total} failed {failed} {rate:.1f}/s tokens {tokens}",
                flush=True,
            )
            if since_upload >= 512:
                upload(embeddings_db, OUTPUT_KEY)
                since_upload = 0

    elapsed = time.time() - started
    print(f"finished saved {done} failed {failed} in {elapsed:.0f}s tokens {tokens}", flush=True)
    return failed


if __name__ == "__main__":
    main()
