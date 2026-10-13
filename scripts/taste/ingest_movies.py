#!/usr/bin/env python3
"""Pick the movie catalog and sample MovieLens users for evaluation.

Reads taste/raw/ml-32m.zip. The catalog is the most-rated films, so swipers
are likely to know them. Ratings are kept for a random sample of users with
enough ratings inside the catalog. Writes:

    taste/movies/catalog.json   MovieLens id, title, year, genres, tmdbId
    taste/movies/ratings.npz    user, item (catalog index), rating

    uv run --python 3.12 --with numpy --with pandas --with boto3 python scripts/taste/ingest_movies.py
"""

from __future__ import annotations

import argparse
import re
import zipfile

import numpy as np
import pandas as pd

from common import fetch, key, upload, workdir, write_json

TITLE_YEAR = re.compile(r"^(.*)\s+\((\d{4})\)\s*$")
ARTICLE = re.compile(r"^(.*), (The|A|An|Les|La|Le|Il|El|Das|Die|Der)$")


def clean_title(raw: str) -> tuple[str, int | None]:
    match = TITLE_YEAR.match(raw.strip())
    title, year = (match.group(1), int(match.group(2))) if match else (raw.strip(), None)
    # MovieLens writes "Matrix, The"; put the article back in front.
    # Alternate titles come in parentheses: "City of God (Cidade de Deus)".
    parts = re.split(r"\s+\(", title, maxsplit=1)
    head = parts[0]
    article = ARTICLE.match(head)
    if article:
        head = f"{article.group(2)} {article.group(1)}"
    return head, year


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--items", type=int, default=1500)
    parser.add_argument("--users", type=int, default=12000)
    parser.add_argument("--min-ratings", type=int, default=40)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    with workdir() as tmp:
        archive = tmp / "ml-32m.zip"
        fetch(key("raw", "ml-32m.zip"), archive)
        with zipfile.ZipFile(archive) as zf:
            movies = pd.read_csv(zf.open("ml-32m/movies.csv"))
            links = pd.read_csv(zf.open("ml-32m/links.csv"))
            print("reading ratings", flush=True)
            ratings = pd.read_csv(
                zf.open("ml-32m/ratings.csv"),
                usecols=["userId", "movieId", "rating"],
                dtype={"userId": np.int32, "movieId": np.int32, "rating": np.float32},
            )
        archive.unlink()

        counts = ratings["movieId"].value_counts()
        movies = movies.merge(links, on="movieId").set_index("movieId")
        movies = movies[movies["tmdbId"].notna()]
        top = [m for m in counts.index if m in movies.index][: args.items]

        catalog = []
        for movie_id in top:
            row = movies.loc[movie_id]
            title, year = clean_title(row["title"])
            catalog.append(
                {
                    "id": f"ml{movie_id}",
                    "movieId": int(movie_id),
                    "tmdbId": int(row["tmdbId"]),
                    "imdbId": f"tt{int(row['imdbId']):07d}",
                    "title": title,
                    "year": year,
                    "genres": [g for g in row["genres"].split("|") if g != "(no genres listed)"],
                    "ratings": int(counts[movie_id]),
                }
            )
        index = {movie_id: i for i, movie_id in enumerate(top)}

        inside = ratings[ratings["movieId"].isin(index)]
        per_user = inside["userId"].value_counts()
        eligible = per_user[per_user >= args.min_ratings].index.to_numpy()
        rng = np.random.default_rng(args.seed)
        chosen = np.sort(rng.choice(eligible, size=min(args.users, len(eligible)), replace=False))
        sample = inside[inside["userId"].isin(chosen)]
        user_index = {u: i for i, u in enumerate(chosen)}
        users = sample["userId"].map(user_index).to_numpy(np.int32)
        items = sample["movieId"].map(index).to_numpy(np.int32)
        print(
            f"catalog {len(catalog)} films; {len(eligible)} eligible users, kept {len(chosen)} "
            f"with {len(sample)} ratings",
            flush=True,
        )

        write_json(catalog, key("movies", "catalog.json"), tmp)
        path = tmp / "ratings.npz"
        np.savez_compressed(path, user=users, item=items, rating=sample["rating"].to_numpy(np.float32))
        upload(path, key("movies", "ratings.npz"))


if __name__ == "__main__":
    main()
