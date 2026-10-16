#!/usr/bin/env python3
"""Compare art priors on simulated users: the catalog prior build.py uses against the
isotropic prior it replaced. Art has no ratings, so this is the only check it gets.

Four kinds of user, two of them drawn from neither prior:

    features   cares strongly about four random shown features (weights of +-0.8)
    groups     likes one or two of the map's groups (+1.5 logits) and not the rest (-1)
    isotropic  drawn from the isotropic prior
    catalog    drawn from the catalog prior

Each user has a hidden like or dislike for every item, drawn from their true
utility. Swipes are 40 BALD-picked cards, as on the page. At each checkpoint we
count the profile's claims and guesses (as readout.ts builds them), check each
one's direction against the true trait (the slope of the user's utility on that
feature), and score the model on the items not yet swiped (AUC).

Reads taste/art/build.npz, model.json, and map.json; writes nothing.

    uv run --python 3.12 --with numpy --with boto3 python scripts/taste/eval_art.py
"""

from __future__ import annotations

import argparse

import numpy as np

from build import CATALOG_SCORE_VAR, DEDUPE, Z, catalog_prior, prior_users, thresholds
from common import fetch, key, read_json, workdir
from model import Prior, bald, fit, predictive, sigmoid, traits

GUESS_Z, LIMIT, FILL = 0.5, 10, 3  # readout.ts
CHECK = (8, 16, 24, 40)
KINDS = ("features", "groups", "isotropic", "catalog")


def isotropic_prior(D: int) -> Prior:
    """The art prior before the catalog prior: independent weights, the same score scale."""
    d = np.full(D, CATALOG_SCORE_VAR / (D - 1))
    d[0] = 1.0
    return Prior(np.zeros(D), np.zeros((D, 1)), d)


def pct(hits: list) -> str:
    return f"{np.mean(hits):.0%}" if hits else "  - "


def auc(score: np.ndarray, y: np.ndarray) -> float:
    ranks = np.empty(len(score))
    ranks[np.argsort(score)] = np.arange(1, len(score) + 1)
    pos = y.astype(bool)
    n1, n0 = pos.sum(), (~pos).sum()
    return float((ranks[pos].sum() - n1 * (n1 + 1) / 2) / (n1 * n0)) if n1 and n0 else np.nan


def readout(mean, sd, C, shown, cut):
    """readout.ts profile(): claims, strongest first, then the surest guesses up to FILL."""
    size, z = np.abs(mean), np.abs(mean) / sd
    claim = shown & (size >= cut["min"]) & (size >= Z * sd)
    guess = shown & ~claim & (z >= GUESS_Z)
    out: list[tuple[int, bool]] = []
    for j, is_guess, cap in [(j, False, LIMIT) for j in np.flatnonzero(claim)[np.argsort(-size[claim])]] + [
        (j, True, min(FILL, LIMIT)) for j in np.flatnonzero(guess)[np.argsort(-z[guess])]
    ]:
        if len(out) >= cap or any(abs(C[j, k]) >= DEDUPE for k, _ in out):
            continue
        out.append((j, is_guess))
    return out


def make_user(kind, X, groups, shown, priors, rng):
    N, D = X.shape
    if kind == "features":
        w = np.zeros(D)
        w[1 + rng.choice(np.flatnonzero(shown), 4, replace=False)] = rng.choice([-0.8, 0.8], 4)
        u = X @ w
    elif kind == "groups":
        liked = rng.choice(groups.max() + 1, rng.integers(1, 3), replace=False)
        u = np.where(np.isin(groups, liked), 1.5, -1.0) + 0.5 * rng.standard_normal(N)
    else:
        prior = priors[kind]
        w = prior.U @ rng.standard_normal(prior.U.shape[1]) + np.sqrt(prior.d) * rng.standard_normal(D)
        u = X[:, 1:] @ w[1:]
    truth = X[:, 1:].T @ (u - u.mean()) / N
    return truth, (rng.random(N) < sigmoid(u)).astype(float)


def run(X, C, shown, has_image, prior, cut, truth, y):
    CU, CCd = C @ prior.U[1:], (C * C) @ prior.d[1:]
    post = fit(prior, X[:0], np.zeros(0, bool), np.zeros(0))
    chosen: list[int] = []
    seen = np.zeros(len(X), bool)
    for k in range(1, CHECK[-1] + 1):
        mean, var = post.predict(X)
        i = int(np.argmax(np.where(seen | ~has_image, -np.inf, bald(mean, var))))
        chosen.append(i)
        seen[i] = True
        post = fit(prior, X[chosen], np.ones(k, bool), y[chosen], c0=np.r_[post.c, 0.0])
        if k in CHECK:
            tm, ts = traits(post, C, CU, CCd)
            profile = readout(tm, ts, C, shown, cut)
            m, v = post.predict(X[~seen])
            yield k, [(g, np.sign(tm[j]) == np.sign(truth[j])) for j, g in profile], auc(predictive(m, v), y[~seen])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--users", type=int, default=100, help="per kind of user")
    args = parser.parse_args()

    with workdir() as tmp:
        fetch(key("art", "build.npz"), tmp / "build.npz")
        built = np.load(tmp / "build.npz")
        X, C = built["X"], built["C"]
        model = read_json(key("art", "model.json"), tmp)
        mapping = read_json(key("art", "map.json"), tmp)

    shown = np.array([not f.get("hidden") for f in model["features"]])
    has_image = np.array([item["image"] for item in model["items"]])
    group_of = {p[0]: p[3] for p in mapping["points"]}
    groups = np.array([group_of[item["id"]] for item in model["items"]])
    priors = {"isotropic": isotropic_prior(X.shape[1]), "catalog": catalog_prior(C)}
    simulated = prior_users(X, priors["catalog"])
    cuts = {
        # The isotropic prior shipped with hand-set cutoffs; the catalog prior's come from build.py's rule.
        "isotropic": {"min": 0.15, "strong": 0.4},
        "catalog": thresholds(X, C, priors["catalog"], simulated, list(simulated), shown),
    }
    print(f"catalog prior cutoffs: {cuts['catalog']}")

    for kind in KINDS:
        for name, prior in priors.items():
            rows = {k: {"claims": [], "guesses": [], "claim_ok": [], "guess_ok": [], "auc": []} for k in CHECK}
            for u in range(args.users):
                rng = np.random.default_rng(1000 + u)
                truth, y = make_user(kind, X, groups, shown, priors, rng)
                for k, profile, score in run(X, C, shown, has_image, prior, cuts[name], truth, y):
                    r = rows[k]
                    r["claims"].append(sum(not g for g, _ in profile))
                    r["guesses"].append(sum(g for g, _ in profile))
                    r["claim_ok"] += [ok for g, ok in profile if not g]
                    r["guess_ok"] += [ok for g, ok in profile if g]
                    r["auc"].append(score)
            print(f"\n{kind} users, {name} prior:")
            for k, r in rows.items():
                print(
                    f"  {k:2d} swipes: {np.mean(r['claims']):.1f} claims ({pct(r['claim_ok'])} right), "
                    f"{np.mean(r['guesses']):.1f} guesses ({pct(r['guess_ok'])} right), AUC {np.nanmean(r['auc']):.3f}"
                )


if __name__ == "__main__":
    main()
