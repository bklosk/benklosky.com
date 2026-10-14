#!/usr/bin/env python3
"""Cluster a domain's catalog in question-space and lay it out with UMAP.

1. Question-space. Each item is its answers to the shown questions, read from
   the browser artifact so the page and this script see the same numbers. A
   score is its expected level in [0, 1]; a choice is its option
   probabilities, scaled by 1/sqrt(2) so a full disagreement on any one
   question costs the same squared distance (1). Hidden questions are left
   out, so neither the clusters nor the map can encode them. Columns are
   centered and compared by cosine, so a point's direction from the catalog
   average is what places it.
2. Map. UMAP (15 neighbors, cosine) to 2-D.
3. Clusters. Leiden community detection on UMAP's fuzzy neighbor graph, which
   is built in question-space, not on the 2-D layout. For each resolution, 10
   seeds are run and the partition that agrees most with the others (mean
   adjusted Rand index) is kept; groups under MIN_SIZE join the group they
   share the most edge weight with. The kept resolution is the most stable one
   with 6-8 groups (the page has eight colors), preferring more groups when
   stability ties within 0.01.
4. Descriptions. Each group's distinctive answers: features whose group mean
   sits furthest from the catalog mean in catalog sds, one per question,
   skipping features that correlate >= 0.6 with one already listed. Names are
   written by hand from these (NAMES, keyed by each group's most central
   item); a group whose central item changes falls back to its top answer.

Writes taste/<domain>/map.json. Rerun after build.py.

    uv run --python 3.12 --with numpy --with boto3 --with scikit-learn --with umap-learn \
        --with leidenalg --with igraph python scripts/taste/map.py --domain movies [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import time
from collections import Counter

import igraph as ig
import leidenalg
import numpy as np
import umap
from sklearn.metrics import adjusted_rand_score

from common import fetch, key, read_json, workdir, write_json

NEIGHBORS = 15
MIN_DIST = 0.1
RESOLUTIONS = np.round(np.arange(0.2, 1.01, 0.05), 2)
SEEDS = 10
MIN_SIZE = 20
GROUPS = (6, 8)
TIE = 0.01
DESCRIBE = 4
DEDUPE = 0.6

# Hand-written names, keyed by each group's most central item. Check them
# against --dry-run whenever the features change.
NAMES = {
    "movies": {
        "ml31685": "Rom-coms and gentle dramas",  # Hitch
        "ml4226": "Dark crime and thrillers",  # Memento
        "ml68358": "Sci-fi and superheroes",  # Star Trek
        "ml5110": "Broad comedies",  # Super Troopers
        "ml661": "Family and animation",  # James and the Giant Peach
        "ml786": "Action and spy films",  # Eraser
        "ml1214": "Horror",  # Alien
        "ml1250": "Epics, war, and history",  # The Bridge on the River Kwai
    },
    "books": {
        "gr810663": "Literary fiction",  # The Poisonwood Bible
        "gr2589896": "Crime and suspense",  # The Bone Collector
        "gr40098620": "Nonfiction",  # Yes Please
        "gr987750": "Epic fantasy",  # Knife of Dreams
        "gr132402": "Contemporary romance",  # This Lullaby
        "gr738775": "Paranormal romance",  # Living Dead in Dallas
        "gr15524542": "Dystopias and sci-fi",  # Insurgent
        "gr98895": "Children's books",  # One Fish, Two Fish, Red Fish, Blue Fish
    },
    "art": {
        "aic74042": "Objects and artifacts",  # Cushion Cover
        "aic81539": "Landscapes",  # On the Bank of the Seine, Bennecourt
        "aic8186": "Prints and drawings",  # Jesus Before Caiaphas
        "aic59809": "Portraits",  # Robert Brown of Newhall
        "aic51130": "Sacred and mythic scenes",  # Time Unveiling Truth
        "aic75568": "East Asian painting and prints",  # Recluse Dwellings in the Autumn Mountains
        "aic58135": "Sculpture",  # Portrait Head of Emperor Hadrian
    },
}


def question_space(artifact: dict, bin_path) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Centered question-space vectors (N x shown features), the raw features, and the shown mask."""
    n, f, _ = artifact["layout"]["X"]
    raw = np.frombuffer(bin_path.read_bytes()[: 2 * n * f], "<u2").reshape(n, f) / 65535
    features = artifact["features"]
    shown = np.array([not feat.get("hidden") for feat in features])
    weight = np.array([1.0 if feat["kind"] == "score" else 2**-0.5 for feat in features])
    Q = (raw - np.asarray(artifact["mean"])) * weight
    return Q[:, shown], raw, shown


