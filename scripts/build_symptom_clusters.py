#!/usr/bin/env python3
"""Cluster charts by how the patient presented, and project them with UMAP.

Reads jev_answers.db and patient_profiles.db from the benklosky-data Space.
Each chart keeps only the scores that describe the current presentation:
reported symptoms, suspected infection site, vital signs, exam, labs, and
imaging. Demographics, insurance, occupation, social and family history,
chronic conditions, and note quality are left out, so the groups are
syndromes rather than kinds of people.

Silhouette is flat from k=3 to k=12, so it does not choose k. Ten groups is
where every cluster reads as a distinct presentation; fewer merge pneumonia,
urinary infection, and shock into broader fever and distress groups.

Clusters and the UMAP are fit on every chart, but the map only draws a
sample: up to SAMPLE_CAP charts per cluster, so small groups stay visible
and the page stays fast. Each sampled chart also gets its own object under
symptom_charts/ with the note and all 125 answers, which the page fetches
when a dot is clicked.

Uploads symptom_clusters.json and symptom_charts/<encounter_id>.json to the
same Space, where the embeddings page reads them.

    uv run --python 3.12 --with numpy --with scikit-learn --with umap-learn \
        --with boto3 python scripts/build_symptom_clusters.py
"""

from __future__ import annotations

import json
import sqlite3
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import umap
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

from space import download, upload, workdir

ROOT = Path(__file__).resolve().parents[1]
QUESTIONS_PATH = ROOT / "public" / "jevbeddings" / "questions.json"
LABELS_PATH = Path(__file__).resolve().parent / "question_labels.json"
ANSWERS_KEY = "jev_answers.db"
PATIENTS_KEY = "patient_profiles.db"
OUTPUT_KEY = "symptom_clusters.json"
CHART_PREFIX = "symptom_charts/"
K = 10
SAMPLE_CAP = {"quiet": 450, "onset": 180}
DEFAULT_CAP = 150

QUESTIONS = {
    "reported_fever": "Reported fever",
    "reported_chills": "Chills",
    "reported_rigors": "Rigors",
    "new_confusion": "New confusion",
    "new_lethargy": "New lethargy",
    "decreased_responsiveness": "Less responsive",
    "acute_onset": "Began in the last 3 days",
    "vomiting": "Vomiting",
    "decreased_oral_intake": "Eating or drinking less",
    "decreased_urine_output": "Less urine",
    "suspected_urinary_infection": "Suspected urinary infection",
    "suspected_respiratory_infection": "Suspected lung infection",
    "suspected_skin_infection": "Suspected skin infection",
    "suspected_wound_infection": "Suspected wound infection",
    "suspected_abdominal_infection": "Suspected abdominal infection",
    "measured_fever": "Temperature over 38 °C",
    "hypothermia": "Temperature under 36 °C",
    "tachycardia": "Heart rate over 90",
    "tachypnea": "Breathing 22 or more a minute",
    "low_systolic_bp": "Systolic pressure 100 or lower",
    "low_oxygen_saturation": "Oxygen under 92%",
    "supplemental_oxygen": "On oxygen",
    "mechanical_ventilation": "On a ventilator",
    "ill_appearing": "Ill-appearing",
    "acute_distress": "In acute distress",
    "diaphoresis": "Sweating heavily",
    "mottled_skin": "Mottled skin",
    "cool_extremities": "Cool hands or feet",
    "delayed_capillary_refill": "Slow capillary refill",
    "skin_erythema": "Red skin",
    "purulent_drainage": "Pus",
    "cva_tenderness": "Flank tenderness",
    "lung_crackles": "Crackles in the lungs",
    "abdominal_guarding": "Abdominal guarding",
    "rebound_tenderness": "Rebound tenderness",
    "joint_swelling": "Swollen joint",
    "leukocytosis": "White count over 12,000",
    "leukopenia": "White count under 4,000",
    "bandemia": "Bands over 10%",
    "neutropenia": "Neutrophils under 1,500",
    "elevated_creatinine": "High creatinine",
    "low_platelets": "Low platelets",
    "elevated_bilirubin": "High bilirubin",
    "elevated_ast": "High AST",
    "elevated_alt": "High ALT",
    "elevated_alkaline_phosphatase": "High alkaline phosphatase",
    "low_bicarbonate": "Low bicarbonate",
    "elevated_anion_gap": "High anion gap",
    "high_glucose": "Glucose over 250",
    "positive_nitrites": "Urine nitrites",
    "positive_leukocyte_esterase": "Urine leukocyte esterase",
    "pyuria": "White cells in urine",
    "bacteriuria": "Bacteria in urine",
    "pulmonary_infiltrate": "Infiltrate on chest imaging",
    "abscess_on_imaging": "Abscess on imaging",
    "empyema": "Empyema",
    "free_air": "Free air in the abdomen",
}

