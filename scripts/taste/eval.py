#!/usr/bin/env python3
"""How well does the model predict held-out users as they swipe?

Each test user (never seen in training) has 30 ratings held out. Up to 200
of the rest are the swipe pool: the simulated user can only be shown cards
they actually rated. After k swipes we score the held-out 30 by AUC and log
loss. We compare:

    qa / active      QA features, cards picked by BALD (what the demo does)
    qa / random      QA features, random cards
    dense / active   text-embedding-3-large PCA features, same model and prior
    dense / random
    popularity       each item's like rate among training users (no swipes)

We also check the profile readout without trusting the model. After 20 and 30
active swipes, each trait the readout would state ("prefers slow films") is
checked against the user's own ratings that weren't swiped: did they like
items higher on that feature more than they disliked them? Precision is the
share of claims whose direction matches. Claims are split into "shared" (the
population prior would say the same about anyone) and "personal" (learned
from this user's swipes); the prior's own claims are scored the same way as a
baseline. Writes taste/eval/<domain>.json.

    uv run --python 3.12 --with numpy --with boto3 python scripts/taste/eval.py --domain movies
"""

from __future__ import annotations

import argparse
import sqlite3
import time

import numpy as np

import data
from answer import CACHE_KEY
from build import RANKS, validation_score
from common import fetch, key, read_json, workdir, write_json
from embed import MODEL as EMBED_MODEL
from embed import vectors
from features import dense_features
from model import Prior, bald, fit, fit_prior, predictive, traits

CHECKPOINTS = (0, 5, 10, 15, 20, 25, 30, 40, 50)
PROFILE_AT = (20, 30)
MIN_SIDE = 5  # likes and dislikes needed to check a claim against a user's own ratings


def auc(scores: np.ndarray, y: np.ndarray) -> float | None:
    pos, neg = scores[y == 1], scores[y == 0]
    if len(pos) == 0 or len(neg) == 0:
        return None
    diff = pos[:, None] - neg[None, :]
    return float(((diff > 0) + 0.5 * (diff == 0)).mean())


def logloss(p: np.ndarray, y: np.ndarray) -> float:
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def simulate(X, prior, pool_items, pool_y, test_items, test_y, strategy, rng, profile=None):
    """Swipe through the pool; return {k: (auc, logloss)} and profile checks."""
    chosen: list[int] = []
    remaining = list(range(len(pool_items)))
    out, claims = {}, {}
    post = fit(prior, X[:0], np.zeros(0, bool), np.zeros(0))
    for k in range(max(CHECKPOINTS) + 1):
        if k in CHECKPOINTS:
            p = predictive(*post.predict(X[test_items]))
            out[k] = (auc(p, test_y), logloss(p, test_y))
        if profile and k in PROFILE_AT:
            claims[k] = profile(post, pool_items[chosen])
        if k == max(CHECKPOINTS):
            break
        if strategy == "random":
            pick = remaining[int(rng.integers(len(remaining)))]
        else:
            mean, var = post.predict(X[pool_items[remaining]])
            pick = remaining[int(np.argmax(bald(mean, var)))]
        remaining.remove(pick)
        chosen.append(pick)
        post = fit(prior, X[pool_items[chosen]], np.ones(len(chosen), bool), pool_y[chosen], c0=np.r_[post.c, 0.0])
    return out, claims


def claimed(post, C, CU, CCd, cut, z):
    mean, sd = traits(post, C, CU, CCd)
    ok = (np.abs(mean) >= cut["min"]) & (np.abs(mean) >= z * sd)
    return {int(j): (float(mean[j]), bool(abs(mean[j]) >= cut["strong"])) for j in np.flatnonzero(ok)}


