#!/usr/bin/env python3
"""Build a domain's model from cached answers: features, prior, browser artifact.

1. Answers -> features (features.py), standardized over the catalog.
2. A population prior fit by EM on training users (model.py). The rank of
   its covariance is chosen on validation users. Art has no ratings dataset,
   so its prior is built from the catalog instead (catalog_prior).
3. Readout thresholds, set from the spread of traits among validation users
   (for art, among users drawn from its prior).
4. The artifact the page loads: taste/<domain>/model.json and model.bin.
   Intermediate arrays go to taste/<domain>/build.npz for eval.py.

    uv run --python 3.12 --with numpy --with boto3 python scripts/taste/build.py --domain movies

--dry-run DIR writes the three files to DIR instead of uploading them.
"""

from __future__ import annotations

import argparse
import json
import shutil
import time
from pathlib import Path

import numpy as np

import data
from answer import CACHE_KEY, PROVIDERS
from common import fetch, key, load_questions, read_json, upload, workdir
from features import answers, raw_features, standardize
from model import Prior, fit, fit_prior, predictive, sigmoid, traits

RANKS = (8, 16, 32)
VAL_SWIPES = 20
Z = 1.645  # a trait is claimed only when its 90% interval excludes zero
DEDUPE = 0.6  # skip a trait whose feature correlates this much with one already shown
PIN_SD = 0.05  # profile edits are observations of a trait with this sd

# The art prior copies the shape of the learned film and book priors, which put about half of an
# item's score variance in a low-rank part and vary along about 15 effective directions. The art
# isotropic prior it replaces spread the same variance over 47, so each swipe taught it far less.
CATALOG_SCORE_VAR = 2.25  # prior variance of an item's score: sd 1.5 logits
CATALOG_RANK = 32  # the low-rank part lies on the catalog's top principal components
CATALOG_BETA = 0.75  # weight variance on component k grows as eigenvalue_k^beta: 16 effective directions
CATALOG_LOW_SHARE = 0.45  # films 47%, books 41%


