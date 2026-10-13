#!/usr/bin/env python3
"""Pick the book catalog from the UCSD Goodreads dataset and sample users.

A catalog item is a Goodreads *work*, so every edition's ratings count toward
the same book. Works are ranked by total ratings, then filtered to English
editions with a description. Reads taste/raw/goodreads_*. Writes:

    taste/books/catalog.json   work id, best edition, title, author, year, shelves
    taste/books/ratings.npz    user, item (catalog index), rating (1-5)

Data: Mengting Wan and Julian McAuley, "Item Recommendation on Monotonic
Behavior Chains", RecSys 2018. Academic, non-commercial use.

    uv run --python 3.12 --with numpy --with pandas --with boto3 python scripts/taste/ingest_books.py
"""

from __future__ import annotations

import argparse
import gzip
import json
import re

import numpy as np
import pandas as pd

from common import fetch, key, upload, workdir, write_json

ENGLISH = {"eng", "en-US", "en-GB", "en-CA", "en", ""}
SHELF_STOP = re.compile(
    r"to-read|currently|favou?rite|owned|own|default|kindle|e-?book|library|audio|wish|"
    r"tbr|read-in|^read$|books-i|bookshelf|my-|i-have|have|borrowed|dnf|re-?read|book-club|"
    r"maybe|series|abandon|did-not|unfinished|giveaway|first-reads|^\d{4}|-\d{4}|nook|"
    r"to-buy|on-hold|someday|shelfari|reviewed|sold|donated|recommended|ya$|all-time|faves|books$"
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--items", type=int, default=1500)
    parser.add_argument("--candidates", type=int, default=2600)
    parser.add_argument("--users", type=int, default=12000)
    parser.add_argument("--min-ratings", type=int, default=40)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    with workdir() as tmp:
        works_path = tmp / "works.json.gz"
        fetch(key("raw", "goodreads_book_works.json.gz"), works_path)
        works = {}
        with gzip.open(works_path, "rt") as handle:
            for line in handle:
                w = json.loads(line)
                works[w["work_id"]] = w
        works_path.unlink()
        ranked = sorted(works.values(), key=lambda w: -int(w.get("ratings_count") or 0))
        candidates = {w["work_id"]: w for w in ranked[: args.candidates]}
        print(f"{len(works)} works, {len(candidates)} candidates", flush=True)

        books_path = tmp / "books.json.gz"
        fetch(key("raw", "goodreads_books.json.gz"), books_path)
        edition_work: dict[str, str] = {}
        best: dict[str, dict] = {}
        with gzip.open(books_path, "rt") as handle:
            for line in handle:
                b = json.loads(line)
                work_id = b.get("work_id")
                if work_id not in candidates:
                    continue
                edition_work[b["book_id"]] = work_id
                if b["book_id"] == candidates[work_id].get("best_book_id"):
                    best[work_id] = b
        books_path.unlink()
        print(f"{len(edition_work)} editions of {len(best)} candidate works", flush=True)

        authors_path = tmp / "authors.json.gz"
        fetch(key("raw", "goodreads_book_authors.json.gz"), authors_path)
        wanted = {a["author_id"] for b in best.values() for a in b.get("authors", [])}
        names = {}
        with gzip.open(authors_path, "rt") as handle:
            for line in handle:
                a = json.loads(line)
                if a["author_id"] in wanted:
                    names[a["author_id"]] = a["name"]

        catalog = []
        for w in ranked[: args.candidates]:
            b = best.get(w["work_id"])
            if not b or b.get("language_code", "") not in ENGLISH or len(b.get("description") or "") < 80:
                continue
            authors = [names[a["author_id"]] for a in b.get("authors", []) if a["author_id"] in names and not a.get("role")]
            authors = authors or [names[a["author_id"]] for a in b.get("authors", []) if a["author_id"] in names]
            shelves = [s["name"] for s in b.get("popular_shelves", []) if not SHELF_STOP.search(s["name"])][:12]
            year = w.get("original_publication_year") or b.get("publication_year")
            catalog.append(
                {
                    "id": f"gr{w['work_id']}",
                    "work_id": w["work_id"],
                    "book_id": b["book_id"],
                    # The English edition's title, not the work's original-language one.
                    "title": (b.get("title_without_series") or b["title"]).strip(),
                    "series_title": b["title"].strip(),
                    "authors": authors[:3],
                    "year": int(year) if str(year).lstrip("-").isdigit() else None,
                    "pages": int(b["num_pages"]) if str(b.get("num_pages", "")).isdigit() else None,
                    "shelves": shelves,
                    "description": b["description"].strip(),
                    "isbn13": b.get("isbn13") or None,
                    "isbn": b.get("isbn") or None,
                    "image_url": b.get("image_url"),
                    "url": b.get("link") or b.get("url"),
                    "ratings": int(w.get("ratings_count") or 0),
                }
            )
            if len(catalog) >= args.items:
                break
        index = {book["work_id"]: i for i, book in enumerate(catalog)}
        edition_item = {e: index[w] for e, w in edition_work.items() if w in index}
        print(f"catalog {len(catalog)} books", flush=True)

        map_path = tmp / "book_id_map.csv"
        fetch(key("raw", "book_id_map.csv"), map_path)
        id_map = pd.read_csv(map_path, dtype={"book_id_csv": np.int32, "book_id": str})
        csv_item = {
            int(c): edition_item[b] for c, b in zip(id_map["book_id_csv"], id_map["book_id"]) if b in edition_item
        }
        csv_ids = np.fromiter(csv_item.keys(), dtype=np.int64)
        csv_vals = np.fromiter(csv_item.values(), dtype=np.int64)

        interactions = tmp / "interactions.csv"
        fetch(key("raw", "goodreads_interactions.csv"), interactions)
        lookup = pd.Series(csv_vals, index=csv_ids)
        parts = []
        reader = pd.read_csv(
            interactions,
            usecols=["user_id", "book_id", "rating"],
            dtype={"user_id": np.int32, "book_id": np.int32, "rating": np.int8},
            chunksize=20_000_000,
        )
        for n, chunk in enumerate(reader):
            chunk = chunk[(chunk["rating"] > 0) & chunk["book_id"].isin(csv_ids)]
            chunk = chunk.assign(item=lookup.reindex(chunk["book_id"].to_numpy()).to_numpy())
            parts.append(chunk[["user_id", "item", "rating"]])
            print(f"chunk {n}: kept {sum(len(p) for p in parts)} ratings", flush=True)
        interactions.unlink()
        ratings = pd.concat(parts)
        # Several editions of one work can carry ratings from the same user.
        ratings = ratings.groupby(["user_id", "item"], as_index=False)["rating"].max()

        per_user = ratings["user_id"].value_counts()
        eligible = per_user[per_user >= args.min_ratings].index.to_numpy()
        rng = np.random.default_rng(args.seed)
        chosen = np.sort(rng.choice(eligible, size=min(args.users, len(eligible)), replace=False))
        sample = ratings[ratings["user_id"].isin(chosen)]
        user_index = {u: i for i, u in enumerate(chosen)}
        print(
            f"{len(eligible)} eligible users, kept {len(chosen)} with {len(sample)} ratings",
            flush=True,
        )

        write_json(catalog, key("books", "catalog.json"), tmp)
        path = tmp / "ratings.npz"
        np.savez_compressed(
            path,
            user=sample["user_id"].map(user_index).to_numpy(np.int32),
            item=sample["item"].to_numpy(np.int32),
            rating=sample["rating"].to_numpy(np.float32),
        )
        upload(path, key("books", "ratings.npz"))


if __name__ == "__main__":
    main()
