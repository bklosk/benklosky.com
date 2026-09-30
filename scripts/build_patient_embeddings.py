#!/usr/bin/env python3
"""Average each patient's chart scores into one embedding.

A chart is an encounter in jev_answers.db. For patient p with charts
x_1 .. x_n and question i,

    p_i = avg(x_1i, ..., x_ni)

Question order matches public/jevbeddings/questions.json. The result is one
row per patient in patient_embeddings.db. Both databases live in the
benklosky-data Space.

    uv run --with boto3 python scripts/build_patient_embeddings.py
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from space import download, upload, workdir

ROOT = Path(__file__).resolve().parents[1]
ANSWERS_KEY = "jev_answers.db"
EMBEDDINGS_KEY = "patient_embeddings.db"
QUESTIONS_PATH = ROOT / "public" / "jevbeddings" / "questions.json"


def question_ids(answers_db: Path) -> list[str]:
    questions = json.loads(QUESTIONS_PATH.read_text())
    stored = json.loads(
        sqlite3.connect(f"file:{answers_db}?mode=ro", uri=True)
        .execute("SELECT value FROM meta WHERE key = 'question_ids'")
        .fetchone()[0]
    )
    if stored != list(questions):
        raise SystemExit("question order in jev_answers.db does not match questions.json")
    return stored


def embeddings(answers_db: Path, question_ids: list[str]) -> list[tuple[int, int, list[float]]]:
    width = len(question_ids)
    totals: dict[int, list[float]] = {}
    counts: dict[int, int] = {}
    con = sqlite3.connect(f"file:{answers_db}?mode=ro", uri=True)
    for patient_id, answers_json in con.execute(
        "SELECT patient_id, answers_json FROM answers"
    ):
        answers = json.loads(answers_json)
        if list(answers) != question_ids:
            raise SystemExit(f"patient {patient_id} chart is missing questions")
        bucket = totals.get(patient_id)
        if bucket is None:
            bucket = [0.0] * width
            totals[patient_id] = bucket
            counts[patient_id] = 0
        for index, qid in enumerate(question_ids):
            bucket[index] += float(answers[qid])
        counts[patient_id] += 1
    con.close()

    rows = []
    for patient_id in sorted(totals):
        n_charts = counts[patient_id]
        scores = [total / n_charts for total in totals[patient_id]]
        rows.append((patient_id, n_charts, scores))
    return rows


def write(
    embeddings_db: Path,
    question_ids: list[str],
    rows: list[tuple[int, int, list[float]]],
) -> None:
    con = sqlite3.connect(embeddings_db)
    con.execute(
        """
        CREATE TABLE embeddings (
            patient_id INTEGER PRIMARY KEY,
            n_charts INTEGER NOT NULL,
            scores_json TEXT NOT NULL
        )
        """
    )
    con.execute(
        """
        CREATE TABLE meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        """
    )
    con.executemany(
        "INSERT INTO meta(key, value) VALUES (?, ?)",
        [
            ("question_ids", json.dumps(question_ids)),
            ("source", ANSWERS_KEY),
            ("aggregation", "mean of chart noul scores"),
        ],
    )
    con.executemany(
        "INSERT INTO embeddings(patient_id, n_charts, scores_json) VALUES (?, ?, ?)",
        (
            (patient_id, n_charts, json.dumps(scores, separators=(",", ":")))
            for patient_id, n_charts, scores in rows
        ),
    )
    con.commit()
    con.close()


def main() -> None:
    with workdir() as work:
        answers_db = work / ANSWERS_KEY
        embeddings_db = work / EMBEDDINGS_KEY
        download(ANSWERS_KEY, answers_db)
        ids = question_ids(answers_db)
        rows = embeddings(answers_db, ids)
        if not rows:
            raise SystemExit(f"no charts in {ANSWERS_KEY}")
        width = len(rows[0][2])
        if any(len(scores) != width for _, _, scores in rows):
            raise SystemExit("embedding width is not uniform")
        write(embeddings_db, ids, rows)
        upload(embeddings_db, EMBEDDINGS_KEY)
    print(f"wrote {len(rows)} patients x {width} scores", flush=True)


if __name__ == "__main__":
    main()
