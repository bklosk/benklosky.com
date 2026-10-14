"use client";

import {
  AnimatePresence,
  motion,
  useIsPresent,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
  type PanInfo,
  type Variants,
} from "motion/react";
import Image from "next/image";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { DOMAINS, type Domain } from "./domains";
import { QuestionMap, type MapArtifact } from "./map";
import { bald, predictive, TasteModel, type Artifact, type Observation, type Posterior } from "./model";
import { DOMAIN_NOUN, profile, sentence, topReasons } from "./readout";
import { TasteMap } from "./taste-map";

const LABELS: Record<Domain, string> = { movies: "Movies", books: "Books", art: "Art" };
const PROMPTS: Record<Domain, string> = {
  movies: "Would you want to watch this?",
  books: "Would you want to read this?",
  art: "Do you like this?",
};
const SWIPE_AT = 110; // px of drag that counts as a swipe
const RECOMMEND = 5;
const REVEAL_EVERY = 8; // swipes between updates to the profile and recommendations
const LOOKAHEAD_UPTO = 100; // observations; past this a fit takes tens of ms, too slow to run two per swipe

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

// The map loads after the model, once per model, and is optional: the page works without it.
const maps = new WeakMap<TasteModel, Promise<QuestionMap>>();

function loadMap(domain: Domain, model: TasteModel) {
  let promise = maps.get(model);
  if (!promise) {
    promise = fetch(`/taste/data/${domain}/map`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`map.json: HTTP ${r.status}`))))
      .then((artifact) => new QuestionMap(model, artifact as MapArtifact));
    promise.catch(() => maps.delete(model));
    maps.set(model, promise);
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

const observe = (swipes: State["swipes"], pins: State["pins"]): Observation[] => [
  ...swipes.map(({ item, like }) => ({ kind: "swipe" as const, item, like })),
  ...[...pins].map(([feature, value]) => ({ kind: "pin" as const, feature, value })),
];

// Recent fits per model, keyed by their observations. The fits for both answers to the current card
// run ahead of time, so the one for the answer actually given is usually already here.
const fits = new WeakMap<TasteModel, Map<string, Posterior>>();

function fitOf(model: TasteModel, swipes: State["swipes"], pins: State["pins"]) {
  const key = `${swipes.map((s) => (s.like ? "+" : "-") + s.item).join()}|${[...pins].map(([f, v]) => `${f}=${v}`).join()}`;
  let cache = fits.get(model);
  if (!cache) fits.set(model, (cache = new Map()));
  const post = cache.get(key) ?? model.fit(observe(swipes, pins));
  cache.delete(key);
  cache.set(key, post);
  if (cache.size > 8) cache.delete(cache.keys().next().value!);
  return post;
}

/** The candidate whose swipe would tell the model the most. */
function bestCard(post: Posterior, candidates: number[], except: number | null = null) {
  let best: number | null = null;
  let bestInfo = -Infinity;
  for (const i of candidates) {
    if (i === except) continue;
    const info = bald(post.itemMean[i], post.itemVar[i]);
    if (info > bestInfo) {
      best = i;
      bestInfo = info;
    }
  }
  return best;
}

type Answer = "like" | "nope" | "skip";
type Lookahead = { state: State } & Record<Answer, number | null>;

