#!/usr/bin/env python3
"""Write a small synthetic fixture so src/app/taste/model.test.ts can check that
the browser model matches model.py.

    uv run --python 3.12 --with numpy python scripts/taste/parity.py && bun test src/app/taste
"""

from __future__ import annotations

import base64
import json
from pathlib import Path

import numpy as np

from build import quantize_corr, quantize_features
from features import standardize
from model import Prior, bald, fit, predictive, trait_rows, traits

OUT = Path(__file__).resolve().parents[2] / "src" / "app" / "taste" / "parity.fixture.json"
PIN_SD = 0.05


def main() -> None:
    rng = np.random.default_rng(3)
    N, F, K = 40, 9, 3
    codes, raw = quantize_features(rng.beta(2, 3, size=(N, F)))
    X, mean, std = standardize(raw)
    C_codes, C = quantize_corr(X[:, 1:].T @ X[:, 1:] / N)
    U = (rng.normal(size=(F + 1, K)) * 0.3).astype("<f4")
    prior = Prior(rng.normal(size=F + 1) * 0.2, U.astype(np.float64), rng.uniform(0.02, 0.1, F + 1))

    swipes = [(3, 1), (17, 0), (8, 1), (29, 1), (11, 0), (2, 0)]
    pin = (4, -0.5)
    A = np.vstack([X[[i for i, _ in swipes]], trait_rows(C, pin[0])])
    logistic = np.r_[np.ones(len(swipes), bool), False]
    target = np.r_[[float(y) for _, y in swipes], pin[1]]
    noise = np.r_[np.ones(len(swipes)), PIN_SD**2]
    post = fit(prior, A, logistic, target, noise)
    item_mean, item_var = post.predict(X)
    t_mean, t_sd = traits(post, C, C @ prior.U[1:], (C * C) @ prior.d[1:])

    artifact = {
        "domain": "parity",
        "version": 0,
        "answerer": "synthetic",
        "items": [],
        "features": [],
        "mean": mean.tolist(),
        "std": std.tolist(),
        "mu": prior.mu.tolist(),
        "d": prior.d.tolist(),
        "rank": K,
        "layout": {"X": [N, F, "uint16"], "C": [F, F, "int16"], "U": [F + 1, K, "float32"]},
        "readout": {"z": 1.645, "min": 0.1, "strong": 0.4, "dedupe": 0.6, "pinSd": PIN_SD},
        "stats": {},
    }
    fixture = {
        "artifact": artifact,
        "bin": base64.b64encode(codes.tobytes() + C_codes.tobytes() + U.tobytes()).decode(),
        "swipes": swipes,
        "pin": pin,
        "expected": {
            "m": post.mean.tolist(),
            "itemMean": item_mean.tolist(),
            "itemVar": item_var.tolist(),
            "predictive": predictive(item_mean, item_var).tolist(),
            "bald": bald(item_mean, item_var).tolist(),
            "traitMean": t_mean.tolist(),
            "traitSd": t_sd.tolist(),
        },
    }
    OUT.write_text(json.dumps(fixture) + "\n")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
