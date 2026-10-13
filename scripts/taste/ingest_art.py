#!/usr/bin/env python3
"""Pick public-domain artworks from the Art Institute of Chicago and fetch images.

Reads AIC's public API dump (taste/raw/artic-api-data.tar.bz2, mirrored by
fetch_raw.py). The catalog is every AIC highlight (is_boosted) plus a seeded
random sample of works that have been viewed a fair amount, with a quota per artwork type so
prints don't swamp it. Photographs are excluded. Images come from AIC's IIIF
server at two sizes: 843px wide for display and at most 512px for the model.
Writes taste/art/catalog.json, taste/art/images/, taste/art/llm/, and
taste/art/items.json. Re-runs skip images already stored.

Images and metadata are CC0 (public-domain works); descriptions are not used.

    uv run --python 3.12 --with numpy --with boto3 python scripts/taste/ingest_art.py
"""

from __future__ import annotations

import json
import tarfile
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

from common import fetch, key, list_keys, upload, workdir, write_json

DUMP_KEY = key("raw", "artic-api-data.tar.bz2")
IIIF = "https://www.artic.edu/iiif/2/{}/full/{}/0/default.jpg"
# IIIF refuses the default Python-urllib user agent.
HEADERS = {"User-Agent": "benklosky.com taste demo (benklosky@uchicago.edu)"}
# Works per type beyond the highlights.
QUOTAS = {
    "Painting": 330,
    "Print": 150,
    "Drawing and Watercolor": 110,
    "Sculpture": 60,
    "Ceramics": 30,
    "Textile": 30,
    "Vessel": 15,
    "Metalwork": 10,
    "Armor": 10,
    "Costume and Accessories": 10,
    "Furniture": 10,
    "Miniature room": 5,
    "Glass": 5,
    "Architectural Drawing": 5,
}


def artworks(dump: Path) -> list[dict]:
    """Public-domain, imaged, non-photographic artworks from the API dump, sorted by id."""
    works = []
    with tarfile.open(dump, "r:bz2") as tar:
        for member in tar:
            if not (member.isfile() and "/json/artworks/" in member.name):
                continue
            work = json.load(tar.extractfile(member))
            if (
                work.get("is_public_domain")
                and work.get("image_id")
                and work.get("artwork_type_title") != "Photograph"
                and "photograph" not in " ".join(work.get("classification_titles") or []).lower()
            ):
                works.append(work)
    return sorted(works, key=lambda w: w["id"])


def image(image_id: str, size: str) -> bytes:
    url = IIIF.format(image_id, size)
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as error:
            if error.code not in {403, 429, 500, 502, 503} or attempt == 5:
                raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if attempt == 5:
                raise
        time.sleep(2**attempt)
    raise RuntimeError("unreachable")


def prompt_for(work: dict) -> str:
    lines = [f"Artwork: {work['title']}"]
    if work.get("artist_display"):
        lines.append(f"Artist: {work['artist_display'].replace(chr(10), ', ')}")
    for label, field in (
        ("Date", "date_display"),
        ("Medium", "medium_display"),
        ("Type", "artwork_type_title"),
        ("Place of origin", "place_of_origin"),
        ("Style", "style_title"),
        ("Dimensions", "dimensions"),
        ("Museum department", "department_title"),
    ):
        if work.get(field):
            lines.append(f"{label}: {work[field]}")
    if work.get("subject_titles"):
        lines.append(f"Subjects: {', '.join(work['subject_titles'][:12])}")
    return "\n".join(lines)


def main() -> None:
    rng = np.random.default_rng(0)
    with workdir() as tmp:
        dump = tmp / "artic-api-data.tar.bz2"
        fetch(DUMP_KEY, dump)
        works = artworks(dump)
        dump.unlink()
        chosen = [w for w in works if w.get("is_boosted")]
        seen = {w["id"] for w in chosen}
        print(f"{len(works)} eligible works, {len(chosen)} highlights", flush=True)
        for artwork_type, quota in QUOTAS.items():
            pool = [
                w
                for w in works
                if w["id"] not in seen
                and w.get("artwork_type_title") == artwork_type
                and w.get("has_not_been_viewed_much") is False
            ]
            picks = rng.choice(len(pool), size=min(quota, len(pool)), replace=False)
            chosen += [pool[i] for i in sorted(picks)]
            seen |= {pool[i]["id"] for i in picks}
            print(f"{artwork_type}: {len(picks)} of {len(pool)}", flush=True)
        fields = ("id", "title", "artist_title", "artist_display", "date_display", "date_start", "medium_display",
                  "place_of_origin", "style_title", "classification_title", "artwork_type_title", "department_title",
                  "subject_titles", "dimensions", "image_id", "is_boosted", "thumbnail", "color", "colorfulness")
        chosen = [{f: w.get(f) for f in fields} for w in chosen]

        have = set(list_keys(key("art", "images"))) | set(list_keys(key("art", "llm")))

        def store(work: dict) -> bool:
            for folder, size in (("images", "843,"), ("llm", "!512,512")):
                object_key = key("art", folder, f"aic{work['id']}.jpg")
                if object_key in have:
                    continue
                path = tmp / f"{folder}-{work['id']}.jpg"
                try:
                    path.write_bytes(image(work["image_id"], size))
                except (urllib.error.URLError, TimeoutError, ConnectionError) as error:
                    # A few IIIF images are restricted; leave those works out.
                    print(f"skipping aic{work['id']}: {error}", flush=True)
                    return False
                upload(path, object_key)
                path.unlink()
            return True

        with ThreadPoolExecutor(4) as pool:
            stored = list(pool.map(store, chosen))
        chosen = [work for work, ok in zip(chosen, stored) if ok]

        write_json(chosen, key("art", "catalog.json"), tmp)
        items = []
        for work in chosen:
            artist = work.get("artist_title") or (work.get("artist_display") or "").split("\n")[0] or None
            items.append(
                {
                    "id": f"aic{work['id']}",
                    "title": work["title"],
                    "creator": artist,
                    "year": work.get("date_start"),
                    "subtitle": " · ".join(x for x in [artist, work.get("date_display")] if x),
                    "blurb": ", ".join(x for x in [work.get("medium_display"), work.get("place_of_origin")] if x),
                    "tags": [t for t in [work.get("artwork_type_title"), work.get("style_title")] if t],
                    "prompt": prompt_for(work),
                    "image": key("art", "images", f"aic{work['id']}.jpg"),
                    "model_image": key("art", "llm", f"aic{work['id']}.jpg"),
                    "alt": (work.get("thumbnail") or {}).get("alt_text") or work["title"],
                    "link": f"https://www.artic.edu/artworks/{work['id']}",
                    "credit": "Art Institute of Chicago, CC0",
                }
            )
        write_json(items, key("art", "items.json"), tmp)
        print(f"wrote {len(items)} artworks", flush=True)


if __name__ == "__main__":
    main()
