#!/usr/bin/env python3
"""Cluster chart notes in OpenAI text-embedding-3-large space, then draw a UMAP.

Reads openai_embeddings.db, jev_answers.db, and patient_profiles.db from the
[REDACTED] Space. k-means runs on the L2-normalized 3072-d vectors, so distance
is the cosine distance the model was trained for. The UMAP is only the picture:
it is fit on the first 50 principal components of those vectors. Colors come
from the k-means labels.

Silhouette on this space is nearly flat, and it edges up through k=10. Ten
groups is where each cluster matches one clinical identity: children,
pregnancy, heart disease, lung infection, and the rest. Names come from the
Jev score or the department that sets a cluster apart. The scores drawn beside
a group are the Jev answers that rise inside it, including demographics and
history, not only the acute presentation items.

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
K = 10
SAMPLE_CAP = 160
QUIET_CAP = 450
SKIP_MARK_GROUPS = {"Note quality", "Demographics and coverage"}

# Matched in this order. The first hit names the cluster. Thresholds are the
# gaps that showed up at k=10: one cluster clears each bar, and the rest do not.
IDENTITIES = (
    ("children", "Children", "#1f6b4a", lambda m, d: m["note_age_under_18"] >= 0.5),
    ("pregnancy", "Pregnancy", "#9b3d68", lambda m, d: m["pregnant_currently"] >= 0.3),
    ("lung", "Lung infection", "#2a9d8f", lambda m, d: m["suspected_respiratory_infection"] >= 0.25),
    ("heart", "Heart disease", "#c23b3b", lambda m, d: m["family_history_heart_disease"] >= 0.6),
    ("abdomen", "Abdominal and liver", "#b08a1f", lambda m, d: m["elevated_bilirubin"] >= 0.15),
    ("neurologic", "Neurologic", "#7a3f9b", lambda m, d: d.get("Neurology", 0) >= 0.25),
    ("psychiatric", "Psychiatric", "#3d4a7a", lambda m, d: d.get("Psychiatry", 0) >= 0.2),
    ("skin", "Skin and joint", "#d06a2b", lambda m, d: m["skin_erythema"] >= 0.2),
    ("urinary", "Urinary", "#2c5d8f", lambda m, d: m["cva_tenderness"] >= 0.1),
    ("clinic", "Routine clinic", "#c9c6bf", lambda m, d: True),
)
DISPLAY_ORDER = (
    "clinic",
    "children",
    "pregnancy",
    "skin",
    "heart",
    "neurologic",
    "psychiatric",
    "urinary",
    "abdomen",
    "lung",
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
    if chosen != K:
        raise SystemExit(f"silhouette now prefers k={chosen}, not {K}")
    return chosen


def identity_for(lookup: dict[str, float], departments: dict[str, float]) -> tuple[str, str, str]:
    hits = [item for item in IDENTITIES if item[3](lookup, departments)]
    specific = [item for item in hits if item[0] != "clinic"]
    if len(specific) > 1:
        raise SystemExit(f"cluster matched {[item[0] for item in specific]}")
    chosen = specific[0] if specific else hits[0]
    return chosen[0], chosen[1], chosen[2]


def marks_for(
    questions: list[dict[str, str]],
    mean: np.ndarray,
    overall: np.ndarray,
    spread: np.ndarray,
) -> list[dict]:
    delta = (mean - overall) / spread
    ranked = [int(index) for index in np.argsort(delta)[::-1]]

    def qualifies(index: int) -> bool:
        return bool(delta[index] >= 0.4 and mean[index] - overall[index] >= 0.08)

    # Age and coverage clear this bar only for children. Weaker demographic
    # gaps, such as sex in the routine clinic, stay out of the list.
    demographic = [
        index
        for index in ranked
        if questions[index]["group"] == "Demographics and coverage" and delta[index] >= 1.2
    ]
    clinical = [
        index
        for index in ranked
        if questions[index]["group"] not in SKIP_MARK_GROUPS and qualifies(index)
    ]
    chosen = (demographic + clinical)[:5]
    if len(chosen) < 3:
        filler = [
            index
            for index in ranked
            if questions[index]["group"] not in SKIP_MARK_GROUPS and index not in chosen
        ]
        chosen = (chosen + filler)[:4]
    return [
        {
            "label": questions[index]["label"],
            "mean": round(float(mean[index]), 4),
            "overall": round(float(overall[index]), 4),
        }
        for index in chosen
    ]


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

    overall = full_scores.mean(axis=0)
    spread = full_scores.std(axis=0)
    spread[spread < 1e-6] = 1.0
    setting_array = np.array([chart["setting"] for chart in charts])

    by_label: dict[int, dict] = {}
    for label in range(k):
        member = labels == label
        count = int(member.sum())
        mean = full_scores[member].mean(axis=0)
        lookup = dict(zip(order, mean, strict=True))
        departments = Counter(charts[index]["department"] for index in np.flatnonzero(member))
        department_share = {name: value / count for name, value in departments.items()}
        cluster_id, cluster_label, color = identity_for(lookup, department_share)
        setting_counts = Counter(setting_array[member].tolist())
        by_label[label] = {
            "id": cluster_id,
            "label": cluster_label,
            "count": count,
            "color": color,
            "findings": round(float((scores[member] >= 0.5).sum(axis=1).mean()), 1),
            "settings": {
                setting: round(setting_counts[setting] / count, 4) for setting in SETTINGS
            },
            "marks": marks_for(questions, mean, overall, spread),
            "examples": examples_for(vectors, member, charts),
        }

    if sorted(cluster["id"] for cluster in by_label.values()) != sorted(DISPLAY_ORDER):
        raise SystemExit(
            f"cluster identities changed: {sorted(cluster['id'] for cluster in by_label.values())}"
        )
    display = sorted(by_label, key=lambda label: DISPLAY_ORDER.index(by_label[label]["id"]))
    clusters = [by_label[label] for label in display]
    remap = {label: index for index, label in enumerate(display)}
    findings = {label: by_label[label]["findings"] for label in by_label}

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