def summarize(values: list[float]) -> dict:
    v = np.array([x for x in values if x is not None])
    return {"mean": float(v.mean()), "se": float(v.std(ddof=1) / np.sqrt(len(v))), "n": int(len(v))}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--domain", required=True, choices=["movies", "books"])
    parser.add_argument("--users", type=int, default=data.TEST_USERS)
    args = parser.parse_args()
    started = time.time()

    with workdir() as tmp:
        fetch(key(args.domain, "build.npz"), tmp / "build.npz")
        built = np.load(tmp / "build.npz")
        X, C = built["X"], built["C"]
        qa_prior = Prior(built["mu"], built["U"], built["d"])
        model = read_json(key(args.domain, "model.json"), tmp)
        cut, z = model["readout"], model["readout"]["z"]
        items = read_json(key(args.domain, "items.json"), tmp)

        db = tmp / "answers.db"
        fetch(CACHE_KEY, db)
        emb = vectors(sqlite3.connect(db), args.domain, items)
        if emb is None:
            raise SystemExit(f"run embed.py --domain {args.domain} first")
        Xd = dense_features(emb, X.shape[1] - 1)

        by_user = data.load_ratings(args.domain, tmp)
        groups = data.split(by_user)
        train = data.training_set(by_user, groups["train"])
        val = [data.holdout(by_user, u) for u in groups["val"]]
        print(f"fitting dense prior on {len(train)} users, {Xd.shape[1] - 1} dims", flush=True)
        best = None
        for rank in RANKS:
            candidate = fit_prior(Xd, train, rank, validate=lambda p: validation_score(Xd, p, val))
            score = validation_score(Xd, candidate, val)
            print(f"dense rank {rank}: validation log-lik {score:.4f}", flush=True)
            if best is None or score > best[0]:
                best = (score, rank, candidate)
        dense_prior = best[2]

        # Popularity: smoothed like rate per item among training users.
        likes, counts = np.zeros(len(items)), np.zeros(len(items))
        for item_ids, y in train:
            np.add.at(likes, item_ids, y)
            np.add.at(counts, item_ids, 1)
        popularity = (likes + 1) / (counts + 2)

        CU, CCd = C @ qa_prior.U[1:], (C * C) @ qa_prior.d[1:]
        runs = {f"{f}/{s}": {k: [] for k in CHECKPOINTS} for f in ("qa", "dense") for s in ("active", "random")}
        losses = {name: {k: [] for k in CHECKPOINTS} for name in runs}
        pop_auc = []
        profile = {k: {"claims": [], "personal": [], "agree": [], "agree_strong": [], "agree_personal": [], "agree_shared": []} for k in PROFILE_AT}
        # What the population prior alone would claim about anyone.
        everyone = claimed(fit(qa_prior, X[:0], np.zeros(0, bool), np.zeros(0)), C, CU, CCd, cut, z)
        prior_agree = []
        test_users = groups["test"][: args.users]
        for n, u in enumerate(test_users, 1):
            pool_items, pool_y, test_items, test_y = data.holdout(by_user, u)
            pop_auc.append(auc(popularity[test_items], test_y))
            all_items, all_y = by_user[u]

            def direction(swiped):
                """Model-free: liked minus disliked mean of each feature over the
                user's ratings that were not swiped, or None if too few of either."""
                rest = ~np.isin(all_items, swiped)
                liked, disliked = all_items[rest & (all_y == 1)], all_items[rest & (all_y == 0)]
                if len(liked) < MIN_SIDE or len(disliked) < MIN_SIDE:
                    return None
                return X[liked, 1:].mean(0) - X[disliked, 1:].mean(0)

            base = direction(np.zeros(0, int))
            if base is not None:
                prior_agree += [float(np.sign(v) == np.sign(base[j])) for j, (v, _) in everyone.items()]
            for feats, prior in (("qa", qa_prior), ("dense", dense_prior)):
                for strategy in ("active", "random"):
                    rng = np.random.default_rng(u)
                    check = (lambda post, swiped: (claimed(post, C, CU, CCd, cut, z), direction(swiped))) if (feats, strategy) == ("qa", "active") else None
                    out, claims = simulate(
                        X if feats == "qa" else Xd, prior, pool_items, pool_y, test_items, test_y, strategy, rng, check
                    )
                    for k, (a, l) in out.items():
                        runs[f"{feats}/{strategy}"][k].append(a)
                        losses[f"{feats}/{strategy}"][k].append(l)
                    for k, (made, observed) in claims.items():
                        personal = {j for j, (v, _) in made.items() if j not in everyone or np.sign(everyone[j][0]) != np.sign(v)}
                        profile[k]["claims"].append(len(made))
                        profile[k]["personal"].append(len(personal))
                        if observed is None:
                            continue
                        for j, (value, strong) in made.items():
                            same = float(np.sign(value) == np.sign(observed[j]))
                            profile[k]["agree"].append(same)
                            profile[k]["agree_personal" if j in personal else "agree_shared"].append(same)
                            if strong:
                                profile[k]["agree_strong"].append(same)
            if n % 50 == 0:
                print(f"{n}/{len(test_users)} users, {time.time() - started:.0f}s", flush=True)

        result = {
            "domain": args.domain,
            "users": len(test_users),
            "like_at": data.LIKE_AT,
            "held_out": 30,
            "checkpoints": list(CHECKPOINTS),
            "auc": {name: {k: summarize(v) for k, v in by_k.items()} for name, by_k in runs.items()},
            "logloss": {name: {k: summarize(v) for k, v in by_k.items()} for name, by_k in losses.items()},
            "popularity_auc": summarize(pop_auc),
            "dense": {"model": EMBED_MODEL, "dims": int(Xd.shape[1] - 1), "rank": best[1]},
            "qa": {"features": int(X.shape[1] - 1), "rank": int(qa_prior.U.shape[1])},
            "profile": {
                str(k): {
                    "claims_per_user": summarize(v["claims"]),
                    "personal_claims_per_user": summarize(v["personal"]),
                    "precision": summarize(v["agree"]) if v["agree"] else None,
                    "strong_precision": summarize(v["agree_strong"]) if v["agree_strong"] else None,
                    "personal_precision": summarize(v["agree_personal"]) if v["agree_personal"] else None,
                    "shared_precision": summarize(v["agree_shared"]) if v["agree_shared"] else None,
                }
                for k, v in profile.items()
            },
            "prior_claims": len(everyone),
            "prior_precision": summarize(prior_agree) if prior_agree else None,
        }
        write_json(result, key("eval", f"{args.domain}.json"), tmp)
        for name in runs:
            line = "  ".join(f"{k}:{result['auc'][name][k]['mean']:.3f}" for k in CHECKPOINTS)
            print(f"{name:14s} {line}")
        print(f"popularity     {result['popularity_auc']['mean']:.3f}")
        print(f"profile {result['profile']}")
        print(f"done in {time.time() - started:.0f}s")


if __name__ == "__main__":
    main()
