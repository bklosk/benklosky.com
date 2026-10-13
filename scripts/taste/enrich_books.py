#!/usr/bin/env python3
"""Fetch book covers and write taste/books/items.json.

Covers come from Open Library by ISBN, falling back to the cover URL in the
Goodreads metadata. Open Library limits ISBN lookups to about 100 per five
minutes per IP, so this throttles itself and is resumable: covers already in
taste/books/images/ and misses recorded in taste/books/covers.json are skipped.

    uv run --python 3.12 --with boto3 python scripts/taste/enrich_books.py
"""

from __future__ import annotations

import html
import re
import time
import urllib.error
import urllib.request

from common import fetch, key, list_keys, read_json, upload, workdir, write_json

OPEN_LIBRARY = "https://covers.openlibrary.org/b/isbn/{}-M.jpg?default=false"
HEADERS = {"User-Agent": "benklosky.com taste demo (benklosky@uchicago.edu)"}
INTERVAL = 3.1  # seconds between Open Library requests
TAGS = re.compile(r"<[^>]+>")


def get(url: str) -> bytes | None:
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=30) as r:
                body = r.read()
            return body if len(body) > 2000 else None
        except urllib.error.HTTPError as error:
            if error.code in {403, 404}:
                return None
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            pass
        time.sleep(5 * 2**attempt)
    return None


def cover(book: dict) -> tuple[bytes | None, str]:
    for isbn in (book.get("isbn13"), book.get("isbn")):
        if isbn:
            body = get(OPEN_LIBRARY.format(isbn))
            time.sleep(INTERVAL)
            if body:
                return body, "Cover from Open Library"
    url = book.get("image_url") or ""
    if url and "nophoto" not in url:
        body = get(url)
        if body:
            return body, "Cover via Goodreads"
    return None, ""


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(TAGS.sub(" ", text))).strip()


def prompt_for(book: dict) -> str:
    lines = [f"Book: {book['title']}"]
    if book["series_title"] != book["title"]:
        lines.append(f"Edition title: {book['series_title']}")
    if book["authors"]:
        lines.append(f"By: {', '.join(book['authors'])}")
    if book["year"]:
        lines.append(f"First published: {book['year']}")
    if book["pages"]:
        lines.append(f"Pages: {book['pages']}")
    if book["shelves"]:
        lines.append(f"Goodreads shelves: {', '.join(book['shelves'])}")
    lines.append(f"Description: {clean(book['description'])[:1500]}")
    return "\n".join(lines)


def main() -> None:
    with workdir() as tmp:
        catalog = read_json(key("books", "catalog.json"), tmp)
        log_key = key("books", "covers.json")
        log = read_json(log_key, tmp) if fetch(log_key, tmp / "covers.json", required=False) else {}
        have = set(list_keys(key("books", "images")))
        todo = [b for b in catalog if b["id"] not in log]
        print(f"fetching {len(todo)} covers", flush=True)
        for n, book in enumerate(todo, 1):
            object_key = key("books", "images", f"{book['id']}.jpg")
            if object_key in have:
                log[book["id"]] = log.get(book["id"]) or "Cover from Open Library"
                continue
            body, credit = cover(book)
            if body:
                path = tmp / "cover.jpg"
                path.write_bytes(body)
                upload(path, object_key)
            log[book["id"]] = credit
            if n % 50 == 0:
                write_json(log, log_key, tmp)
        write_json(log, log_key, tmp)

        items = []
        for book in catalog:
            credit = log.get(book["id"]) or ""
            items.append(
                {
                    "id": book["id"],
                    "title": book["title"],
                    "creator": ", ".join(book["authors"][:2]) or None,
                    "year": book["year"],
                    "subtitle": " · ".join(
                        str(x) for x in [", ".join(book["authors"][:1]), book["year"], book["pages"] and f"{book['pages']} pp"] if x
                    ),
                    "blurb": clean(book["description"])[:600],
                    "tags": book["shelves"][:3],
                    "prompt": prompt_for(book),
                    "image": key("books", "images", f"{book['id']}.jpg") if credit else None,
                    "link": book.get("url") or f"https://www.goodreads.com/book/show/{book['book_id']}",
                    "credit": credit or "UCSD Book Graph",
                }
            )
        write_json(items, key("books", "items.json"), tmp)
        print(f"wrote {len(items)} items, {sum(1 for i in items if i['image'])} with covers", flush=True)


if __name__ == "__main__":
    main()
