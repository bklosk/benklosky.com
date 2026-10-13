#!/usr/bin/env python3
"""Mirror the raw ratings datasets into the Space, once.

Each file is streamed to a temporary directory, uploaded to taste/raw/, and
deleted. Files already in the Space are skipped, so re-running is free.

    uv run --with boto3 python scripts/taste/fetch_raw.py
"""

from __future__ import annotations

import shutil
import urllib.request

from common import key, list_keys, upload, workdir

GOODREADS = "https://mcauleylab.ucsd.edu/public_datasets/gdrive/goodreads/"
SOURCES = {
    # MovieLens 32M (GroupLens). Research use; do not redistribute.
    "ml-32m.zip": "https://files.grouplens.org/datasets/movielens/ml-32m.zip",
    # UCSD Book Graph (Wan & McAuley, RecSys 2018). Academic use.
    "goodreads_books.json.gz": GOODREADS + "goodreads_books.json.gz",
    "goodreads_book_authors.json.gz": GOODREADS + "goodreads_book_authors.json.gz",
    "goodreads_book_works.json.gz": GOODREADS + "goodreads_book_works.json.gz",
    "book_id_map.csv": GOODREADS + "book_id_map.csv",
    "goodreads_interactions.csv": GOODREADS + "goodreads_interactions.csv",
    # Art Institute of Chicago public API dump, refreshed daily. Metadata CC0.
    "artic-api-data.tar.bz2": "https://artic-api-data.s3.amazonaws.com/artic-api-data.tar.bz2",
}


def main() -> None:
    have = set(list_keys(key("raw")))
    for name, url in SOURCES.items():
        object_key = key("raw", name)
        if object_key in have:
            print(f"have {object_key}", flush=True)
            continue
        with workdir() as tmp:
            path = tmp / name
            print(f"fetching {url}", flush=True)
            with urllib.request.urlopen(url, timeout=120) as response, path.open("wb") as out:
                shutil.copyfileobj(response, out, length=1 << 22)
            upload(path, object_key)


if __name__ == "__main__":
    main()
