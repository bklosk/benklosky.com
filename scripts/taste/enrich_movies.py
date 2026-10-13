#!/usr/bin/env python3
"""Add Wikidata metadata, Wikipedia summaries, and posters; write items.json.

Films are matched to Wikidata through MovieLens's IMDb ids (property P345).
Wikidata supplies directors, cast, countries, language, runtime, and genres
(CC0). The English Wikipedia summary supplies the overview (CC BY-SA) and its
lead image, which for a film is almost always the poster. Responses are
cached in taste/movies/wiki.json.gz and images in taste/movies/images/, so a
re-run fetches only what is missing. No API key needed.

    uv run --python 3.12 --with boto3 python scripts/taste/enrich_movies.py
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from common import fetch, key, list_keys, read_json, upload, workdir, write_json

SPARQL = "https://query.wikidata.org/sparql"
ENTITIES = "https://www.wikidata.org/w/api.php"
SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/"
HEADERS = {"User-Agent": "benklosky.com taste demo (benklosky@uchicago.edu)", "Accept": "application/json"}
CLAIMS = {
    "P57": "directors",
    "P161": "cast",
    "P495": "countries",
    "P364": "languages",
    "P136": "genres",
    "P179": "series",
}


def get(url: str, data: bytes | None = None, raw: bool = False):
    headers = dict(HEADERS)
    if data:
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers), timeout=60) as r:
                body = r.read()
            return body if raw else json.loads(body)
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return None
            if error.code not in {429, 500, 502, 503, 504} or attempt == 5:
                raise
            wait = float(error.headers.get("Retry-After") or 2 ** (attempt + 1))
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if attempt == 5:
                raise
            wait = 2 ** (attempt + 1)
        time.sleep(wait)
    raise RuntimeError("unreachable")


def qids_for(imdb_ids: list[str]) -> dict[str, dict]:
    """IMDb id -> {qid, article title} via SPARQL, 200 at a time."""
    out = {}
    for start in range(0, len(imdb_ids), 200):
        values = " ".join(f'"{i}"' for i in imdb_ids[start : start + 200])
        query = f"""
            SELECT ?imdb ?film ?article WHERE {{
              VALUES ?imdb {{ {values} }}
              ?film wdt:P345 ?imdb .
              OPTIONAL {{ ?article schema:about ?film; schema:isPartOf <https://en.wikipedia.org/> . }}
            }}"""
        data = urllib.parse.urlencode({"query": query, "format": "json"}).encode()
        for row in get(SPARQL, data)["results"]["bindings"]:
            imdb = row["imdb"]["value"]
            if imdb in out and out[imdb].get("article"):
                continue
            article = row.get("article", {}).get("value")
            out[imdb] = {
                "qid": row["film"]["value"].rsplit("/", 1)[1],
                "article": urllib.parse.unquote(article.rsplit("/", 1)[1]) if article else None,
            }
        time.sleep(1)
    return out


def entities(ids: list[str], props: str) -> dict:
    out = {}
    for start in range(0, len(ids), 50):
        params = {
            "action": "wbgetentities",
            "ids": "|".join(ids[start : start + 50]),
            "props": props,
            "languages": "en",
            "format": "json",
        }
        out.update(get(f"{ENTITIES}?{urllib.parse.urlencode(params)}")["entities"])
    return out


def claim_ids(entity: dict, prop: str) -> list[str]:
    ids = []
    for claim in entity.get("claims", {}).get(prop, []):
        value = claim.get("mainsnak", {}).get("datavalue", {}).get("value")
        if isinstance(value, dict) and "id" in value:
            ids.append(value["id"])
    return ids


def runtime(entity: dict) -> int | None:
    for claim in entity.get("claims", {}).get("P2047", []):
        amount = claim.get("mainsnak", {}).get("datavalue", {}).get("value", {}).get("amount")
        if amount:
            return round(float(amount))
    return None


def metadata(catalog: list[dict]) -> dict[str, dict]:
    found = qids_for([f["imdbId"] for f in catalog])
    films = entities([v["qid"] for v in found.values()], "claims")
    refs = sorted({r for e in films.values() for p in CLAIMS for r in claim_ids(e, p)[:8]})
    labels = {
        qid: e.get("labels", {}).get("en", {}).get("value")
        for qid, e in entities(refs, "labels").items()
    }
    meta = {}
    for imdb, match in found.items():
        entity = films.get(match["qid"], {})
        record = {"qid": match["qid"], "article": match["article"], "runtime": runtime(entity)}
        for prop, name in CLAIMS.items():
            limit = 6 if name == "cast" else 4
            record[name] = [labels[r] for r in claim_ids(entity, prop) if labels.get(r)][:limit]
        meta[imdb] = record
    return meta


def summary(article: str) -> dict:
    data = get(SUMMARY + urllib.parse.quote(article.replace(" ", "_"), safe="")) or {}
    return {
        "extract": data.get("extract"),
        "description": data.get("description"),
        "image": (data.get("thumbnail") or {}).get("source"),
        "page": (data.get("content_urls") or {}).get("desktop", {}).get("page"),
    }


def prompt_for(film: dict, meta: dict) -> str:
    lines = [f"Film: {film['title']} ({film['year']})"]
    if meta.get("directors"):
        lines.append(f"Directed by: {', '.join(meta['directors'])}")
    if meta.get("cast"):
        lines.append(f"Starring: {', '.join(meta['cast'])}")
    lines.append(f"MovieLens genres: {', '.join(film['genres'])}")
    if meta.get("genres"):
        lines.append(f"Wikidata genres: {', '.join(meta['genres'])}")
    if meta.get("countries"):
        lines.append(f"Country of origin: {', '.join(meta['countries'])}")
    if meta.get("languages"):
        lines.append(f"Original language: {', '.join(meta['languages'])}")
    if meta.get("runtime"):
        lines.append(f"Runtime: {meta['runtime']} minutes")
    if meta.get("series"):
        lines.append(f"Part of: {', '.join(meta['series'])}")
    if meta.get("extract"):
        lines.append(f"Summary: {meta['extract'][:1500]}")
    return "\n".join(lines)


def main() -> None:
    with workdir() as tmp:
        catalog = read_json(key("movies", "catalog.json"), tmp)
        cache_key = key("movies", "wiki.json.gz")
        cache = read_json(cache_key, tmp) if fetch(cache_key, tmp / "wiki.json.gz", required=False) else {}

        missing = [f for f in catalog if f["imdbId"] not in cache]
        if missing:
            print(f"looking up {len(missing)} films on Wikidata", flush=True)
            found = metadata(missing)
            with ThreadPoolExecutor(4) as pool:
                articles = [found.get(f["imdbId"], {}).get("article") for f in missing]
                summaries = list(pool.map(lambda a: summary(a) if a else {}, articles))
            for film, extra in zip(missing, summaries):
                cache[film["imdbId"]] = {**found.get(film["imdbId"], {}), **extra}
            write_json(cache, cache_key, tmp)

        have = set(list_keys(key("movies", "images")))
        todo = [
            f for f in catalog if cache[f["imdbId"]].get("image") and key("movies", "images", f"{f['id']}.jpg") not in have
        ]
        print(f"fetching {len(todo)} posters", flush=True)

        def store(film: dict) -> None:
            body = get(cache[film["imdbId"]]["image"], raw=True)
            if body:
                path = tmp / f"{film['id']}.jpg"
                path.write_bytes(body)
                upload(path, key("movies", "images", f"{film['id']}.jpg"))
                path.unlink()

        with ThreadPoolExecutor(4) as pool:
            list(pool.map(store, todo))
        have = set(list_keys(key("movies", "images")))

        items = []
        for film in catalog:
            meta = cache[film["imdbId"]]
            image = key("movies", "images", f"{film['id']}.jpg")
            directors = meta.get("directors") or []
            items.append(
                {
                    "id": film["id"],
                    "title": film["title"],
                    "creator": ", ".join(directors[:2]) or None,
                    "year": film["year"],
                    "subtitle": " · ".join(
                        str(x) for x in [film["year"], ", ".join(directors[:1]), meta.get("runtime") and f"{meta['runtime']} min"] if x
                    ),
                    "blurb": (meta.get("extract") or "")[:600],
                    "tags": film["genres"][:3],
                    "prompt": prompt_for(film, meta),
                    "image": image if image in have else None,
                    "link": meta.get("page") or f"https://www.imdb.com/title/{film['imdbId']}/",
                    "credit": "Metadata from Wikidata (CC0) and Wikipedia (CC BY-SA)",
                }
            )
        write_json(items, key("movies", "items.json"), tmp)
        print(
            f"wrote {len(items)} items: {sum(1 for f in catalog if cache[f['imdbId']].get('qid'))} on Wikidata, "
            f"{sum(1 for i in items if i['blurb'])} with summaries, {sum(1 for i in items if i['image'])} with posters",
            flush=True,
        )


if __name__ == "__main__":
    main()
