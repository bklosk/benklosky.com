#!/usr/bin/env python3
"""Answer every bank question for every item, caching each answer forever.

Answers live in taste/cache/answers.db in the Space, one row per (provider,
model, item, question). A row is reused only when the question spec and the
item input both hash the same, so editing one question re-asks just that
question, and nothing is paid for twice. The database is uploaded every few
minutes and on exit, so an interrupted run resumes where it stopped.

Providers:
  decisions  OpenAI Decisions API (gpt-6-luna). Text and images. OPENAI_API_KEY.
  jev        TypeSafe Jev. Text only. JEV_KEY.

    uv run --python 3.12 --with boto3 python scripts/taste/answer.py --domain movies --limit 30
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import random
import sqlite3
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from common import fetch, key, load_questions, load_secret, read_json, upload, workdir

CACHE_KEY = key("cache", "answers.db")
RETRY_STATUSES = {408, 409, 429, 500, 502, 503, 504, 529}
UPLOAD_EVERY = 300  # seconds

PROVIDERS = {
    "decisions": {
        "endpoint": "https://api.openai.com/v1/decisions",
        "model": "gpt-6-luna",
        "secret": "OPENAI_API_KEY",
        "usd_per_m_input": 0.10,
        "images": True,
    },
    "jev": {
        "endpoint": "https://api.typesafe.ai/v1/systemone",
        "model": "jev-1.13.0",
        "secret": "JEV_KEY",
        "usd_per_m_input": 0.042,
        "images": False,
    },
}

PREAMBLE = {
    "movies": (
        "Describe this film for a taste-profiling app. Use the metadata below together with "
        "what you know about the film. When the metadata doesn't settle a question, give your "
        "best estimate of how a typical viewer would experience the film."
    ),
    "books": (
        "Describe this book for a taste-profiling app. Use the metadata below together with "
        "what you know about the book. When the metadata doesn't settle a question, give your "
        "best estimate of how a typical reader would experience the book."
    ),
    "art": (
        "Describe this artwork for a taste-profiling app. Look at the image and use the "
        "museum metadata below together with what you know about the work. When neither "
        "settles a question, give your best estimate of how a typical museum visitor would "
        "experience the work."
    ),
}


def digest(value) -> str:
    raw = value if isinstance(value, bytes) else json.dumps(value, sort_keys=True).encode()
    return hashlib.sha256(raw).hexdigest()[:16]


def options(question: dict) -> list[str]:
    if question["type"] == "score":
        return [level["label"] for level in question["levels"]]
    return [choice["value"] for choice in question["choices"]]


# Request builders. Each returns (body, parse) where parse(response) gives
# {question_id: [probability per option, in bank order]}.


def decisions_request(model: str, text: str, image: bytes | None, questions: list[dict]):
    content = [{"type": "input_text", "text": text}]
    if image:
        content.append(
            {"type": "input_image", "image_url": "data:image/jpeg;base64," + base64.b64encode(image).decode()}
        )
    specs = []
    for q in questions:
        if q["type"] == "score":
            specs.append(
                {
                    "type": "score",
                    "name": q["id"],
                    "instructions": q["instructions"],
                    "levels": [{"label": l["label"], "description": l["description"]} for l in q["levels"]],
                }
            )
        else:
            specs.append(
                {
                    "type": "choice",
                    "name": q["id"],
                    "instructions": q["instructions"],
                    "choices": [{"value": c["value"], "description": c["description"]} for c in q["choices"]],
                }
            )
    body = {"model": model, "input": [{"role": "user", "content": content}], "questions": specs}

    def parse(response: dict) -> dict[str, list[float]]:
        by_name = {a.get("name"): a for a in response.get("answers", [])}
        out = {}
        for q in questions:
            answer = by_name.get(q["id"])
            if not answer or answer.get("type") == "refusal" or "probabilities" not in answer:
                continue
            probs = answer["probabilities"]
            if q["type"] == "score":
                labels = options(q)
                values = [0.0] * len(labels)
                for i, entry in enumerate(probs):
                    j = labels.index(entry["label"]) if entry.get("label") in labels else int(entry.get("value", i))
                    values[j] = float(entry["probability"])
            else:
                lookup = {entry["value"]: float(entry["probability"]) for entry in probs}
                values = [lookup.get(v, 0.0) for v in options(q)]
            out[q["id"]] = values
        return out

    return body, parse


def jev_request(model: str, text: str, image: bytes | None, questions: list[dict]):
    if image:
        raise ValueError("jev is text-only")
    specs = {}
    for q in questions:
        if q["type"] == "score":
            criteria = [f"{l['label']}: {l['description']}" for l in q["levels"]]
        else:
            criteria = {c["value"]: c["description"] for c in q["choices"]}
        specs[q["id"]] = {"type": q["type"], "instructions": q["instructions"], "criteria": criteria}
    body = {"model": model, "state": text, "questions": specs}

    def parse(response: dict) -> dict[str, list[float]]:
        answers = response.get("answers") or {}
        out = {}
        for q in questions:
            probs = (answers.get(q["id"]) or {}).get("probabilities")
            if not isinstance(probs, dict):
                continue
            if q["type"] == "score":
                out[q["id"]] = [float(probs.get(str(i), 0.0)) for i in range(len(q["levels"]))]
            else:
                out[q["id"]] = [float(probs.get(v, 0.0)) for v in options(q)]
        return out

    return body, parse


BUILDERS = {"decisions": decisions_request, "jev": jev_request}


def post(endpoint: str, secret: str, body: dict) -> dict:
    data = json.dumps(body).encode()
    delay = 2.0
    last = "no response"
    for attempt in range(8):
        request = urllib.request.Request(
            endpoint,
            data=data,
            headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                return json.loads(response.read().decode())
        except urllib.error.HTTPError as error:
            last = f"HTTP {error.code}: {error.read().decode(errors='replace')[:400]}"
            if error.code not in RETRY_STATUSES or attempt == 7:
                raise RuntimeError(last) from error
            retry_after = error.headers.get("Retry-After")
            wait = float(retry_after) if retry_after else delay
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
            last = str(error)
            if attempt == 7:
                raise RuntimeError(last) from error
            wait = delay
        time.sleep(wait)
        delay = min(delay * 2, 60)
    raise RuntimeError(last)


def open_cache(path: Path) -> sqlite3.Connection:
    con = sqlite3.connect(path, timeout=60, check_same_thread=False)
    con.execute("PRAGMA journal_mode=WAL")
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS answers (
            provider TEXT NOT NULL,
            model TEXT NOT NULL,
            domain TEXT NOT NULL,
            item_id TEXT NOT NULL,
            question_id TEXT NOT NULL,
            spec_hash TEXT NOT NULL,
            input_hash TEXT NOT NULL,
            probs TEXT NOT NULL,
            PRIMARY KEY (provider, model, domain, item_id, question_id)
        );
        CREATE TABLE IF NOT EXISTS calls (
            provider TEXT NOT NULL,
            model TEXT NOT NULL,
            domain TEXT NOT NULL,
            item_id TEXT NOT NULL,
            questions INTEGER NOT NULL,
            input_tokens INTEGER,
            output_tokens INTEGER,
            usd REAL,
            seconds REAL,
            at REAL NOT NULL
        );
        """
    )
    return con