# Matched in this order. The first hit names the cluster.
IDENTITIES = (
    ("urinary", "Urinary infection", "#9b3d68", lambda m: m["pyuria"] > 0.6),
    ("pneumonia", "Pneumonia", "#2a9d8f", lambda m: m["pulmonary_infiltrate"] > 0.5),
    ("liver", "Liver labs", "#1f6b4a", lambda m: m["elevated_ast"] > 0.6),
    ("shock", "Septic shock", "#b08a1f",
     lambda m: m["measured_fever"] > 0.6 and m["low_systolic_bp"] > 0.4),
    ("fever", "Fever, local infection", "#c23b3b", lambda m: m["measured_fever"] > 0.6),
    ("mental", "Altered mental status", "#7a3f9b", lambda m: m["decreased_responsiveness"] > 0.6),
    ("breathing", "Respiratory distress", "#2c5d8f", lambda m: m["tachypnea"] > 0.8),
    ("tachycardia", "Tachycardia", "#d06a2b", lambda m: m["tachycardia"] > 0.8),
    ("onset", "Acute onset, few findings", "#8d8d8d", lambda m: m["acute_onset"] > 0.6),
    ("quiet", "Quiet chart", "#c9c6bf", lambda m: True),
)
DISPLAY_ORDER = (
    "quiet", "onset", "tachycardia", "breathing", "mental",
    "fever", "pneumonia", "urinary", "shock", "liver",
)
SETTINGS = ("outpatient", "ed", "inpatient", "icu")


def question_list() -> list[dict[str, str]]:
    order = list(json.loads(QUESTIONS_PATH.read_text()))
    labels = json.loads(LABELS_PATH.read_text())
    if [item["id"] for item in labels] != order:
        raise SystemExit("question_labels.json does not match questions.json")
    if any(qid not in order for qid in QUESTIONS):
        raise SystemExit("a presentation question is missing from questions.json")
    return labels


def load(
    answers_db: Path, patients_db: Path, order: list[str]
) -> tuple[list[int], np.ndarray, np.ndarray, list[dict]]:
    con = sqlite3.connect(f"file:{answers_db}?mode=ro", uri=True)
    rows = con.execute(
        "SELECT encounter_id, answers_json FROM answers ORDER BY encounter_id"
    ).fetchall()
    con.close()
    con = sqlite3.connect(f"file:{patients_db}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    meta = {
        row["encounter_id"]: row
        for row in con.execute(
            "SELECT encounter_id, encounter_type, department, encounter_date, chief_complaint, note_text "
            "FROM encounters"
        )
    }

    ids, full, charts = [], [], []
    for encounter_id, answers_json in rows:
        answers = json.loads(answers_json)
        missing = [qid for qid in order if qid not in answers]
        if missing:
            raise SystemExit(f"chart {encounter_id} is missing {missing[0]}")
        row = meta[encounter_id]
        ids.append(int(encounter_id))
        full.append([float(answers[qid]) for qid in order])
        charts.append(
            {
                "id": int(encounter_id),
                "setting": row["encounter_type"],
                "department": row["department"],
                "date": row["encounter_date"],
                "complaint": (row["chief_complaint"] or "").strip(),
                "note": row["note_text"] or "",
            }
        )
    con.close()
    full_scores = np.array(full, dtype=np.float64)
    columns = [order.index(qid) for qid in QUESTIONS]
    return ids, full_scores[:, columns], full_scores, charts


def sample(labels: np.ndarray, cluster_ids: dict[int, str]) -> np.ndarray:
    rng = np.random.default_rng(0)
    keep = []
    for label, cluster_id in cluster_ids.items():
        members = np.flatnonzero(labels == label)
        cap = SAMPLE_CAP.get(cluster_id, DEFAULT_CAP)
        if len(members) > cap:
            members = rng.choice(members, size=cap, replace=False)
        keep.extend(int(index) for index in members)
    return np.array(sorted(keep))