def quantize_features(raw: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """uint16 codes, and the raw values they decode to, so Python and the browser agree."""
    codes = np.round(np.clip(raw, 0, 1) * 65535).astype("<u2")
    return codes, codes.astype(np.float64) / 65535


def quantize_corr(C: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    codes = np.round(np.clip(C, -1, 1) * 32767).astype("<i2")
    return codes, codes.astype(np.float64) / 32767


def validation_score(X: np.ndarray, prior: Prior, users: list[tuple]) -> float:
    """Mean held-out log-likelihood after VAL_SWIPES random swipes."""
    scores = []
    for pool_items, pool_y, test_items, test_y in users:
        post = fit(prior, X[pool_items[:VAL_SWIPES]], np.ones(VAL_SWIPES, bool), pool_y[:VAL_SWIPES])
        p = np.clip(predictive(*post.predict(X[test_items])), 1e-6, 1 - 1e-6)
        scores.append(np.mean(test_y * np.log(p) + (1 - test_y) * np.log(1 - p)))
    return float(np.mean(scores))


def thresholds(X: np.ndarray, C: np.ndarray, prior: Prior, by_user: dict, users: list[int], shown: np.ndarray) -> dict:
    """Trait size cutoffs: 'lean' at the 50th and 'strong' at the 85th percentile
    of |trait| among validation users' full-data posteriors."""
    CU, CCd = C @ prior.U[1:], (C * C) @ prior.d[1:]
    sizes = []
    for u in users:
        items, y = by_user[u]
        if len(items) > 500:
            keep = np.random.default_rng(u + 1).choice(len(items), 500, replace=False)
            items, y = items[keep], y[keep]
        post = fit(prior, X[items], np.ones(len(y), bool), y)
        mean, sd = traits(post, C, CU, CCd)
        sizes.append(np.abs(mean[shown & (np.abs(mean) > Z * sd)]))
    sizes = np.concatenate(sizes) if sizes else np.zeros(1)
    return {"min": float(np.percentile(sizes, 50)), "strong": float(np.percentile(sizes, 85))}


def catalog_prior(C: np.ndarray) -> Prior:
    """A prior for a domain with no ratings: taste varies most along the catalog's main axes."""
    F = len(C)
    lam, V = np.linalg.eigh(C)
    lam, V = lam[::-1][:CATALOG_RANK], V[:, ::-1][:, :CATALOG_RANK]
    # An item's score varies by lam_k c_k along component k, so the low-rank part gets its share.
    c = lam**CATALOG_BETA
    c *= CATALOG_LOW_SHARE * CATALOG_SCORE_VAR / (lam @ c)
    U = np.zeros((F + 1, CATALOG_RANK))
    U[1:] = V * np.sqrt(c)
    d = np.full(F + 1, (1 - CATALOG_LOW_SHARE) * CATALOG_SCORE_VAR / F)
    d[0] = 1.0
    return Prior(np.zeros(F + 1), U, d)


def prior_users(X: np.ndarray, prior: Prior, users: int = 150, ratings: int = 300) -> dict:
    """Simulated users drawn from the prior, standing in for validation users when there are none."""
    rng = np.random.default_rng(0)
    by_user = {}
    for u in range(users):
        w = prior.mu + prior.U @ rng.standard_normal(prior.U.shape[1]) + np.sqrt(prior.d) * rng.standard_normal(len(prior.d))
        items = rng.choice(len(X), ratings, replace=False)
        by_user[u] = (items, (rng.random(ratings) < sigmoid(X[items] @ w)).astype(float))
    return by_user


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--domain", required=True)
    parser.add_argument("--provider", default="decisions")
    parser.add_argument("--dry-run", metavar="DIR", type=Path, help="write the artifact to DIR instead of uploading it")
    args = parser.parse_args()
    started = time.time()
    model_name = PROVIDERS[args.provider]["model"]

    def publish(path: Path, object_key: str) -> None:
        if args.dry_run:
            args.dry_run.mkdir(parents=True, exist_ok=True)
            shutil.copy(path, args.dry_run / path.name)
            print(f"wrote {args.dry_run / path.name} (not uploaded)", flush=True)
        else:
            upload(path, object_key)

    with workdir() as tmp:
        items = read_json(key(args.domain, "items.json"), tmp)
        bank = load_questions(args.domain)
        db = tmp / "answers.db"
        fetch(CACHE_KEY, db)
        raw, meta, missing = raw_features(bank, items, answers(db, args.provider, model_name, args.domain))
        codes, raw = quantize_features(raw)
        X, mean, std = standardize(raw)
        Z_ = X[:, 1:]
        C_codes, C = quantize_corr(Z_.T @ Z_ / len(Z_))
        D = X.shape[1]
        print(f"{len(items)} items, {len(meta)} features from {len(bank)} questions, {missing:.1%} answers missing", flush=True)

        stats: dict = {"items": len(items), "questions": len(bank), "features": len(meta), "missing": missing}
        shown = np.array([not m["hidden"] for m in meta])
        if args.domain == "art":
            prior = catalog_prior(C)
            by_user = prior_users(X, prior)
            cut = thresholds(X, C, prior, by_user, list(by_user), shown)
            stats.update(prior="catalog", rank=CATALOG_RANK, beta=CATALOG_BETA, low_share=CATALOG_LOW_SHARE)
        else:
            by_user = data.load_ratings(args.domain, tmp)
            groups = data.split(by_user)
            train = data.training_set(by_user, groups["train"])
            val = [data.holdout(by_user, u) for u in groups["val"]]
            best = None
            for rank in RANKS:
                print(f"rank {rank}", flush=True)
                candidate = fit_prior(X, train, rank, validate=lambda p: validation_score(X, p, val))
                score = validation_score(X, candidate, val)
                print(f"rank {rank}: validation log-lik {score:.4f}", flush=True)
                if best is None or score > best[0]:
                    best = (score, rank, candidate)
            _, rank, prior = best
            cut = thresholds(X, C, prior, by_user, groups["val"][:150], shown)
            stats.update(prior="learned", rank=rank, train_users=len(train), validation_loglik=best[0])
        print(f"thresholds {cut}", flush=True)

        npz = tmp / "build.npz"
        np.savez_compressed(npz, X=X, C=C, mu=prior.mu, U=prior.U, d=prior.d)
        publish(npz, key(args.domain, "build.npz"))

        # The browser artifact: JSON for small things, one binary for the matrices.
        U = prior.U.astype("<f4")
        blob = codes.tobytes() + C_codes.tobytes() + U.tobytes()
        bin_path = tmp / "model.bin"
        bin_path.write_bytes(blob)
        publish(bin_path, key(args.domain, "model.bin"))
        public_items = [
            {k: item.get(k) for k in ("id", "title", "creator", "year", "subtitle", "blurb", "tags", "link", "credit", "alt")}
            | {"image": bool(item.get("image"))}
            for item in items
        ]
        artifact = {
            "domain": args.domain,
            "version": int(time.time()),
            "answerer": f"{args.provider}/{model_name}",
            "items": public_items,
            "features": meta,
            "mean": mean.round(6).tolist(),
            "std": std.round(6).tolist(),
            "mu": prior.mu.round(6).tolist(),
            "d": prior.d.round(8).tolist(),
            "rank": int(prior.U.shape[1]),
            "layout": {"X": [len(items), len(meta), "uint16"], "C": [len(meta), len(meta), "int16"], "U": [D, int(prior.U.shape[1]), "float32"]},
            "readout": {"z": Z, "min": cut["min"], "strong": cut["strong"], "dedupe": DEDUPE, "pinSd": PIN_SD},
            "stats": stats,
        }
        json_path = tmp / "model.json"
        json_path.write_text(json.dumps(artifact, separators=(",", ":")))
        publish(json_path, key(args.domain, "model.json"))
        print(f"built {args.domain} in {time.time() - started:.0f}s: {json.dumps(stats)}", flush=True)


if __name__ == "__main__":
    main()
