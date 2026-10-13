#!/usr/bin/env python3
"""Embed each item's metadata text for the dense baseline.

Uses OpenAI text-embedding-3-large on the same text the question answerer
sees. Vectors are cached in the embeddings table of taste/cache/answers.db,
keyed by a hash of the input, so re-runs cost nothing.

    uv run --python 3.12 --with numpy --with boto3 python scripts/taste/embed.py --domain movies
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import time
import urllib.error
import urllib.request

import numpy as np

from answer import CACHE_KEY, digest, open_cache
from common import fetch, key, load_secret, read_json, upload, workdir

MODEL = "text-embedding-3-large"
ENDPOINT = "https://api.openai.com/v1/embeddings"
USD_PER_M = 0.13
BATCH = 64


def open_table(con: sqlite3.Connection) -> None:
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS embeddings (
            model TEXT NOT NULL,
            domain TEXT NOT NULL,
            item_id TEXT NOT NULL,
            input_hash TEXT NOT NULL,
            vector BLOB NOT NULL,
            PRIMARY KEY (model, domain, item_id)
        )
        """
    )


def vectors(con: sqlite3.Connection, domain: str, items: list[dict]) -> np.ndarray | None:
    rows = {
        item: (h, np.frombuffer(blob, dtype="<f4"))
        for item, h, blob in con.execute(
            "SELECT item_id, input_hash, vector FROM embeddings WHERE model=? AND domain=?", (MODEL, domain)
        )
    }
    out = []
    for item in items:
        found = rows.get(item["id"])
        if not found or found[0] != digest(item["prompt"]):
            return None
        out.append(found[1])
    return np.stack(out)


def embed(secret: str, texts: list[str]) -> tuple[list[np.ndarray], int]:
    body = json.dumps({"model": MODEL, "input": texts}).encode()
    for attempt in range(8):
        request = urllib.request.Request(
            ENDPOINT, data=body, headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                payload = json.loads(response.read())
            data = sorted(payload["data"], key=lambda d: d["index"])
            return [np.asarray(d["embedding"], dtype="<f4") for d in data], payload["usage"]["prompt_tokens"]
        except urllib.error.HTTPError as error:
            if error.code not in {429, 500, 502, 503} or attempt == 7:
                raise RuntimeError(f"HTTP {error.code}: {error.read()[:300]}") from error
        time.sleep(2**attempt)
    raise RuntimeError("unreachable")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--domain", required=True)
    args = parser.parse_args()
    secret = load_secret("OPENAI_API_KEY")
    with workdir() as tmp:
        items = read_json(key(args.domain, "items.json"), tmp)
        db = tmp / "answers.db"
        fetch(CACHE_KEY, db, required=False)
        con = open_cache(db)
        open_table(con)
        done = {
            item: h
            for item, h in con.execute("SELECT item_id, input_hash FROM embeddings WHERE model=? AND domain=?", (MODEL, args.domain))
        }
        todo = [i for i in items if done.get(i["id"]) != digest(i["prompt"])]
        print(f"embedding {len(todo)} of {len(items)} {args.domain} items", flush=True)
        tokens = 0
        for start in range(0, len(todo), BATCH):
            batch = todo[start : start + BATCH]
            vecs, used = embed(secret, [i["prompt"] for i in batch])
            tokens += used
            con.executemany(
                "INSERT OR REPLACE INTO embeddings VALUES (?,?,?,?,?)",
                [(MODEL, args.domain, i["id"], digest(i["prompt"]), v.tobytes()) for i, v in zip(batch, vecs)],
            )
            con.execute(
                "INSERT INTO calls VALUES (?,?,?,?,?,?,?,?,?,?)",
                ("embeddings", MODEL, args.domain, f"batch:{start}", 0, used, 0, used * USD_PER_M / 1e6, 0, time.time()),
            )
            con.commit()
        con.close()
        upload(db, CACHE_KEY)
        print(f"{tokens} tokens, ${tokens * USD_PER_M / 1e6:.4f}", flush=True)


if __name__ == "__main__":
    main()
