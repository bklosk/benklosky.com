#!/usr/bin/env bash
# Rebuild every /taste artifact from scratch. Each step is cached or resumable,
# so re-running only does (and only pays for) what is missing.
# Needs SPACES_* and OPENAI_API_KEY in the environment or .env.
set -euo pipefail
cd "$(dirname "$0")/../.."
py() { uv run --python 3.12 --with numpy --with pandas --with boto3 python "$@"; }

py scripts/taste/fetch_raw.py           # raw datasets -> taste/raw/
py scripts/taste/ingest_movies.py       # MovieLens catalog + rating sample
py scripts/taste/enrich_movies.py       # Wikidata/Wikipedia metadata + posters
py scripts/taste/ingest_books.py        # Goodreads catalog + rating sample
py scripts/taste/enrich_books.py        # Open Library covers (slow: rate-limited)
py scripts/taste/ingest_art.py          # AIC catalog + images
for domain in movies books art; do
  py scripts/taste/answer.py --domain "$domain" --max-dollars "${MAX_DOLLARS:-18}"
done
for domain in movies books; do
  py scripts/taste/embed.py --domain "$domain"   # dense baseline
done
for domain in movies books art; do
  py scripts/taste/build.py --domain "$domain"   # features, prior, browser artifact
done
for domain in movies books; do
  py scripts/taste/eval.py --domain "$domain"
done
py scripts/taste/parity.py && bun test src/app/taste
