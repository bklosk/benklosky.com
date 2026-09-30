#!/usr/bin/env python3
"""Cluster patient embeddings and project them with UMAP.

Reads patient_embeddings.db from the benklosky-data Space. Each row is one patient and 125 chart-averaged
scores. Scores stay on their 0–1 scale: they are already probabilities, and
standardizing them dissolves the groups.

k-means is fit in that 125-d space. Silhouette there prefers a coarse split in
two: older, retired, Medicare patients against everyone else. From three groups
upward it peaks at five, and those five land on separate regions of the UMAP.
A diagonal Gaussian mixture does not separate them, and HDBSCAN marks nearly
every patient as noise. The UMAP is only the picture; the colors come from the
k-means labels.

Uploads clusters.json to the same Space, where the embeddings page reads it.

    uv run --python 3.12 --with numpy --with scikit-learn --with umap-learn \
        --with boto3 python scripts/build_patient_clusters.py
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import numpy as np
import umap
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

from space import download, upload, workdir

EMBEDDINGS_KEY = "patient_embeddings.db"
OUTPUT_KEY = "clusters.json"
K = 5

PHRASES = {
    "insurance_medicaid": "Medicaid",
    "insurance_private": "Private insurance",
    "insurance_medicare": "Medicare",
    "insurance_through_parent": "Parent's insurance",
    "insurance_student_plan": "Student health plan",
    "injection_drug_use": "Injection drug use",
    "hiv": "HIV",
    "functionally_dependent": "Functionally dependent",
    "is_retired": "Retired",
    "note_age_65_or_older": "Age 65 or older",
    "former_smoker": "Former smoker",
    "is_student": "Student",
    "note_age_under_18": "Under 18",
    "multimorbidity": "Several chronic conditions",
    "note_describes_female": "Described as female",
    "works_with_children": "Works with children",
    "pregnant_currently": "Pregnant",
    "manual_labor_job": "Manual labor",
    "drinks_alcohol": "Drinks alcohol",
}

# Matched in this order. The first hit names the cluster.
IDENTITIES = (
    ("students", "Children and students", "#1f6b4a", lambda mean: mean["is_student"] >= 0.6),
    ("older", "Older adults", "#d06a2b", lambda mean: mean["insurance_medicare"] >= 0.7),
    ("medicaid", "Medicaid", "#8d6a1f", lambda mean: mean["insurance_medicaid"] >= 0.7),
    ("women", "Women", "#9b3d68", lambda mean: mean["note_describes_female"] >= 0.7),
    ("men", "Men", "#2c5d8f", lambda mean: mean["note_describes_female"] <= 0.15),
)
DISPLAY_ORDER = ("students", "women", "men", "medicaid", "older")


def load(embeddings_db: Path) -> tuple[list[str], list[int], np.ndarray]:
    con = sqlite3.connect(f"file:{embeddings_db}?mode=ro", uri=True)
    question_ids = json.loads(
        con.execute("SELECT value FROM meta WHERE key = 'question_ids'").fetchone()[0]
    )
    rows = con.execute(
        "SELECT patient_id, scores_json FROM embeddings ORDER BY patient_id"
    ).fetchall()
    con.close()
    patient_ids = [row[0] for row in rows]
    scores = np.array([json.loads(row[1]) for row in rows], dtype=np.float64)
    if scores.shape[1] != len(question_ids):
        raise SystemExit(f"expected {len(question_ids)} scores, got {scores.shape[1]}")
    return question_ids, patient_ids, scores


def choose_k(scores: np.ndarray) -> None:
    print("silhouette on the 125 scores:")
    finer: dict[int, float] = {}
    for k in range(2, 9):
        labels = KMeans(n_clusters=k, n_init=20, random_state=0).fit_predict(scores)
        score = float(silhouette_score(scores, labels))
        print(f"  k={k} {score:.3f}")
        if k >= 3:
            finer[k] = score
    best_k = max(finer, key=finer.get)
    if best_k != K:
        raise SystemExit(f"silhouette for k>=3 now peaks at k={best_k}, not {K}")


def identity_for(question_ids: list[str], mean: np.ndarray) -> tuple[str, str, str]:
    lookup = dict(zip(question_ids, mean))
    hits = [item for item in IDENTITIES if item[3](lookup)]
    if len(hits) != 1:
        raise SystemExit(f"cluster matched {len(hits)} identities")
    cluster_id, label, color, _match = hits[0]
    return cluster_id, label, color


def marks_for(
    question_ids: list[str],
    mean: np.ndarray,
    overall: np.ndarray,
    spread: np.ndarray,
) -> list[dict[str, float | str]]:
    delta = (mean - overall) / spread
    order = np.argsort(np.abs(delta))[::-1]
    chosen = [int(index) for index in order if abs(delta[index]) >= 0.5][:4]
    if len(chosen) < 3:
        chosen = [int(index) for index in order[:4]]
    marks = []
    for index in chosen:
        question_id = question_ids[index]
        phrase = PHRASES.get(question_id)
        if phrase is None:
            raise SystemExit(f"no phrase for {question_id}")
        marks.append(
            {
                "label": phrase,
                "mean": round(float(mean[index]), 4),
                "overall": round(float(overall[index]), 4),
            }
        )
    return marks


def main() -> None:
    with workdir() as work:
        embeddings_db = work / EMBEDDINGS_KEY
        download(EMBEDDINGS_KEY, embeddings_db)
        question_ids, _patient_ids, scores = load(embeddings_db)
    choose_k(scores)
    labels = KMeans(n_clusters=K, n_init=20, random_state=0).fit_predict(scores)
    layout = umap.UMAP(
        n_components=2,
        n_neighbors=25,
        min_dist=0.12,
        metric="euclidean",
        random_state=0,
        n_jobs=1,
    ).fit_transform(scores)

    overall = scores.mean(axis=0)
    spread = scores.std(axis=0)
    spread[spread < 1e-6] = 1.0

    by_label: dict[int, dict] = {}
    for label in range(K):
        member = labels == label
        mean = scores[member].mean(axis=0)
        cluster_id, name, color = identity_for(question_ids, mean)
        by_label[label] = {
            "id": cluster_id,
            "label": name,
            "count": int(member.sum()),
            "color": color,
            "marks": marks_for(question_ids, mean, overall, spread),
        }

    order = sorted(by_label, key=lambda label: DISPLAY_ORDER.index(by_label[label]["id"]))
    remap = {label: index for index, label in enumerate(order)}
    clusters = [by_label[label] for label in order]
    if [cluster["id"] for cluster in clusters] != list(DISPLAY_ORDER):
        raise SystemExit("missing a cluster identity")

    points = [
        [round(float(layout[row, 0]), 3), round(float(layout[row, 1]), 3), remap[int(labels[row])]]
        for row in range(len(labels))
    ]
    payload = {
        "patients": len(points),
        "scores": len(question_ids),
        "clusters": clusters,
        "points": points,
    }
    with workdir() as work:
        output = work / OUTPUT_KEY
        output.write_text(json.dumps(payload, indent=2) + "\n")
        upload(output, OUTPUT_KEY)
    print(f"wrote {len(points)} patients, {len(clusters)} clusters")
    for cluster in clusters:
        brief = ", ".join(f"{mark['label']} {mark['mean']:.2f}" for mark in cluster["marks"])
        print(f"  {cluster['label']} ({cluster['count']}): {brief}")


if __name__ == "__main__":
    main()