def leiden(graph: ig.Graph, resolution: float, seed: int) -> np.ndarray:
    partition = leidenalg.find_partition(
        graph,
        leidenalg.RBConfigurationVertexPartition,
        weights="weight",
        resolution_parameter=resolution,
        seed=seed,
        n_iterations=-1,
    )
    return np.array(partition.membership)


def merge_small(labels: np.ndarray, G) -> np.ndarray:
    labels = labels.copy()
    while True:
        sizes = Counter(labels)
        small = [c for c, size in sizes.items() if size < MIN_SIZE]
        if not small:
            break
        c = min(small, key=lambda c: sizes[c])
        members = np.where(labels == c)[0]
        ties: Counter = Counter()
        edges = G[members].tocoo()
        for j, w in zip(edges.col, edges.data):
            if labels[j] != c:
                ties[labels[j]] += w
        if not ties:
            break
        labels[members] = ties.most_common(1)[0][0]
    return np.unique(labels, return_inverse=True)[1]


def consensus(graph: ig.Graph, G, resolution: float) -> tuple[np.ndarray, float]:
    """The seed whose partition agrees most with the others, and that mean agreement."""
    runs = [merge_small(leiden(graph, resolution, seed), G) for seed in range(SEEDS)]
    agree = np.array([[adjusted_rand_score(a, b) for b in runs] for a in runs])
    best = int(agree.sum(1).argmax())
    return runs[best], float((agree[best].sum() - 1) / (SEEDS - 1))


def describe(artifact: dict, raw: np.ndarray, corr: np.ndarray, members: np.ndarray) -> list[dict]:
    features = artifact["features"]
    mean, std = raw.mean(0), raw.std(0)
    effect = (raw[members].mean(0) - mean) / std
    picked: list[int] = []
    out: list[dict] = []
    questions, phrases = set(), set()
    for j in np.argsort(-np.abs(effect)):
        feat = features[j]
        if feat.get("hidden") or feat["question"] in questions:
            continue
        # A choice option describes a group only by being common in it.
        if feat["kind"] == "choice" and effect[j] < 0:
            continue
        phrase = feat["pos"] if feat["kind"] == "choice" or effect[j] > 0 else feat["neg"]
        if phrase in phrases or any(abs(corr[j, k]) >= DEDUPE for k in picked):
            continue
        picked.append(int(j))
        questions.add(feat["question"])
        phrases.add(phrase)
        out.append({"feature": int(j), "phrase": phrase, "effect": round(float(effect[j]), 2)})
        if len(out) >= DESCRIBE:
            break
    return out


def projection_check(Q: np.ndarray, Y: np.ndarray) -> float:
    """How far an item lands from its UMAP position when placed the way the page places the
    user (from its nearest other items), as a share of the map's diagonal. Median over items."""
    unit = Q / np.linalg.norm(Q, axis=1, keepdims=True)
    dist = 1 - unit @ unit.T
    np.fill_diagonal(dist, np.inf)
    errors = []
    for i in range(len(Q)):
        near = np.argsort(dist[i])[:NEIGHBORS]
        errors.append(np.linalg.norm(place(dist[i, near], Y[near]) - Y[i]))
    return float(np.median(errors) / np.linalg.norm(Y.max(0) - Y.min(0)))


