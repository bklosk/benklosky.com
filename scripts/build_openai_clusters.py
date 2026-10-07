#!/usr/bin/env python3
"""Cluster chart notes in OpenAI text-embedding-3-large space, then draw a UMAP.

Reads openai_embeddings.db, jev_answers.db, and patient_profiles.db from the
[REDACTED] Space. k-means runs on the L2-normalized 3072-d vectors, so distance
is the cosine distance the model was trained for. The UMAP is only the picture:
it is fit on the first 50 principal components of those vectors. Colors come
from the k-means labels.

Silhouette on this space is a guide, not a verdict. The sweep keeps every k
from 5 to 10 whose silhouette is close to the best, and among those picks the
k whose groups each have a different elevated presentation score. Labels are
those Jev scores, so the map can be read next to the presentation map even
though the embedding itself is opaque.

The map draws a sample, up to a cap per cluster. Chart text is reused from
symptom_charts/ when that object already exists, and uploaded there otherwise.

    uv run --python 3.12 --with numpy --with scikit-learn --with umap-learn \
        --with boto3 python scripts/build_openai_clusters.py
"""

from __future__ import annotations

import json
import sqlite3
from collections import Counter
from pathlib import Path

import numpy as np
import umap
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score

from build_symptom_clusters import (
    CHART_PREFIX,
    QUESTIONS,
    SETTINGS,
    load,
    marks_for,
    question_list,
    upload_charts,
)
from space import download, list_keys, upload, workdir

EMBEDDINGS_KEY = "openai_embeddings.db"
ANSWERS_KEY = "jev_answers.db"
PATIENTS_KEY = "patient_profiles.db"
OUTPUT_KEY = "openai_clusters.json"
MODEL = "text-embedding-3-large"
DIMS = 3072
PCA_DIMS = 50
SAMPLE_CAP = 160
QUIET_CAP = 450

PALETTE = (
    "#c9c6bf",
    "#8d8d8d",
    "#d06a2b",
    "#2c5d8f",
    "#7a3f9b",
    "#c23b3b",
    "#2a9d8f",
    "#9b3d68",
    "#b08a1f",
    "#1f6b4a",
    "#3d4a7a",
    "#a34b2e",
)


def load_embeddings(path: Path) -> tuple[list[int], np.ndarray]:
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    meta = dict(con.execute("SELECT key, value FROM meta"))
    if meta.get("model") != MODEL or int(meta.get("dims", "0")) != DIMS:
        raise SystemExit(f"{EMBEDDINGS_KEY} is not {MODEL} at {DIMS} dimensions")
    rows = con.execute(
        "SELECT encounter_id, embedding FROM embeddings ORDER BY encounter_id"
    ).fetchall()
    con.close()
    ids = [int(row[0]) for row in rows]
    vectors = np.vstack(
        [np.frombuffer(row[1], dtype="<f4").astype(np.float64) for row in rows]
    )
    if vectors.shape != (len(ids), DIMS):
        raise SystemExit(f"expected {(len(ids), DIMS)} embeddings, got {vectors.shape}")
    if not np.isfinite(vectors).all():
        raise SystemExit("embedding matrix has non-finite values")
    return ids, normalize(vectors)


def normalize(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms < 1e-12] = 1.0
    return vectors / norms


def distinct_tops(labels: np.ndarray, scores: np.ndarray, k: int) -> int:
    overall = scores.mean(axis=0)
    spread = scores.std(axis=0)
    spread[spread < 1e-6] = 1.0
    tops: list[int] = []
    for label in range(k):
        member = labels == label
        if not member.any():
            continue
        delta = (scores[member].mean(axis=0) - overall) / spread
        if float(delta.max()) < 0.45:
            continue
        tops.append(int(np.argmax(delta)))
    return len(set(tops))


def choose_k(vectors: np.ndarray, scores: np.ndarray) -> int:
    print("silhouette on the normalized embedding:")
    scored: dict[int, float] = {}
    distinct: dict[int, int] = {}
    for k in range(4, 11):
        labels = KMeans(n_clusters=k, n_init=10, random_state=0).fit_predict(vectors)
        score = float(silhouette_score(vectors, labels, sample_size=800, random_state=0))
        found = distinct_tops(labels, scores, k)
        scored[k] = score
        distinct[k] = found
        print(f"  k={k} silhouette {score:.3f} distinct {found}")
    best = max(scored.values())
    close = [k for k, score in scored.items() if k >= 5 and score >= best - 0.02]
    if not close:
        close = [max(scored, key=scored.get)]
    chosen = max(close, key=lambda k: (distinct[k], scored[k], k))
    print(f"chose k={chosen}")
    return chosen


def name_for(mean: np.ndarray, overall: np.ndarray, spread: np.ndarray) -> tuple[str, str, str | None]:
    delta = (mean - overall) / spread
    order = [int(index) for index in np.argsort(delta)[::-1]]
    ids = list(QUESTIONS)
    phrases = list(QUESTIONS.values())
    strong = [index for index in order if delta[index] >= 0.45 and mean[index] >= 0.3]
    if not strong:
        return "quiet", "Quiet chart", None
    top = strong[0]
    second = next((phrases[index] for index in strong[1:] if index != top), None)
    return ids[top], phrases[top], second


def unique_names(raw: list[tuple[str, str, str | None]]) -> list[tuple[str, str]]:
    counts = Counter(item[0] for item in raw)
    seen: Counter[str] = Counter()
    named: list[tuple[str, str]] = []
    for base_id, label, second in raw:
        if counts[base_id] == 1:
            named.append((base_id, label))
            continue
        seen[base_id] += 1
        if seen[base_id] == 1:
            named.append((base_id, label))
            continue
        suffix = seen[base_id]
        if second:
            named.append((f"{base_id}-{suffix}", f"{label}, {second}"))
        else:
            named.append((f"{base_id}-{suffix}", f"{label} {suffix}"))
    ids = [item[0] for item in named]
    if len(ids) != len(set(ids)):
        raise SystemExit(f"cluster ids collided: {ids}")
    return named


