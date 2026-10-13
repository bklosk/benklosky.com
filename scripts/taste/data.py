"""Ratings, like/dislike labels, and the fixed user split shared by build and eval."""

from __future__ import annotations

from pathlib import Path

import numpy as np

from common import fetch, key

LIKE_AT = 4.0  # a rating of 4+ stars is a right swipe
SPLIT_SEED = 7
TEST_USERS = 800
VAL_USERS = 300
HEAVY = 80  # test and validation users need this many ratings in the catalog
TRAIN_USERS = 4000
TRAIN_CAP = 200  # ratings per training user, sampled


def load_ratings(domain: str, tmp: Path) -> dict[int, tuple[np.ndarray, np.ndarray]]:
    """user -> (item indices, 0/1 labels)."""
    path = tmp / f"{domain}-ratings.npz"
    fetch(key(domain, "ratings.npz"), path)
    data = np.load(path)
    order = np.argsort(data["user"], kind="stable")
    users, items, ratings = data["user"][order], data["item"][order], data["rating"][order]
    bounds = np.flatnonzero(np.diff(users)) + 1
    out = {}
    for u_items, u_ratings, u in zip(np.split(items, bounds), np.split(ratings, bounds), users[np.r_[0, bounds]]):
        out[int(u)] = (u_items.astype(np.int64), (u_ratings >= LIKE_AT).astype(float))
    return out


def split(by_user: dict) -> dict[str, list[int]]:
    """Seeded split. Test and validation users are drawn from heavy raters so
    every one of them can supply 50 swipes and still keep 30 held-out items."""
    rng = np.random.default_rng(SPLIT_SEED)
    ids = np.array(sorted(by_user))
    rng.shuffle(ids)
    heavy = [u for u in ids if len(by_user[u][0]) >= HEAVY]
    test = heavy[:TEST_USERS]
    val = heavy[TEST_USERS : TEST_USERS + VAL_USERS]
    held = set(test) | set(val)
    train = [int(u) for u in ids if u not in held][:TRAIN_USERS]
    return {"train": train, "val": [int(u) for u in val], "test": [int(u) for u in test]}


def training_set(by_user: dict, users: list[int]) -> list[tuple[np.ndarray, np.ndarray]]:
    rng = np.random.default_rng(SPLIT_SEED + 1)
    out = []
    for u in users:
        items, y = by_user[u]
        if len(items) > TRAIN_CAP:
            pick = rng.choice(len(items), TRAIN_CAP, replace=False)
            items, y = items[pick], y[pick]
        out.append((items, y))
    return out


POOL_CAP = 200  # candidate cards per simulated user, to keep active selection cheap


def holdout(by_user: dict, u: int, n_test: int = 30) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Per-user seeded split into a swipe pool (at most POOL_CAP) and a held-out test set."""
    items, y = by_user[u]
    perm = np.random.default_rng(u).permutation(len(items))
    test, pool = perm[:n_test], perm[n_test : n_test + POOL_CAP]
    return items[pool], y[pool], items[test], y[test]
