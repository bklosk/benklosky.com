"use client";

import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DPOSession, PreferStats, Tokens } from "./engine/index.js";

const MODEL_URL = "/clickbait/headline-gpt-v1.bin";
const POOL_SIZE = 12;

type Ranked = { ids: Tokens; text: string; reward: number; start: number };
type Phase =
  | { kind: "loading"; loaded: number; total: number }
  | { kind: "ready" }
  | { kind: "error"; message: string };

// One session per page load: every visitor (and every reload) starts from the pretrained model.
// Kept at module scope so React's dev double-mount and client-side navigation don't reload it.
let sessionPromise: Promise<DPOSession> | null = null;

function loadSession(onProgress: (loaded: number, total: number) => void) {
  sessionPromise ??= import("./engine/index.js").then(({ loadDPOSession }) =>
    loadDPOSession(MODEL_URL, { onProgress }),
  );
  return sessionPromise;
}

export function ClickbaitTrainer() {
  const reduceMotion = useReducedMotion();
  const [session, setSession] = useState<DPOSession | null>(null);
  const busyRef = useRef(false);
  const [phase, setPhase] = useState<Phase>({ kind: "loading", loaded: 0, total: 0 });
  const [pair, setPair] = useState<[Tokens, Tokens] | null>(null);
  const [pool, setPool] = useState<Ranked[]>([]);
  const [busy, setBusy] = useState(false);
  const [clicks, setClicks] = useState(0);
  const [last, setLast] = useState<PreferStats | null>(null);
  const [samples, setSamples] = useState<string[]>([]);

  useEffect(() => {
    let live = true;
    loadSession((loaded, total) => live && setPhase({ kind: "loading", loaded, total }))
      .then(async (session) => {
        session.device.lost.then((info) => {
          if (info.reason !== "destroyed") setPhase({ kind: "error", message: `The GPU went away (${info.message || "device lost"}). Reload to start over.` });
        });
        const seeds = await session.sample(POOL_SIZE);
        const first = await session.samplePair();
        if (!live) return;
        setPool(seeds.map((ids, start) => ({ ids, text: session.text(ids), reward: 0, start })));
        setPair(first);
        setSession(session);
        setPhase({ kind: "ready" });
      })
      .catch((error: Error) => {
        sessionPromise = null;
        if (!live) return;
        const unsupported = error.name === "WebGPUUnavailableError";
        setPhase({
          kind: "error",
          message: unsupported
            ? "This needs WebGPU, which your browser doesn't have. Try a recent Chrome, Edge, or Safari."
            : `Something broke while loading the model: ${error.message}`,
        });
      });
    return () => {
      live = false;
    };
  }, []);

  /** Runs one GPU job at a time; clicks that arrive mid-job are dropped. */
  const run = useCallback(async (job: (session: DPOSession) => Promise<void>) => {
    if (!session || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await job(session);
    } catch (error) {
      setPhase({ kind: "error", message: `Training failed: ${(error as Error).message}` });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [session]);

  const rerank = useCallback(async (session: DPOSession, current: Ranked[]) => {
    const rewards = await session.rewards(current.map((p) => p.ids));
    setPool(current.map((p, i) => ({ ...p, reward: rewards[i] })).sort((a, b) => b.reward - a.reward || a.start - b.start));
  }, []);

  const choose = useCallback(
    (winner: 0 | 1) =>
      run(async (session) => {
        if (!pair) return;
        const stats = await session.prefer(pair[winner], pair[1 - winner]);
        setLast(stats);
        setClicks((c) => c + 1);
        await rerank(session, pool);
        setPair(await session.samplePair());
      }),
    [pair, pool, rerank, run],
  );

  const skip = useCallback(() => run(async (session) => setPair(await session.samplePair())), [run]);

  const sampleFresh = useCallback(
    () => run(async (session) => setSamples((await session.sample(5)).map((ids) => session.text(ids)))),
    [run],
  );

  const reset = useCallback(
    () =>
      run(async (session) => {
        session.reset();
        setClicks(0);
        setLast(null);
        setSamples([]);
        await rerank(session, pool);
        setPair(await session.samplePair());
      }),
    [pool, rerank, run],
  );

  useEffect(() => {
    if (phase.kind !== "ready") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if ((event.target as HTMLElement).closest("input, textarea, select")) return;
      if (event.key === "ArrowLeft" || event.key === "1") choose(0);
      else if (event.key === "ArrowRight" || event.key === "2") choose(1);
      else if (event.key === "s") skip();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase.kind, choose, skip]);

  if (phase.kind === "error") return <p className="clickbait-status clickbait-error">{phase.message}</p>;
  if (phase.kind === "loading" || !pair || !session) {
    const pct = phase.kind === "loading" && phase.total ? Math.round((100 * phase.loaded) / phase.total) : null;
    return (
      <p className="clickbait-status" role="status">
        {pct === null || pct >= 100 ? "Warming up the GPU…" : `Downloading the model… ${pct}%`}
      </p>
    );
  }

  return (
    <div className="clickbait-trainer">
      <section aria-label="Pick a headline">
        <p className="clickbait-prompt">Which is more clickbait?</p>
        <div className="clickbait-pair" aria-busy={busy}>
          {pair.map((ids, i) => (
            <button key={`${i}-${ids.join(",")}`} className="clickbait-option" disabled={busy} onClick={() => choose(i as 0 | 1)}>
              <span className="clickbait-key" aria-hidden="true">{i === 0 ? "←" : "→"}</span>
              {session.text(ids)}
            </button>
          ))}
        </div>
        <div className="clickbait-controls">
          <button onClick={skip} disabled={busy}>
            Neither<span className="clickbait-hint"> (s)</span>
          </button>
          <span className="clickbait-stats" aria-live="polite">
            {clicks === 0
              ? "Each pick is one DPO step on your copy of the model."
              : `${clicks} pick${clicks === 1 ? "" : "s"} · step ${last ? Math.round(last.ms) : "–"} ms · loss ${last?.loss.toFixed(3) ?? "–"}`}
          </span>
        </div>
      </section>

      <section aria-label="Ranking">
        <h2>How your model ranks these</h2>
        <p className="clickbait-note">
          Twelve headlines from the original model, ordered by the reward your picks have taught it, β·log(π/π<sub>ref</sub>).
        </p>
        <ol className="clickbait-pool">
          {pool.map((p) => (
            <motion.li key={p.start} layout={!reduceMotion} transition={{ duration: 0.35, ease: "easeInOut" }}>
              <span>{p.text}</span>
              <span className="clickbait-reward">{clicks ? (p.reward >= 0 ? "+" : "") + p.reward.toFixed(2) : ""}</span>
            </motion.li>
          ))}
        </ol>
      </section>

      <section aria-label="Samples">
        <h2>What your model writes now</h2>
        <div className="clickbait-controls">
          <button onClick={sampleFresh} disabled={busy}>Sample 5</button>
          <button onClick={reset} disabled={busy || clicks === 0}>Start over</button>
        </div>
        {samples.length > 0 && (
          <ul className="clickbait-samples">
            {samples.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