def examples_for(vectors: np.ndarray, member: np.ndarray, charts: list[dict]) -> list[str]:
    indices = np.flatnonzero(member)
    center = vectors[indices].mean(axis=0)
    distance = np.linalg.norm(vectors[indices] - center, axis=1)
    picked: list[str] = []
    for index in indices[np.argsort(distance)]:
        complaint = charts[index]["complaint"].rstrip(".")
        if complaint and complaint.lower() not in {item.lower() for item in picked}:
            picked.append(complaint[0].upper() + complaint[1:])
        if len(picked) == 3:
            break
    return picked


def sample(labels: np.ndarray, findings: dict[int, float]) -> np.ndarray:
    rng = np.random.default_rng(0)
    keep: list[int] = []
    for label in findings:
        members = np.flatnonzero(labels == label)
        cap = QUIET_CAP if findings[label] < 1 else SAMPLE_CAP
        if len(members) > cap:
            members = rng.choice(members, size=cap, replace=False)
        keep.extend(int(index) for index in members)
    return np.array(sorted(keep))


def main() -> None:
    questions = question_list()
    order = [item["id"] for item in questions]
    with workdir() as work:
        embeddings_db = work / EMBEDDINGS_KEY
        answers_db = work / ANSWERS_KEY
        patients_db = work / PATIENTS_KEY
        download(EMBEDDINGS_KEY, embeddings_db)
        download(ANSWERS_KEY, answers_db)
        download(PATIENTS_KEY, patients_db)
        embedding_ids, vectors = load_embeddings(embeddings_db)
        chart_ids, scores, full_scores, charts = load(answers_db, patients_db, order)
    if embedding_ids != chart_ids:
        raise SystemExit("openai embeddings do not cover the same encounters as the charts")

    k = choose_k(vectors, scores)
    model = KMeans(n_clusters=k, n_init=20, random_state=0).fit(vectors)
    labels = model.labels_
    reduced = PCA(n_components=PCA_DIMS, random_state=0).fit_transform(vectors)
    layout = umap.UMAP(
        n_components=2,
        n_neighbors=25,
        min_dist=0.12,
        metric="euclidean",
        random_state=0,
        n_jobs=1,
    ).fit_transform(normalize(reduced))

    overall = scores.mean(axis=0)
    spread = scores.std(axis=0)
    spread[spread < 1e-6] = 1.0
    setting_array = np.array([chart["setting"] for chart in charts])

    raw_names: list[tuple[str, str, str | None]] = []
    stats: list[dict] = []
    for label in range(k):
        member = labels == label
        mean = scores[member].mean(axis=0)
        raw_names.append(name_for(mean, overall, spread))
        counts = Counter(setting_array[member].tolist())
        stats.append(
            {
                "label_index": label,
                "count": int(member.sum()),
                "findings": round(float((scores[member] >= 0.5).sum(axis=1).mean()), 1),
                "settings": {
                    setting: round(counts[setting] / int(member.sum()), 4) for setting in SETTINGS
                },
                "marks": marks_for(mean, overall, spread),
                "examples": examples_for(vectors, member, charts),
            }
        )

    named = unique_names(raw_names)
    findings = {item["label_index"]: item["findings"] for item in stats}
    display = sorted(range(k), key=lambda label: (findings[label], -stats[label]["count"]))
    clusters = []
    for position, label in enumerate(display):
        cluster_id, cluster_label = named[label]
        clusters.append(
            {
                "id": cluster_id,
                "label": cluster_label,
                "count": stats[label]["count"],
                "color": PALETTE[position % len(PALETTE)],
                "findings": stats[label]["findings"],
                "settings": stats[label]["settings"],
                "marks": stats[label]["marks"],
                "examples": stats[label]["examples"],
            }
        )
    remap = {label: index for index, label in enumerate(display)}

    shown = sample(labels, findings)
    points = [
        [
            round(float(layout[row, 0]), 3),
            round(float(layout[row, 1]), 3),
            remap[int(labels[row])],
            chart_ids[row],
        ]
        for row in shown
    ]
    present = set(list_keys(CHART_PREFIX))
    chart_objects = [
        (
            f"{CHART_PREFIX}{chart_ids[row]}.json",
            {
                **charts[row],
                "cluster": remap[int(labels[row])],
                "answers": [round(float(value), 4) for value in full_scores[row]],
            },
        )
        for row in shown
        if f"{CHART_PREFIX}{chart_ids[row]}.json" not in present
    ]
    payload = {
        "charts": len(labels),
        "shown": len(points),
        "scores": DIMS,
        "placement": "a text-embedding-3-large vector of the note",
        "answersPlaceChart": False,
        "presentation": list(QUESTIONS),
        "questions": questions,
        "clusters": clusters,
        "points": points,
    }
    if chart_objects:
        upload_charts(chart_objects)
    with workdir() as work:
        output = work / OUTPUT_KEY
        output.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
        upload(output, OUTPUT_KEY)
    print(f"wrote {len(points)} of {len(labels)} charts, {len(clusters)} clusters")
    for cluster in clusters:
        brief = ", ".join(f"{mark['label']} {mark['mean']:.2f}" for mark in cluster["marks"])
        print(f"  {cluster['label']} ({cluster['count']}): {brief}")


if __name__ == "__main__":
    main()