const pct = (p: number) => `${Math.round(100 * p)}%`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

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
  const [lean, setLean] = useState(0);
  const [lookahead, setLookahead] = useState<Lookahead | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [opened, setOpened] = useState<number | null>(null);
  const [map, setMap] = useState<QuestionMap | null>(null);
  const items = model.artifact.items;
  const noun = DOMAIN_NOUN[domain];

  useEffect(() => save(model, domain, state), [model, domain, state]);

  useEffect(() => {
    let live = true;
    loadMap(domain, model)
      .then((m) => live && setMap(m))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [domain, model]);

  // Every swipe refits the model and picks the next card, but the profile and recommendations only
  // catch up every REVEAL_EVERY swipes. Edits are the user's own words, so they show at once.
  const revealed = state.swipes.length - (state.swipes.length % REVEAL_EVERY);
  const post = useMemo(() => fitOf(model, state.swipes, state.pins), [model, state]);
  const shown = useMemo(() => fitOf(model, state.swipes.slice(0, revealed), state.pins), [model, state, revealed]);
  // Unseen items with a picture. Only these become cards or recommendations; the rest stay in the
  // model, so an imported rating of one still counts.
  const unseen = useMemo(() => {
    const seen = new Set([...state.swipes.map((s) => s.item), ...state.skipped]);
    return items.flatMap((item, i) => (item.image && !seen.has(i) ? [i] : []));
  }, [items, state]);

  const next = useMemo(() => bestCard(post, unseen), [post, unseen]);

  // The card each answer would lead to, so it can already be sitting under this one. It's worked out
  // once the last card has flown off; a faster swipe just gets its next card without the preview.
  useEffect(() => {
    if (next === null || state.swipes.length + state.pins.size >= LOOKAHEAD_UPTO) return;
    const timer = setTimeout(() => {
      const after = (like: boolean) => bestCard(fitOf(model, [...state.swipes, { item: next, like }], state.pins), unseen, next);
      setLookahead({ state, like: after(true), nope: after(false), skip: bestCard(post, unseen, next) });
    }, 250);
    return () => clearTimeout(timer);
  }, [model, state, post, unseen, next]);

  // One card per distinct item; each knows which answers it follows.
  const below = useMemo(() => {
    const cards = new Map<number, Set<Answer>>();
    if (lookahead?.state !== state) return cards;
    for (const answer of ["like", "nope", "skip"] as const) {
      const item = lookahead[answer];
      if (item !== null) cards.set(item, (cards.get(item) ?? new Set()).add(answer));
    }
    return cards;
  }, [lookahead, state]);

  const pinnedSet = useMemo(() => new Set(state.pins.keys()), [state.pins]);
  // Before the first update the posterior is the population prior plus any edits. Its traits would be
  // true of everyone, not this user, so only the user's own edits show until then.
  const traits = useMemo(() => {
    const { traits } = profile(model, shown, pinnedSet);
    return revealed === 0 ? traits.filter((t) => t.pinned) : traits;
  }, [model, shown, pinnedSet, revealed]);

  // The map shows the same profile: the revealed swipes, and the user placed from them.
  const you = useMemo(() => map?.place(shown) ?? null, [map, shown]);
  const shownSwipes = useMemo(() => state.swipes.slice(0, revealed), [state.swipes, revealed]);

  const recommendations = useMemo(() => {
    const scored = unseen.map((item) => ({ item, p: predictive(shown.itemMean[item], shown.itemVar[item]) }));
    scored.sort((a, b) => b.p - a.p);
    return scored.slice(0, RECOMMEND);
  }, [shown, unseen]);

  const update = useCallback(
    (change: (s: State) => State) => {
      setHistory((h) => [...h.slice(-49), state]);
      setState(change);
    },
    [state],
  );

  const swipe = useCallback(
    (like: boolean | null) => {
      if (next === null) return;
      setDirection(like === null ? 0 : like ? 1 : -1);
      setLean(0);
      update((s) => (like === null ? { ...s, skipped: [...s.skipped, next] } : { ...s, swipes: [...s.swipes, { item: next, like }] }));
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
      if ((event.target as HTMLElement).closest("input, textarea, select, [data-own-keys]")) return;
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

  const reset = () => update(() => ({ swipes: [], skipped: [], pins: new Map() }));

  const likes = state.swipes.filter((s) => s.like).length;
  const pending = state.swipes.length - revealed;

  return (
    <>
      <section className="taste-deck" aria-label="Swipe">
        <p className="taste-prompt">{PROMPTS[domain]}</p>
        <div className={`taste-stack taste-stack--${domain}`}>
          <AnimatePresence custom={direction} initial={false}>
            {[
              // While a card is dragged, the one its answer leads to shows underneath.
              ...[...below].map(([item, answers]) => (
                <Card key={item} domain={domain} model={model} item={item} hidden={!answers.has(lean < 0 ? "nope" : "like")} />
              )),
              next !== null && <Card key={next} domain={domain} model={model} item={next} onSwipe={swipe} onLean={setLean} />,
            ]}
          </AnimatePresence>
          {next === null && <p className="taste-status">You&rsquo;ve seen every card in this catalog.</p>}
        </div>
        <div className="taste-buttons">
          <button onClick={() => swipe(false)} disabled={next === null} aria-label="Dislike">
            ← Nope
          </button>
          <button onClick={() => swipe(null)} disabled={next === null} className="taste-skip">
            Don&rsquo;t know
          </button>
          <button onClick={() => swipe(true)} disabled={next === null} aria-label="Like">
            Like →
          </button>
        </div>
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
        <p className="taste-countdown">
          <span className="taste-pips" aria-hidden="true">
            {Array.from({ length: REVEAL_EVERY }, (_, i) => (
              <span key={i} data-on={i < pending || undefined} />
            ))}
          </span>
          {revealed === 0
            ? `First update in ${plural(REVEAL_EVERY - pending, "swipe")}`
            : pending === 0
              ? `Updated with ${plural(revealed, "swipe")} · next in ${REVEAL_EVERY}`
              : `Next update in ${plural(REVEAL_EVERY - pending, "swipe")}`}
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
      </section>

      <section className="taste-recs" aria-label="Recommendations">
        <h2>Top {RECOMMEND} recommendations for you</h2>
        <ol>
          {recommendations.map((r) => (
            <li key={r.item}>
              <button className="taste-rec" onClick={() => setOpened(opened === r.item ? null : r.item)} aria-expanded={opened === r.item}>
                <span>
                  <span className="taste-rec-title">{items[r.item].title}</span>{" "}
                  <span className="taste-dim">{items[r.item].subtitle}</span>
                </span>
                <span className="taste-dim">{pct(r.p)}</span>
              </button>
              {opened === r.item && <Predictors model={model} post={shown} item={r.item} />}
            </li>
          ))}
        </ol>
      </section>

      {map && <TasteMap domain={domain} map={map} you={you} swipes={shownSwipes} fresh={revealed === 0 && state.pins.size === 0} />}
    </>
  );
}

// The card on top flies off over the one taking its place; cards waiting for another answer just go.
const EXIT: Variants = {
  fly: (direction: number) => ({
    x: direction * 420,
    rotate: direction * 18,
    opacity: 0,
    zIndex: 2,
    transition: { duration: 0.22, zIndex: { duration: 0 } },
  }),
  fade: { opacity: 0, zIndex: 2, transition: { duration: 0.18, zIndex: { duration: 0 } } },
  drop: { opacity: 0, transition: { duration: 0 } },
};

/** A card in the deck. With onSwipe it's the top card; without, it waits underneath. */
function Card({
  domain,
  model,
  item,
  hidden = false,
  onSwipe,
  onLean,
}: {
  domain: Domain;
  model: TasteModel;
  item: number;
  hidden?: boolean;
  onSwipe?: (like: boolean | null) => void;
  onLean?: (side: number) => void;
}) {
  const reduceMotion = useReducedMotion();
  const present = useIsPresent();
  const top = onSwipe !== undefined;
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-12, 12]);
  const likeOpacity = useTransform(x, [20, SWIPE_AT], [0, 1]);
  const nopeOpacity = useTransform(x, [-SWIPE_AT, -20], [1, 0]);
  const data = model.artifact.items[item];

  useMotionValueEvent(x, "change", (v) => {
    if (present) onLean?.(Math.sign(v));
  });

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > SWIPE_AT || info.velocity.x > 800) onSwipe?.(true);
    else if (info.offset.x < -SWIPE_AT || info.velocity.x < -800) onSwipe?.(false);
  };

  return (
    <motion.article
      className={`taste-card taste-card--${domain}`}
      style={{ x, rotate, zIndex: top ? 1 : 0 }}
      data-hidden={hidden || undefined}
      aria-hidden={!top}
      inert={!top}
      drag={top && !reduceMotion ? "x" : false}
      dragSnapToOrigin
      dragElastic={0.7}
      onDragEnd={onDragEnd}
      initial={false}
      variants={EXIT}
      exit={!top ? "drop" : reduceMotion ? "fade" : "fly"}
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
            loading="eager"
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

/** The features that move one item's score most, each way: its score split into parts x_j m_j. */
function Predictors({ model, post, item }: { model: TasteModel; post: Posterior; item: number }) {
  const data = model.artifact.items[item];
  const parts = model.scoreParts(post, item);
  const groups = [
    { side: "prefer", label: "Pushing it up", sign: "+", reasons: topReasons(model, parts, item, 5) },
    { side: "avoid", label: "Holding it back", sign: "−", reasons: topReasons(model, parts, item, 3, -1) },
  ].filter((g) => g.reasons.length > 0);
  const scale = Math.max(...groups.flatMap((g) => g.reasons.map((r) => r.share)));
  return (
    <div className="taste-predictors">
      {groups.map((g) => (
        <Fragment key={g.side}>
          <h3>{g.label}</h3>
          <ul>
            {g.reasons.map((r) => (
              <li key={r.feature}>
                <span className="taste-bar" aria-hidden="true">
                  <span style={{ width: `${(100 * r.share) / scale}%` }} data-side={g.side} />
                </span>
                <span>{r.phrase}</span>
                <span className="taste-dim" title="logits">
                  {g.sign}
                  {r.share.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </Fragment>
      ))}
      <p className="taste-credit">
        <a href={data.link} target="_blank" rel="noreferrer">
          {data.credit}
        </a>
      </p>
    </div>
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
