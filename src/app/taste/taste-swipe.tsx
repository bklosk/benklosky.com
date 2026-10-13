"use client";

import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from "motion/react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import { DOMAINS, type Domain } from "./domains";
import { importLetterboxd } from "./letterboxd";
import { bald, predictive, TasteModel, type Artifact, type Observation } from "./model";
import { DOMAIN_NOUN, profile, sentence, summary, topReasons } from "./readout";

const LABELS: Record<Domain, string> = { movies: "Movies", books: "Books", art: "Art" };
const PROMPTS: Record<Domain, string> = {
  movies: "Would you want to watch this?",
  books: "Would you want to read this?",
  art: "Do you like this?",
};
const SWIPE_AT = 110; // px of drag that counts as a swipe
const RECOMMEND = 6;

type Saved = { swipes: [string, boolean][]; skipped: string[]; pins: [string, number][] };
type State = { swipes: { item: number; like: boolean }[]; skipped: number[]; pins: Map<number, number> };
type Phase = { kind: "loading" } | { kind: "ready"; model: TasteModel } | { kind: "error"; message: string };

// One fetch per domain per page load, shared across tab switches and React's dev double-mount.
const loads = new Map<Domain, Promise<TasteModel>>();

function load(domain: Domain) {
  let promise = loads.get(domain);
  if (!promise) {
    promise = Promise.all([
      fetch(`/taste/data/${domain}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`model.json: HTTP ${r.status}`)))),
      fetch(`/taste/data/${domain}/bin`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`model.bin: HTTP ${r.status}`)))),
    ]).then(([artifact, bin]) => new TasteModel(artifact as Artifact, bin));
    promise.catch(() => loads.delete(domain));
    loads.set(domain, promise);
  }
  return promise;
}

const featureKey = (model: TasteModel, j: number) => {
  const f = model.artifact.features[j];
  return f.option ? `${f.question}:${f.option}` : f.question;
};

/** Saved state refers to items and features by id, so it survives a rebuilt model. */
function restore(model: TasteModel, domain: Domain): State {
  const empty: State = { swipes: [], skipped: [], pins: new Map() };
  try {
    const saved = JSON.parse(localStorage.getItem(`taste:${domain}`) ?? "null") as Saved | null;
    if (!saved) return empty;
    const items = new Map(model.artifact.items.map((item, i) => [item.id, i]));
    const features = new Map(model.artifact.features.map((_, j) => [featureKey(model, j), j]));
    return {
      swipes: saved.swipes.flatMap(([id, like]) => (items.has(id) ? [{ item: items.get(id)!, like }] : [])),
      skipped: saved.skipped.flatMap((id) => (items.has(id) ? [items.get(id)!] : [])),
      pins: new Map(saved.pins.flatMap(([key, value]) => (features.has(key) ? [[features.get(key)!, value] as const] : []))),
    };
  } catch {
    return empty;
  }
}

function save(model: TasteModel, domain: Domain, state: State) {
  const items = model.artifact.items;
  const saved: Saved = {
    swipes: state.swipes.map(({ item, like }) => [items[item].id, like]),
    skipped: state.skipped.map((i) => items[i].id),
    pins: [...state.pins].map(([j, value]) => [featureKey(model, j), value]),
  };
  try {
    localStorage.setItem(`taste:${domain}`, JSON.stringify(saved));
  } catch {
    // Private mode or a full quota: the session still works, it just won't persist.
  }
}

const pct = (p: number) => `${Math.round(100 * p)}%`;

export function TasteSwipe() {
  const [domain, setDomain] = useState<Domain>("movies");
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    load(domain)
      .then((model) => live && setPhase({ kind: "ready", model }))
      .catch((error: Error) => live && setPhase({ kind: "error", message: `Couldn't load the ${domain} model: ${error.message}` }));
    return () => {
      live = false;
    };
  }, [domain]);

  const pick = (next: Domain) => {
    if (next === domain) return;
    setPhase({ kind: "loading" });
    setDomain(next);
  };

  return (
    <div className="taste">
      <nav className="taste-tabs" aria-label="Domain">
        {DOMAINS.map((d) => (
          <button key={d} aria-pressed={d === domain} onClick={() => pick(d)}>
            {LABELS[d]}
          </button>
        ))}
      </nav>
      {phase.kind === "loading" && (
        <p className="taste-status" role="status">
          Loading the {domain} model…
        </p>
      )}
      {phase.kind === "error" && <p className="taste-status taste-error">{phase.message}</p>}
      {phase.kind === "ready" && phase.model.artifact.domain === domain && <Session key={domain} domain={domain} model={phase.model} />}
    </div>
  );
}

function Session({ domain, model }: { domain: Domain; model: TasteModel }) {
  const [state, setState] = useState<State>(() => restore(model, domain));
  const [history, setHistory] = useState<State[]>([]);
  const [direction, setDirection] = useState(0);
  const [editing, setEditing] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const items = model.artifact.items;
  const noun = DOMAIN_NOUN[domain];

  useEffect(() => save(model, domain, state), [model, domain, state]);

  const observations = useMemo<Observation[]>(
    () => [
      ...state.swipes.map(({ item, like }) => ({ kind: "swipe" as const, item, like })),
      ...[...state.pins].map(([feature, value]) => ({ kind: "pin" as const, feature, value })),
    ],
    [state],
  );
  const post = useMemo(() => model.fit(observations), [model, observations]);
  const seen = useMemo(() => new Set([...state.swipes.map((s) => s.item), ...state.skipped]), [state]);

  // The next card: the unseen item whose swipe would tell the model the most.
  const next = useMemo(() => {
    let best = -1;
    let bestInfo = -Infinity;
    for (let i = 0; i < model.N; i++) {
      if (seen.has(i)) continue;
      const info = bald(post.itemMean[i], post.itemVar[i]);
      if (info > bestInfo) {
        best = i;
        bestInfo = info;
      }
    }
    if (best < 0) return null;
    const reasons = topReasons(model, model.varianceParts(post, best), best, 3);
    return { item: best, info: bestInfo, p: predictive(post.itemMean[best], post.itemVar[best]), sd: Math.sqrt(post.itemVar[best]), reasons };
  }, [model, post, seen]);

  const pinnedSet = useMemo(() => new Set(state.pins.keys()), [state.pins]);
  const { traits, unsure } = useMemo(() => profile(model, post, pinnedSet), [model, post, pinnedSet]);

  const recommendations = useMemo(() => {
    const scored: { item: number; p: number }[] = [];
    for (let i = 0; i < model.N; i++) if (!seen.has(i)) scored.push({ item: i, p: predictive(post.itemMean[i], post.itemVar[i]) });
    scored.sort((a, b) => b.p - a.p);
    return scored.slice(0, RECOMMEND).map(({ item, p }) => ({ item, p, reasons: topReasons(model, model.scoreParts(post, item), item, 2) }));
  }, [model, post, seen]);

  const update = useCallback(
    (change: (s: State) => State) => {
      setHistory((h) => [...h.slice(-49), state]);
      setState(change);
    },
    [state],
  );

  const swipe = useCallback(
    (like: boolean | null) => {
      if (!next) return;
      setDirection(like === null ? 0 : like ? 1 : -1);
      update((s) =>
        like === null ? { ...s, skipped: [...s.skipped, next.item] } : { ...s, swipes: [...s.swipes, { item: next.item, like }] },
      );
    },
    [next, update],
  );

  const undo = useCallback(() => {
    if (!history.length) return;
    setState(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  }, [history]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if ((event.target as HTMLElement).closest("input, textarea, select")) return;
      if (event.key === "ArrowLeft") swipe(false);
      else if (event.key === "ArrowRight") swipe(true);
      else if (event.key === "ArrowDown" || event.key === "s") swipe(null);
      else if (event.key === "u") undo();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [swipe, undo]);

  const setPin = (feature: number, value: number | null) => {
    update((s) => {
      const pins = new Map(s.pins);
      if (value === null) pins.delete(feature);
      else pins.set(feature, value);
      return { ...s, pins };
    });
    setEditing(null);
  };

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const result = importLetterboxd(await file.text(), items);
      const fresh = result.matched.filter(({ item }) => !state.swipes.some((s) => s.item === item));
      update((s) => ({ ...s, swipes: [...s.swipes, ...fresh] }));
      const likes = fresh.filter((m) => m.like).length;
      setNotice(
        `Read ${result.rows} ratings: ${fresh.length} matched films in this catalog (${likes} likes, ${fresh.length - likes} dislikes), ` +
          `${result.unmatched} not in the catalog, ${result.unrated} rated 3★ or unrated and skipped.`,
      );
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  const reset = () => {
    update(() => ({ swipes: [], skipped: [], pins: new Map() }));
    setNotice(null);
  };

  const likes = state.swipes.filter((s) => s.like).length;

  return (
    <>
      <section className="taste-deck" aria-label="Swipe">
        <p className="taste-prompt">{PROMPTS[domain]}</p>
        <div className="taste-stack">
          <AnimatePresence mode="popLayout" custom={direction} initial={false}>
            {next ? (
              <Card key={next.item} domain={domain} model={model} item={next.item} direction={direction} onSwipe={swipe} />
            ) : (
              <p className="taste-status">You&rsquo;ve seen every card in this catalog.</p>
            )}
          </AnimatePresence>
        </div>
        <div className="taste-buttons">
          <button onClick={() => swipe(false)} disabled={!next} aria-label="Dislike">
            ← Nope
          </button>
          <button onClick={() => swipe(null)} disabled={!next} className="taste-skip">
            Don&rsquo;t know
          </button>
          <button onClick={() => swipe(true)} disabled={!next} aria-label="Like">
            Like →
          </button>
        </div>
        {next && (
          <p className="taste-why" aria-live="polite">
            <strong>Why this card:</strong>{" "}
            {state.swipes.length === 0 && state.pins.size === 0 ? (
              <>it&rsquo;s the {noun.replace(/s$/, "")} the average person is most split on, so your answer teaches the most. </>
            ) : (
              <>of every unseen card, your answer to this one should teach the model the most ({next.info.toFixed(2)} bits). </>
            )}
            The model gives it {pct(next.p)} (±{next.sd.toFixed(1)} logits)
            {next.reasons.length > 0 && (
              <>
                , and most of that doubt is about{" "}
                {next.reasons.map((r, i) => (
                  <span key={r.feature}>
                    {i > 0 && (i === next.reasons.length - 1 ? " and " : ", ")}
                    <em>{r.phrase}</em>
                  </span>
                ))}
              </>
            )}
            .
          </p>
        )}
        <p className="taste-meta">
          {state.swipes.length} swipe{state.swipes.length === 1 ? "" : "s"} ({likes} likes){state.skipped.length ? ` · ${state.skipped.length} skipped` : ""}
          {" · "}
          <button className="taste-link" onClick={undo} disabled={!history.length}>
            undo (u)
          </button>
          {" · "}
          <button className="taste-link" onClick={reset} disabled={!state.swipes.length && !state.skipped.length && !state.pins.size}>
            start over
          </button>
        </p>
      </section>

      <section className="taste-profile" aria-label="Your taste">
        <h2>What it thinks you like</h2>
        <p className="taste-summary" aria-live="polite">
          {summary(traits, unsure, state.swipes.length)}
        </p>
        {traits.length > 0 && (
          <ul className="taste-traits">
            {traits.map((t) => (
              <li key={t.feature}>
                <button className="taste-trait" onClick={() => setEditing(editing === t.feature ? null : t.feature)} aria-expanded={editing === t.feature}>
                  <span className="taste-bar" aria-hidden="true">
                    <span
                      style={{ width: `${Math.min(100, (100 * Math.abs(t.mean)) / (1.5 * model.artifact.readout.strong))}%` }}
                      data-side={t.verb}
                    />
                  </span>
                  <span>
                    You {sentence(t)}
                    {t.pinned ? <span className="taste-tag">your edit</span> : t.shared ? <span className="taste-tag">like most people</span> : null}
                  </span>
                </button>
                {editing === t.feature && <Editor model={model} feature={t.feature} pinned={state.pins.get(t.feature)} onPin={setPin} />}
              </li>
            ))}
          </ul>
        )}
        {unsure.length > 0 && (
          <p className="taste-unsure">
            Not sure yet:{" "}
            {unsure.map((u, i) => (
              <span key={u.feature}>
                {i > 0 && " · "}
                <button className="taste-link" onClick={() => setEditing(editing === u.feature ? null : u.feature)}>
                  {u.topic}
                </button>
              </span>
            ))}
          </p>
        )}
        {editing !== null && !traits.some((t) => t.feature === editing) && (
          <Editor model={model} feature={editing} pinned={state.pins.get(editing)} onPin={setPin} />
        )}
        {[...state.pins].filter(([j]) => !traits.some((t) => t.feature === j)).length > 0 && (
          <p className="taste-unsure">
            Your edits the model now treats as neutral or weak:{" "}
            {[...state.pins]
              .filter(([j]) => !traits.some((t) => t.feature === j))
              .map(([j], i) => (
                <span key={j}>
                  {i > 0 && " · "}
                  <button className="taste-link" onClick={() => setEditing(j)}>
                    {model.artifact.features[j].topic}
                  </button>
                </span>
              ))}
          </p>
        )}
        <AddTrait model={model} onPick={setEditing} />
      </section>

      <section className="taste-recs" aria-label="Recommendations">
        <h2>It would show you next</h2>
        <p className="taste-note">The unseen {noun} it gives the highest chance you&rsquo;ll like, and the features that push each one up most.</p>
        <ol>
          {recommendations.map((r) => (
            <li key={r.item}>
              <span className="taste-rec-title">
                <a href={items[r.item].link} target="_blank" rel="noreferrer">
                  {items[r.item].title}
                </a>{" "}
                <span className="taste-dim">{items[r.item].subtitle}</span>
              </span>
              <span className="taste-dim">
                {pct(r.p)}
                {r.reasons.length > 0 && <> · {r.reasons.map((x) => x.phrase).join(", ")}</>}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {domain === "movies" && (
        <section className="taste-import" aria-label="Import from Letterboxd">
          <h2>Bring your Letterboxd ratings</h2>
          <p className="taste-note">
            Export your data from Letterboxd (Settings → Data → Export) and pick <code>ratings.csv</code>. It&rsquo;s read in your
            browser; nothing is uploaded. 3.5★ and up counts as a like, 2.5★ and down as a dislike.
          </p>
          <label className="taste-file">
            <input type="file" accept=".csv,text/csv" onChange={onImport} />
            <span>Choose ratings.csv</span>
          </label>
          {notice && <p className="taste-note" role="status">{notice}</p>}
        </section>
      )}
    </>
  );
}

function Card({
  domain,
  model,
  item,
  direction,
  onSwipe,
}: {
  domain: Domain;
  model: TasteModel;
  item: number;
  direction: number;
  onSwipe: (like: boolean | null) => void;
}) {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-12, 12]);
  const likeOpacity = useTransform(x, [20, SWIPE_AT], [0, 1]);
  const nopeOpacity = useTransform(x, [-SWIPE_AT, -20], [1, 0]);
  const data = model.artifact.items[item];

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_AT || info.velocity.x > 800) onSwipe(true);
    else if (info.offset.x < -SWIPE_AT || info.velocity.x < -800) onSwipe(false);
  };

  return (
    <motion.article
      className={`taste-card taste-card--${domain}`}
      style={{ x, rotate }}
      drag={reduceMotion ? false : "x"}
      dragSnapToOrigin
      dragElastic={0.7}
      onDragEnd={onDragEnd}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { x: direction * 420, opacity: 0, rotate: direction * 18, transition: { duration: 0.22 } }}
      custom={direction}
    >
      <motion.span className="taste-stamp taste-stamp--like" style={{ opacity: likeOpacity }} aria-hidden="true">
        LIKE
      </motion.span>
      <motion.span className="taste-stamp taste-stamp--nope" style={{ opacity: nopeOpacity }} aria-hidden="true">
        NOPE
      </motion.span>
      {data.image && (
        <div className="taste-image">
          <Image
            src={`/taste/image/${domain}/${data.id}`}
            alt={data.alt || data.title}
            fill
            unoptimized
            draggable={false}
            sizes="(max-width: 40rem) 90vw, 34rem"
          />
        </div>
      )}
      <div className="taste-card-text">
        <h3>{data.title}</h3>
        <p className="taste-dim">{data.subtitle}</p>
        {data.tags.length > 0 && (
          <p className="taste-tags">
            {data.tags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </p>
        )}
        {data.blurb && <p className="taste-blurb">{data.blurb}</p>}
        <p className="taste-credit">
          <a href={data.link} target="_blank" rel="noreferrer">
            {data.credit}
          </a>
        </p>
      </div>
    </motion.article>
  );
}

function Editor({
  model,
  feature,
  pinned,
  onPin,
}: {
  model: TasteModel;
  feature: number;
  pinned: number | undefined;
  onPin: (feature: number, value: number | null) => void;
}) {
  const f = model.artifact.features[feature];
  const { min, strong } = model.artifact.readout;
  const lean = (min + strong) / 2;
  // Values are traits in the feature's own direction, in the units the profile reads.
  const [low, high] = f.kind === "score" ? [f.neg, f.pos] : [`avoid ${f.pos}`, `prefer ${f.pos}`];
  const levels = [
    { mark: "«", label: `strongly ${low}`, value: -1.25 * strong },
    { mark: "‹", label: `somewhat ${low}`, value: -lean },
    { mark: "·", label: "no preference", value: 0 },
    { mark: "›", label: `somewhat ${high}`, value: lean },
    { mark: "»", label: `strongly ${high}`, value: 1.25 * strong },
  ];
  return (
    <div className="taste-editor" role="group" aria-label={`Edit: ${f.topic}`}>
      <p className="taste-note">
        <em>{f.text}</em> Tell it where you stand. It treats your answer as near-certain and shifts everything that tends to go
        with it.
      </p>
      <div className="taste-levels">
        <span className="taste-pole">{low}</span>
        {levels.map((level) => (
          <button
            key={level.mark}
            title={level.label}
            aria-label={level.label}
            aria-pressed={pinned !== undefined && Math.abs(pinned - level.value) < 1e-9}
            onClick={() => onPin(feature, level.value)}
          >
            {level.mark}
          </button>
        ))}
        <span className="taste-pole">{high}</span>
      </div>
      {pinned !== undefined && (
        <button className="taste-link" onClick={() => onPin(feature, null)}>
          remove my edit
        </button>
      )}
    </div>
  );
}

function AddTrait({ model, onPick }: { model: TasteModel; onPick: (feature: number) => void }) {
  const options = useMemo(
    () =>
      model.artifact.features
        .map((f, j) => ({ j, label: f.kind === "score" ? `${f.topic} (${f.neg} ↔ ${f.pos})` : f.pos, group: f.group }))
        .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label)),
    [model],
  );
  const groups = [...new Set(options.map((o) => o.group))];
  return (
    <label className="taste-add">
      <span>Tell it something directly:</span>
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) onPick(Number(e.target.value));
        }}
      >
        <option value="">Pick a trait…</option>
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {options
              .filter((o) => o.group === g)
              .map((o) => (
                <option key={o.j} value={o.j}>
                  {o.label}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
