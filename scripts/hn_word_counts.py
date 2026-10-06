#!/usr/bin/env python3
"""Monthly word counts from the Hacker News archive.

Source: https://huggingface.co/datasets/open-index/hacker-news
Files:  hf://datasets/open-index/hacker-news/data/*/*.parquet

Each count is the number of comments (type=2, field text) or story titles
(type=1, field title) that contain the word at least once. Matching is
case-insensitive with a word boundary, so "ship" does not match "shipped"
or "shipping". Phrase columns match a space or a hyphen:
smoke_test ("smoke test" / "smoke tests"), re_derived, load_bearing
("load-bearing"), absolutely_right, failure_mode ("failure mode" /
"failure modes"), and push_back. Months are UTC.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import duckdb

DATASET = "hf://datasets/open-index/hacker-news/data/{year}/*.parquet"

# Ship-family terms first, then control words.
WORDS = [
    "shipped",
    "shipping",
    "ships",
    "ship",
    "bug",
    "debug",
    "site",
    "feature",
    "launch",
    "code",
    "user",
    "data",
    "server",
    "fix",
    "app",
    "released",
    "deploy",
    "error",
    "test",
    "build",
    "problem",
]

# Single tokens counted from one extraction. Phrases are matched on the
# raw text so "test" inside "smoke test" still counts toward test.
CLAUDE_WORDS = [
    "plainly",
    "quietly",
    "survived",
    "halves",
    "asserted",
    "nobody",
    "genuinely",
    "structurally",
    "gating",
]
TOKEN_WORDS = WORDS + CLAUDE_WORDS
PATTERN = r"\b(" + "|".join(sorted(TOKEN_WORDS, key=len, reverse=True)) + r")\b"
PHRASES = [
    ("smoke_test", r"\bsmoke[- ]tests?\b"),
    ("re_derived", r"\bre[- ]?derived\b"),
    ("load_bearing", r"\bload[- ]bearing\b"),
    ("absolutely_right", r"\babsolutely right\b"),
    ("failure_mode", r"\bfailure modes?\b"),
    ("push_back", r"\bpush back\b"),
]


def year_sql(year: int) -> str:
    counts = ",\n    ".join(
        f"count(*) FILTER (WHERE list_contains(hits, '{word}')) AS {word}"
        for word in TOKEN_WORDS
    )
    phrases = ",\n    ".join(
        f"count(*) FILTER (WHERE regexp_matches(body, '{pattern}')) AS {name}"
        for name, pattern in PHRASES
    )
    return f"""
    WITH base AS (
      SELECT
        strftime(time AT TIME ZONE 'UTC', '%Y-%m') AS month,
        CASE type WHEN 2 THEN 'comment' WHEN 1 THEN 'title' END AS source,
        lower(
          CASE type
            WHEN 2 THEN coalesce(text, '')
            WHEN 1 THEN coalesce(title, '')
          END
        ) AS body
      FROM read_parquet('{DATASET.format(year=year)}')
      WHERE type IN (1, 2)
    )
    SELECT
      month,
      source,
      count(*) AS items,
      {counts},
      {phrases}
    FROM (
      SELECT
        month,
        source,
        regexp_extract_all(body, '{PATTERN}') AS hits,
        body
      FROM base
    ) AS counted
    GROUP BY month, source
    ORDER BY month, source
    """


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("data/hn-word-counts-monthly.csv"),
    )
    parser.add_argument("--start-year", type=int, default=2006)
    parser.add_argument("--end-year", type=int, default=2026)
    args = parser.parse_args()

    args.out.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute("SET memory_limit='2500MB';")
    con.execute("SET threads=4;")
    con.execute("SET preserve_insertion_order=false;")

    frames: list[str] = []
    for year in range(args.start_year, args.end_year + 1):
        print(f"scanning {year}...", flush=True)
        try:
            con.execute(
                f"CREATE OR REPLACE TEMP TABLE year_{year} AS {year_sql(year)}"
            )
        except duckdb.IOException as exc:
            # A year with no parquet files (or a transient read) should not
            # drop the years already scanned.
            print(f"  skipped {year}: {exc}", file=sys.stderr, flush=True)
            continue
        n = con.execute(f"SELECT coalesce(sum(items), 0) FROM year_{year}").fetchone()[0]
        print(f"  {year}: {n:,} comments and titles", flush=True)
        frames.append(f"SELECT * FROM year_{year}")

    if not frames:
        raise SystemExit("no rows scanned")

    union = " UNION ALL ".join(frames)
    con.execute(
        f"""
        COPY (
          SELECT * FROM ({union})
          ORDER BY month, source
        ) TO '{args.out}' (HEADER, DELIMITER ',')
        """
    )
    rows = con.execute(
        f"SELECT count(*), min(month), max(month) FROM read_csv_auto('{args.out}')"
    ).fetchone()
    print(f"wrote {args.out} ({rows[0]} rows, {rows[1]} .. {rows[2]})", flush=True)


if __name__ == "__main__":
    main()
