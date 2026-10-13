"""Turn cached answers into item features.

A score question becomes one feature: the expected level, scaled to [0, 1].
A choice question becomes one feature per option: its probability. Features
that barely vary across the catalog carry no signal and are dropped.
Every feature keeps the English it came from, so a weight can be read back.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import numpy as np

MIN_STD = 0.02


def answers(db: Path, provider: str, model: str, domain: str) -> dict[tuple[str, str], list[float]]:
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    rows = con.execute(
        "SELECT item_id, question_id, probs FROM answers WHERE provider=? AND model=? AND domain=?",
        (provider, model, domain),
    )
    out = {(item, question): json.loads(probs) for item, question, probs in rows}
    con.close()
    return out


def raw_features(bank: list[dict], items: list[dict], found: dict) -> tuple[np.ndarray, list[dict], float]:
    """(N x F) matrix in [0, 1], the feature metadata, and the share of answers missing."""
    columns: list[np.ndarray] = []
    meta: list[dict] = []
    missing = 0
    for q in bank:
        n_opts = len(q["levels"]) if q["type"] == "score" else len(q["choices"])
        P = np.full((len(items), n_opts), np.nan)
        for i, item in enumerate(items):
            probs = found.get((item["id"], q["id"]))
            if probs and sum(probs) > 0:
                P[i] = np.asarray(probs) / sum(probs)
        absent = np.isnan(P[:, 0])
        missing += int(absent.sum())
        if absent.all():
            continue
        P[absent] = np.nanmean(P, axis=0)
        if q["type"] == "score":
            columns.append(P @ np.arange(n_opts) / (n_opts - 1))
            meta.append(
                {
                    "question": q["id"],
                    "option": None,
                    "kind": "score",
                    "group": q["group"],
                    "text": q["instructions"],
                    "pos": q["high"],
                    "neg": q["low"],
                    "topic": q["topic"],
                    "levels": [level["label"] for level in q["levels"]],
                }
            )
        else:
            for k, choice in enumerate(q["choices"]):
                columns.append(P[:, k])
                meta.append(
                    {
                        "question": q["id"],
                        "option": choice["value"],
                        "kind": "choice",
                        "group": q["group"],
                        "text": q["instructions"],
                        "pos": choice["phrase"],
                        "neg": choice["phrase"],
                        "topic": choice["phrase"],
                        "levels": None,
                    }
                )
    X = np.stack(columns, 1)
    keep = X.std(0) >= MIN_STD
    return X[:, keep], [m for m, k in zip(meta, keep) if k], missing / (len(items) * len(bank))


def standardize(raw: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Bias column plus z-scored features; also returns mean and std."""
    mean, std = raw.mean(0), raw.std(0)
    Z = (raw - mean) / std
    return np.c_[np.ones(len(raw)), Z], mean, std


def dense_features(vectors: np.ndarray, dims: int) -> np.ndarray:
    """PCA-whitened embedding coordinates plus a bias column, for the baseline."""
    centered = vectors - vectors.mean(0)
    u, s, _ = np.linalg.svd(centered, full_matrices=False)
    dims = min(dims, len(s) - 1)
    Z = u[:, :dims] * np.sqrt(len(vectors))
    return np.c_[np.ones(len(vectors)), Z]