def place(d: np.ndarray, Y: np.ndarray) -> np.ndarray:
    """UMAP's starting point for a new sample: its neighbors' positions, weighted by membership
    strength exp(-(d - rho) / sigma), sigma set so the strengths sum to log2(k). See map.ts."""
    rho = d.min()
    target = np.log2(len(d))
    lo, hi, sigma = 0.0, np.inf, 1.0
    for _ in range(64):
        total = np.exp(-np.maximum(d - rho, 0) / sigma).sum()
        if abs(total - target) < 1e-5:
            break
        if total > target:
            hi = sigma
            sigma = (lo + hi) / 2
        else:
            lo = sigma
            sigma = sigma * 2 if hi == np.inf else (lo + hi) / 2
    w = np.exp(-np.maximum(d - rho, 0) / sigma)
    return (w[:, None] * Y).sum(0) / w.sum()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--domain", required=True)
    parser.add_argument("--dry-run", action="store_true", help="print the groups; upload nothing")
    args = parser.parse_args()
    started = time.time()

    with workdir() as tmp:
        artifact = read_json(key(args.domain, "model.json"), tmp)
        bin_path = tmp / "model.bin"
        fetch(key(args.domain, "model.bin"), bin_path)
        Q, raw, shown = question_space(artifact, bin_path)
        Z = (raw - raw.mean(0)) / raw.std(0)
        corr = Z.T @ Z / len(Z)
        items = artifact["items"]
        print(f"{len(items)} items, {Q.shape[1]} shown features", flush=True)

        reducer = umap.UMAP(n_neighbors=NEIGHBORS, min_dist=MIN_DIST, metric="cosine", random_state=0)
        Y = reducer.fit_transform(Q)
        G = reducer.graph_.tocsr()
        coo = G.tocoo()
        upper = coo.row < coo.col
        graph = ig.Graph(n=len(items), edges=list(zip(coo.row[upper], coo.col[upper])), edge_attrs={"weight": coo.data[upper]})

        scan = []
        for resolution in RESOLUTIONS:
            labels, stability = consensus(graph, G, float(resolution))
            scan.append((float(resolution), int(labels.max() + 1), stability, labels))
            print(f"resolution {resolution}: {labels.max() + 1} groups, stability {stability:.3f}", flush=True)
        fits = [s for s in scan if GROUPS[0] <= s[1] <= GROUPS[1]]
        top = max(s[2] for s in fits)
        resolution, _, stability, labels = max((s for s in fits if s[2] >= top - TIE), key=lambda s: (s[1], s[2]))

        # Biggest group first, so it takes the first color.
        order = np.argsort(-np.bincount(labels), kind="stable")
        labels = np.argsort(order)[labels]
        names = NAMES.get(args.domain, {})
        clusters = []
        for c in range(labels.max() + 1):
            members = np.where(labels == c)[0]
            degree = np.asarray(G[members][:, members].sum(1)).ravel()
            central = members[np.argsort(-degree)]
            traits = describe(artifact, raw, corr, members)
            center = items[central[0]]["id"]
            name = names.get(center) or traits[0]["phrase"][:1].upper() + traits[0]["phrase"][1:]
            clusters.append(
                {
                    "name": name,
                    "center": center,
                    "size": int(len(members)),
                    "traits": [t["phrase"] for t in traits],
                    "examples": [items[i]["id"] for i in central[:5]],
                }
            )
            named = "" if center in names else "  (unnamed)"
            print(f"\n[{c}] {name}{named}  n={len(members)}  center {center} {items[central[0]]['title']!r}")
            print("    " + " | ".join(f"{t['phrase']} ({t['effect']:+})" for t in traits))
            print("    e.g. " + "; ".join(items[i]["title"] for i in central[:6]))

        drift = projection_check(Q, Y)
        print(f"\nresolution {resolution}, stability {stability:.3f}; placing an item from its neighbors lands it {drift:.1%} of the map's diagonal from its own spot (median)")

        if args.dry_run:
            return
        Y = (Y - Y.min(0)).round(3)
        out = {
            "domain": args.domain,
            "model": artifact["version"],
            "neighbors": NEIGHBORS,
            "method": {
                "resolution": resolution,
                "stability": round(stability, 3),
                "drift": round(drift, 4),
            },
            "clusters": clusters,
            # [item id, x, y, cluster]
            "points": [[item["id"], float(x), float(y), int(c)] for item, (x, y), c in zip(items, Y, labels)],
        }
        write_json(out, key(args.domain, "map.json"), tmp)
        print(f"mapped {args.domain} in {time.time() - started:.0f}s", flush=True)


if __name__ == "__main__":
    main()
