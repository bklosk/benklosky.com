#!/usr/bin/env python3
"""Answer every question in public/jevbeddings/questions.json for every encounter note.

One TypeSafe request per encounter. State is the note plus the profile fields
the questions name. Notes come from patient_profiles.db and results go to
jev_answers.db, both in the benklosky-data Space. Re-running skips encounters
that already have a complete answer set.

    uv run --with boto3 python scripts/run_jev_answers.py
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from space import download, upload, workdir

ROOT = Path(__file__).resolve().parents[1]
QUESTIONS_PATH = ROOT / "public" / "jevbeddings" / "questions.json"
PATIENTS_KEY = "patient_profiles.db"
ANSWERS_KEY = "jev_answers.db"
ENDPOINT = "https://api.typesafe.ai/v1/systemone"
MODEL = "jev-1.13.0"
PROFILE_FIELDS = (
    "insurance",
    "race_ethnicity",
    "smoking_status",
    "alcohol_use",
    "occupation",
    "family_history",
    "surgical_history",
)
RETRY_STATUSES = {429, 500, 502, 503, 529}


def load_key() -> str:
    key = os.environ.get("JEV_KEY", "").strip()
    if key:
        return key
    env_path = ROOT / ".env"
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        if name.strip() == "JEV_KEY":
            return value.strip().strip('"').strip("'")
    raise SystemExit("JEV_KEY is not set")


def load_questions() -> dict:
    questions = json.loads(QUESTIONS_PATH.read_text())
    if not isinstance(questions, dict) or not questions:
        raise SystemExit(f"{QUESTIONS_PATH} is not a question map")
    return questions


def open_answers(answers_db: Path, question_ids: list[str]) -> sqlite3.Connection:
    con = sqlite3.connect(answers_db, timeout=60)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS answers (
            encounter_id INTEGER PRIMARY KEY,
            patient_id INTEGER NOT NULL,
            model TEXT NOT NULL,
            input_tokens INTEGER,
            output_tokens INTEGER,
            answers_json TEXT NOT NULL
        )
        """
    )
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
        """
    )
    con.execute(
        "INSERT INTO meta(key, value) VALUES('question_ids', ?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (json.dumps(question_ids),),
    )
    con.commit()
    return con


def pending(patients_db: Path, answers_db: Path, limit: int | None) -> list[tuple]:
    patients = sqlite3.connect(f"file:{patients_db}?mode=ro", uri=True)
    patients.row_factory = sqlite3.Row
    done = {
        row[0]
        for row in sqlite3.connect(answers_db).execute("SELECT encounter_id FROM answers")
    }
    rows = []
    query = """
        SELECT e.encounter_id, e.patient_id, e.note_text, p.profile
        FROM encounters e
        JOIN patients p ON p.patient_id = e.patient_id
        ORDER BY e.encounter_id
    """
    for row in patients.execute(query):
        if row["encounter_id"] in done:
            continue
        rows.append(
            (
                row["encounter_id"],
                row["patient_id"],
                row["note_text"],
                row["profile"],
            )
        )
        if limit is not None and len(rows) >= limit:
            break
    patients.close()
    return rows


def state_for(note: str, profile_json: str) -> dict:
    profile = json.loads(profile_json)
    state = {"note": note}
    for field in PROFILE_FIELDS:
        state[field] = profile.get(field)
    return state


def ask(key: str, questions: dict, state: dict) -> dict:
    body = json.dumps(
        {"model": MODEL, "state": state, "questions": questions}
    ).encode()
    delay = 1.0
    last_error = "no response"
    for attempt in range(8):
        request = urllib.request.Request(
            ENDPOINT,
            data=body,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                return json.loads(response.read().decode())
        except urllib.error.HTTPError as error:
            detail = error.read().decode(errors="replace")[:500]
            last_error = f"HTTP {error.code}: {detail}"
            if error.code not in RETRY_STATUSES or attempt == 7:
                raise RuntimeError(last_error) from error
            retry_after = error.headers.get("Retry-After")
            wait = float(retry_after) if retry_after else delay
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            last_error = str(error)
            if attempt == 7:
                raise RuntimeError(last_error) from error
            wait = delay
        time.sleep(wait)
        delay = min(delay * 2, 30)
    raise RuntimeError(last_error)


def probabilities(payload: dict, question_ids: list[str]) -> dict[str, float]:
    answers = payload.get("answers")
    if not isinstance(answers, dict):
        raise RuntimeError("response has no answers object")
    missing = [qid for qid in question_ids if qid not in answers]
    if missing:
        raise RuntimeError(f"missing {len(missing)} answers, first {missing[0]}")
    out = {}
    for qid in question_ids:
        value = answers[qid].get("noul")
        if not isinstance(value, (int, float)):
            raise RuntimeError(f"{qid} has no noul probability")
        out[qid] = float(value)
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--workers", type=int, default=24)
    args = parser.parse_args()

    key = load_key()
    questions = load_questions()
    question_ids = list(questions)
    with workdir() as work:
        patients_db = work / PATIENTS_KEY
        answers_db = work / ANSWERS_KEY
        download(PATIENTS_KEY, patients_db)
        download(ANSWERS_KEY, answers_db, required=False)
        answers = open_answers(answers_db, question_ids)
        try:
            rows = pending(patients_db, answers_db, args.limit)
            failed = answer_all(key, questions, answers, rows, args.workers)
        finally:
            answers.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            answers.close()
            upload(answers_db, ANSWERS_KEY)
    if failed:
        raise SystemExit(1)


def answer_all(
    key: str,
    questions: dict,
    answers: sqlite3.Connection,
    rows: list[tuple],
    workers: int,
) -> int:
    question_ids = list(questions)
    total = len(rows)
    print(f"pending {total} encounters, {len(question_ids)} questions, workers {workers}", flush=True)
    if total == 0:
        return 0

    lock = threading.Lock()
    done = 0
    failed = 0
    tokens_in = 0
    started = time.time()

    def work(row: tuple) -> tuple:
        encounter_id, patient_id, note, profile = row
        payload = ask(key, questions, state_for(note, profile))
        probs = probabilities(payload, question_ids)
        usage = payload.get("usage") or {}
        return (
            encounter_id,
            patient_id,
            payload.get("model") or MODEL,
            usage.get("input_tokens"),
            usage.get("output_tokens"),
            json.dumps(probs, separators=(",", ":")),
        )

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(work, row) for row in rows]
        for future in as_completed(futures):
            try:
                record = future.result()
            except Exception as error:
                failed += 1
                print(f"fail {failed}: {error}", flush=True)
                continue
            with lock:
                answers.execute(
                    "INSERT OR REPLACE INTO answers VALUES (?, ?, ?, ?, ?, ?)",
                    record,
                )
                answers.commit()
                done += 1
                if record[3]:
                    tokens_in += int(record[3])
                if done % 50 == 0 or done == total:
                    elapsed = time.time() - started
                    rate = done / elapsed if elapsed else 0
                    print(
                        f"saved {done}/{total} failed {failed} "
                        f"{rate:.1f}/s tokens_in {tokens_in}",
                        flush=True,
                    )

    elapsed = time.time() - started
    print(
        f"finished saved {done} failed {failed} in {elapsed:.0f}s tokens_in {tokens_in}",
        flush=True,
    )
    return failed


if __name__ == "__main__":
    main()
