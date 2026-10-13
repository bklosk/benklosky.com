#!/usr/bin/env python3
"""Build a domain's model from cached answers: features, prior, browser artifact.

1. Answers -> features (features.py), standardized over the catalog.
2. A population prior fit by EM on training users (model.py). The rank of
   its covariance is chosen on validation users. Art has no ratings dataset,
   so its prior is isotropic.
3. Readout thresholds, set from the spread of traits among validation users.
4. The artifact the page loads: taste/<domain>/model.json and model.bin.
   Intermediate arrays go to taste/<domain>/build.npz for eval.py.

    uv run --python 3.12 --with numpy --with boto3 python scripts/taste/build.py --domain movies
"""

from __future__ import annotations

import argparse
import json
import time

import numpy as np

import data
from answer import CACHE_KEY, PROVIDERS
from common import fetch, key, load_questions, read_json, upload, workdir, write_json
from features import answers, raw_features, standardize
from model import Prior, fit, fit_prior, predictive, traits

RANKS = (8, 16, 32)
VAL_SWIPES = 20
Z = 1.645  # a trait is claimed only when its 90% interval excludes zero
DEDUPE = 0.6  # skip a trait whose feature correlates this much with one already shown
PIN_SD = 0.05  # profile edits are observations of a trait with this sd


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


def thresholds(X: np.ndarray, C: np.ndarray, prior: Prior, by_user: dict, users: list[int]) -> dict:
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
        sizes.append(np.abs(mean[np.abs(mean) > Z * sd]))
    sizes = np.concatenate(sizes) if sizes else np.zeros(1)
    return {"min": float(np.percentile(sizes, 50)), "strong": float(np.percentile(sizes, 85))}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--domain", required=True)
    parser.add_argument("--provider", default="decisions")
    args = parser.parse_args()
    started = time.time()
    model_name = PROVIDERS[args.provider]["model"]

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
        if args.domain == "art":
            # No ratings to learn from: independent weights, scaled so the prior
            # sd of an item's score is about 1.5 logits.
            mu = np.zeros(D)
            d = np.full(D, 2.25 / (D - 1))
            d[0] = 1.0
            prior = Prior(mu, np.zeros((D, 1)), d)
            cut = {"min": 0.15, "strong": 0.4}
            stats["prior"] = "isotropic"
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
            cut = thresholds(X, C, prior, by_user, groups["val"][:150])
            stats.update(prior="learned", rank=rank, train_users=len(train), validation_loglik=best[0])
        print(f"thresholds {cut}", flush=True)

        npz = tmp / "build.npz"
        np.savez_compressed(npz, X=X, C=C, mu=prior.mu, U=prior.U, d=prior.d)
        upload(npz, key(args.domain, "build.npz"))

        # The browser artifact: JSON for small things, one binary for the matrices.
        U = prior.U.astype("<f4")
        blob = codes.tobytes() + C_codes.tobytes() + U.tobytes()
        bin_path = tmp / "model.bin"
        bin_path.write_bytes(blob)
        upload(bin_path, key(args.domain, "model.bin"))
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
        write_json(artifact, key(args.domain, "model.json"), tmp)
        print(f"built {args.domain} in {time.time() - started:.0f}s: {json.dumps(stats)}", flush=True)


if __name__ == "__main__":
    main()