def cached(con: sqlite3.Connection, provider: str, model: str, domain: str) -> dict[tuple[str, str], tuple[str, str]]:
    rows = con.execute(
        "SELECT item_id, question_id, spec_hash, input_hash FROM answers WHERE provider=? AND model=? AND domain=?",
        (provider, model, domain),
    )
    return {(item, question): (spec, inp) for item, question, spec, inp in rows}


def spent(con: sqlite3.Connection) -> float:
    return float(con.execute("SELECT COALESCE(SUM(usd), 0) FROM calls").fetchone()[0])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--domain", required=True, choices=list(PREAMBLE))
    parser.add_argument("--provider", default="decisions", choices=list(PROVIDERS))
    parser.add_argument("--limit", type=int, default=None, help="only the first N items")
    parser.add_argument("--sample", type=int, default=None, help="a seeded random N items (for pilots)")
    parser.add_argument("--chunk", type=int, default=60, help="questions per request")
    parser.add_argument("--workers", type=int, default=12)
    parser.add_argument("--max-dollars", type=float, default=5.0, help="stop once total spend in the cache passes this")
    args = parser.parse_args()

    config = PROVIDERS[args.provider]
    secret = load_secret(config["secret"])
    build = BUILDERS[args.provider]
    bank = load_questions(args.domain)
    specs = {q["id"]: digest(q) for q in bank}

    with workdir() as tmp:
        items = read_json(key(args.domain, "items.json"), tmp)[: args.limit]
        if args.sample:
            items = [items[i] for i in sorted(random.Random(0).sample(range(len(items)), args.sample))]
        db = tmp / "answers.db"
        fetch(CACHE_KEY, db, required=False)
        con = open_cache(db)
        have = cached(con, args.provider, config["model"], args.domain)
        use_images = config["images"] and args.domain == "art"

        def image_for(item: dict) -> bytes | None:
            if not use_images:
                return None
            path = tmp / f"img-{item['id']}.jpg"
            if not path.exists():
                fetch(item.get("model_image") or item["image"], path)
            return path.read_bytes()

        jobs = []
        for item in items:
            text = f"{PREAMBLE[args.domain]}\n\n{item['prompt']}"
            input_hash = digest({"text": text, "image": item.get("model_image") if use_images else None})
            todo = [q for q in bank if have.get((item["id"], q["id"])) != (specs[q["id"]], input_hash)]
            for start in range(0, len(todo), args.chunk):
                jobs.append((item, text, input_hash, todo[start : start + args.chunk]))
        print(
            f"{args.provider}/{config['model']} {args.domain}: {len(items)} items, {len(bank)} questions, "
            f"{len(jobs)} requests pending; ${spent(con):.4f} spent so far",
            flush=True,
        )
        if not jobs:
            return

        lock = threading.Lock()
        stop = threading.Event()
        state = {"done": 0, "failed": 0, "uploaded": time.time()}

        def work(job):
            if stop.is_set():
                return None
            item, text, input_hash, questions = job
            body, parse = build(config["model"], text, image_for(item), questions)
            started = time.time()
            response = post(config["endpoint"], secret, body)
            usage = dict(response.get("usage") or {})
            if not usage.get("input_tokens"):
                # No usage reported: bill ourselves conservatively so --max-dollars still holds.
                usage["input_tokens"] = int(len(json.dumps(body["questions"])) / 3 + len(text) / 3 + (1500 if use_images else 0))
                usage["estimated"] = True
            return job, parse(response), usage, time.time() - started

        try:
            with ThreadPoolExecutor(args.workers) as pool:
                futures = [pool.submit(work, job) for job in jobs]
                for future in as_completed(futures):
                    try:
                        result = future.result()
                    except Exception as error:
                        state["failed"] += 1
                        print(f"fail {state['failed']}: {error}", flush=True)
                        if state["failed"] >= 20:
                            stop.set()
                        continue
                    if result is None:
                        continue
                    (item, _, input_hash, questions), answers, usage, seconds = result
                    tokens_in = usage.get("input_tokens")
                    usd = (tokens_in or 0) * config["usd_per_m_input"] / 1e6
                    with lock:
                        con.executemany(
                            "INSERT OR REPLACE INTO answers VALUES (?,?,?,?,?,?,?,?)",
                            [
                                (args.provider, config["model"], args.domain, item["id"], qid, specs[qid], input_hash, json.dumps(probs))
                                for qid, probs in answers.items()
                            ],
                        )
                        con.execute(
                            "INSERT INTO calls VALUES (?,?,?,?,?,?,?,?,?,?)",
                            (
                                args.provider,
                                config["model"],
                                args.domain,
                                item["id"],
                                len(questions),
                                tokens_in,
                                usage.get("output_tokens"),
                                usd,
                                seconds,
                                time.time(),
                            ),
                        )
                        con.commit()
                        state["done"] += 1
                        missing = len(questions) - len(answers)
                        if missing:
                            print(f"{item['id']}: {missing} of {len(questions)} unanswered", flush=True)
                        total = spent(con)
                        if state["done"] % 25 == 0 or state["done"] == len(jobs):
                            print(f"{state['done']}/{len(jobs)} requests, ${total:.4f} total", flush=True)
                        if total > args.max_dollars and not stop.is_set():
                            print(f"spend ${total:.2f} passed --max-dollars {args.max_dollars}; stopping", flush=True)
                            stop.set()
                        if time.time() - state["uploaded"] > UPLOAD_EVERY:
                            con.execute("PRAGMA wal_checkpoint(TRUNCATE)")
                            upload(db, CACHE_KEY)
                            state["uploaded"] = time.time()
        finally:
            con.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            print(f"done {state['done']} failed {state['failed']}; ${spent(con):.4f} total", flush=True)
            con.close()
            upload(db, CACHE_KEY)


if __name__ == "__main__":
    main()