def upload_charts(rows: list[tuple[str, dict]]) -> None:
    with workdir() as work:
        def put(item: tuple[str, dict]) -> None:
            key, body = item
            path = work / key.replace("/", "_")
            path.write_text(json.dumps(body, separators=(",", ":")))
            upload(path, key)

        with ThreadPoolExecutor(max_workers=16) as pool:
            list(pool.map(put, rows))


def report_k(scores: np.ndarray) -> None:
    print("silhouette on the presentation scores:")
    for k in range(3, 13):
        labels = KMeans(n_clusters=k, n_init=20, random_state=0).fit_predict(scores)
        score = silhouette_score(scores, labels, sample_size=3000, random_state=0)
        print(f"  k={k} {score:.3f}")


def identity_for(mean: np.ndarray) -> tuple[str, str, str]:
    lookup = dict(zip(QUESTIONS, mean))
    for cluster_id, label, color, match in IDENTITIES:
        if match(lookup):
            return cluster_id, label, color
    raise SystemExit("cluster matched no identity")


def marks_for(mean: np.ndarray, overall: np.ndarray, spread: np.ndarray) -> list[dict]:
    delta = (mean - overall) / spread
    chosen = [int(index) for index in np.argsort(delta)[::-1] if delta[index] >= 0.5][:5]
    labels = list(QUESTIONS.values())
    return [
        {
            "label": labels[index],
            "mean": round(float(mean[index]), 4),
            "overall": round(float(overall[index]), 4),
        }
        for index in chosen
    ]


def examples_for(
    scores: np.ndarray, member: np.ndarray, center: np.ndarray, charts: list[dict]
) -> list[str]:
    indices = np.flatnonzero(member)
    distance = np.linalg.norm(scores[indices] - center, axis=1)
    picked: list[str] = []
    for index in indices[np.argsort(distance)]:
        complaint = charts[index]["complaint"].rstrip(".")
        if complaint and complaint.lower() not in {c.lower() for c in picked}:
            picked.append(complaint[0].upper() + complaint[1:])
        if len(picked) == 3:
            break
    return picked


def main() -> None:
    questions = question_list()
    order = [item["id"] for item in questions]
    with workdir() as work:
        answers_db = work / ANSWERS_KEY
        patients_db = work / PATIENTS_KEY
        download(ANSWERS_KEY, answers_db)
        download(PATIENTS_KEY, patients_db)
        ids, scores, full_scores, charts = load(answers_db, patients_db, order)
    settings = [chart["setting"] for chart in charts]

    report_k(scores)
    model = KMeans(n_clusters=K, n_init=20, random_state=0).fit(scores)
    labels = model.labels_
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
    setting_array = np.array(settings)

    by_label: dict[int, dict] = {}
    for label in range(K):
        member = labels == label
        mean = scores[member].mean(axis=0)
        cluster_id, name, color = identity_for(mean)
        counts = Counter(setting_array[member].tolist())
        by_label[label] = {
            "id": cluster_id,
            "label": name,
            "count": int(member.sum()),
            "color": color,
            "findings": round(float((scores[member] >= 0.5).sum(axis=1).mean()), 1),
            "settings": {
                setting: round(counts[setting] / int(member.sum()), 4) for setting in SETTINGS
            },
            "marks": marks_for(mean, overall, spread),
            "examples": examples_for(scores, member, model.cluster_centers_[label], charts),
        }

    cluster_ids = {label: cluster["id"] for label, cluster in by_label.items()}
    if sorted(cluster_ids.values()) != sorted(DISPLAY_ORDER):
        raise SystemExit(f"cluster identities changed: {sorted(cluster_ids.values())}")
    display = sorted(by_label, key=lambda label: DISPLAY_ORDER.index(by_label[label]["id"]))
    remap = {label: index for index, label in enumerate(display)}
    clusters = [by_label[label] for label in display]

    shown = sample(labels, cluster_ids)
    points = [
        [
            round(float(layout[row, 0]), 3),
            round(float(layout[row, 1]), 3),
            remap[int(labels[row])],
            ids[row],
        ]
        for row in shown
    ]
    chart_objects = [
        (
            f"{CHART_PREFIX}{ids[row]}.json",
            {
                **charts[row],
                "cluster": remap[int(labels[row])],
                "answers": [round(float(value), 4) for value in full_scores[row]],
            },
        )
        for row in shown
    ]
    payload = {
        "charts": len(labels),
        "shown": len(points),
        "scores": len(QUESTIONS),
        "presentation": list(QUESTIONS),
        "questions": questions,
        "clusters": clusters,
        "points": points,
    }
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
