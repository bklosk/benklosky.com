#!/usr/bin/env python3
"""Report on a pilot run: cost per item, projected cost, and answer accuracy.

Accuracy is checked on questions whose answers can be read off independent
metadata: release or publication era against the known year, genre scores
against MovieLens genre tags, nonfiction against Goodreads shelves, medium
against the museum's records, and saturation against AIC's own
image-derived colorfulness score (a check that the model looks at the image).

    uv run --python 3.12 --with numpy --with boto3 python scripts/taste/pilot.py --provider decisions
"""

from __future__ import annotations

import argparse
import json
import sqlite3

import numpy as np

from answer import CACHE_KEY, PROVIDERS
from common import DOMAINS, fetch, key, load_questions, read_json, workdir
from eval import auc


def expected(probs: list[float]) -> float:
    p = np.asarray(probs) / sum(probs)
    return float(p @ np.arange(len(p)) / (len(p) - 1))


def era_index(year: int | None, bounds: list[int]) -> int | None:
    if year is None:
        return None
    return int(np.searchsorted(bounds, year, side="right"))


def checks(domain: str, items: dict, answers: dict, bank: dict) -> dict:
    out: dict = {}

    def argmax(item_id, qid):
        probs = answers.get((item_id, qid))
        return int(np.argmax(probs)) if probs else None

    def score(item_id, qid):
        probs = answers.get((item_id, qid))
        return expected(probs) if probs else None

    def option(item_id, qid, value):
        probs = answers.get((item_id, qid))
        if not probs:
            return None
        values = [c["value"] for c in bank[qid]["choices"]]
        return probs[values.index(value)] / sum(probs)

    def accuracy(name, pairs):
        pairs = [(a, b) for a, b in pairs if a is not None and b is not None]
        if pairs:
            out[name] = {"accuracy": float(np.mean([a == b for a, b in pairs])), "n": len(pairs)}

    def separation(name, pairs):
        pairs = [(s, y) for s, y in pairs if s is not None]
        if pairs:
            s, y = np.array(pairs, dtype=float).T
            value = auc(s, y)
            if value is not None:
                out[name] = {"auc": value, "n": len(pairs), "positives": int(y.sum())}

    if domain == "movies":
        # release_era is a score; level index is the era bin.
        accuracy("release_era", [(argmax(i, "release_era"), era_index(it["year"], [1960, 1980, 1990, 2000, 2010, 2020])) for i, it in items.items()])
        for genre, qid in (("Horror", "genre_horror"), ("Comedy", "genre_comedy"), ("Sci-Fi", "genre_scifi"), ("War", "genre_war"), ("Romance", "genre_romance"), ("Crime", "genre_crime")):
            separation(f"{qid} vs MovieLens '{genre}'", [(score(i, qid), genre in it["genres"]) for i, it in items.items()])
        separation("medium=live_action vs not Animation", [(option(i, "medium", "live_action"), "Animation" not in it["genres"]) for i, it in items.items()])
    elif domain == "books":
        accuracy("publication_era", [(argmax(i, "publication_era"), era_index(it["year"], [1800, 1900, 1946, 1980, 2000, 2010])) for i, it in items.items()])
        nonfiction = lambda it: any(s in {"non-fiction", "nonfiction", "memoir", "biography"} for s in it["shelves"])  # noqa: E731
        separation("fictionality (low) vs nonfiction shelves", [(None if score(i, "fictionality") is None else 1 - score(i, "fictionality"), nonfiction(it)) for i, it in items.items()])
    else:
        accuracy("era", [(argmax(i, "era"), era_index(it.get("date_start"), [500, 1400, 1600, 1750, 1850, 1900, 1945])) for i, it in items.items()])
        separation("primary_medium=oil_paint vs 'oil' in medium", [(option(i, "primary_medium", "oil_paint"), "oil" in (it.get("medium_display") or "").lower()) for i, it in items.items()])
        separation("primary_medium=print vs type Print", [(option(i, "primary_medium", "print"), it.get("artwork_type_title") == "Print") for i, it in items.items()])
        pairs = [(score(i, "saturation"), it.get("colorfulness")) for i, it in items.items() if it.get("colorfulness") is not None]
        pairs = [(a, b) for a, b in pairs if a is not None]
        if len(pairs) > 3:
            a, b = np.array(pairs).T
            out["saturation vs AIC image colorfulness"] = {"spearman": float(np.corrcoef(np.argsort(np.argsort(a)), np.argsort(np.argsort(b)))[0, 1]), "n": len(pairs)}
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", default="decisions", choices=list(PROVIDERS))
    args = parser.parse_args()
    config = PROVIDERS[args.provider]
    report = {}
    with workdir() as tmp:
        db = tmp / "answers.db"
        fetch(CACHE_KEY, db)
        con = sqlite3.connect(db)
        for domain in DOMAINS:
            rows = con.execute(
                "SELECT item_id, COUNT(*), SUM(input_tokens), SUM(usd), AVG(seconds) FROM calls "
                "WHERE provider=? AND model=? AND domain=? GROUP BY item_id",
                (args.provider, config["model"], domain),
            ).fetchall()
            if not rows:
                continue
            bank = {q["id"]: q for q in load_questions(domain)}
            answers = {
                (i, q): json.loads(p)
                for i, q, p in con.execute(
                    "SELECT item_id, question_id, probs FROM answers WHERE provider=? AND model=? AND domain=?",
                    (args.provider, config["model"], domain),
                )
            }
            complete = {i for i, _, _, _, _ in rows if sum(1 for q in bank if (i, q) in answers) == len(bank)}
            catalog = read_json(key(domain, "catalog.json"), tmp)
            ids = {f"aic{c['id']}" if domain == "art" else c.get("id"): c for c in catalog}
            if domain == "books":
                ids = {c["id"]: c for c in catalog}
            n_catalog = len(read_json(key(domain, "items.json"), tmp))
            per_item_tokens = np.mean([r[2] for r in rows if r[0] in complete]) if complete else float("nan")
            per_item_usd = np.mean([r[3] for r in rows if r[0] in complete]) if complete else float("nan")
            report[domain] = {
                "pilot_items": len(rows),
                "complete_items": len(complete),
                "requests": int(sum(r[1] for r in rows)),
                "input_tokens_per_item": float(per_item_tokens),
                "usd_per_item": float(per_item_usd),
                "seconds_per_request": float(np.mean([r[4] for r in rows])),
                "catalog_items": n_catalog,
                "projected_usd": float(per_item_usd * n_catalog),
                "checks": checks(domain, {i: ids[i] for i in complete if i in ids}, answers, bank),
            }
        total = con.execute("SELECT COALESCE(SUM(usd),0) FROM calls").fetchone()[0]
    print(json.dumps(report, indent=2))
    print(f"spent so far (all providers, all runs): ${total:.4f}")
    print(f"projected full answer run ({args.provider}): ${sum(r['projected_usd'] for r in report.values()):.2f}")


if __name__ == "__main__":
    main()
