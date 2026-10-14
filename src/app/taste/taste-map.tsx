"use client";

import Image from "next/image";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { Domain } from "./domains";
import { answers, type Placement, type QuestionMap } from "./map";
import { DOMAIN_NOUN } from "./readout";

// Categorical slots, biggest group first. Eight can't all be told apart pairwise in a scatter, so
// every group also carries a direct label on the map and a legend entry that isolates it.
const COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const DOT = 2.6;
const EDGE = 12;
const HIT = 16; // px: the pointer picks the nearest dot within this distance
const LABEL_SIZE = 11;

type Size = { width: number; height: number };
type Target = { kind: "item"; item: number } | { kind: "you" };
type Swipe = { item: number; like: boolean };

/** UMAP's axes mean nothing, but its distances do, so both axes share one scale. */
function projector(map: QuestionMap, width: number) {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const p of map.points) {
    xMin = Math.min(xMin, p.x);
    xMax = Math.max(xMax, p.x);
    yMin = Math.min(yMin, p.y);
    yMax = Math.max(yMax, p.y);
  }
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const height = Math.round(Math.min(0.95, Math.max(0.62, yRange / xRange)) * width);
  const scale = Math.min((width - 2 * EDGE) / xRange, (height - 2 * EDGE) / yRange);
  const dx = (width - xRange * scale) / 2;
  const dy = (height - yRange * scale) / 2;
  return {
    size: { width, height },
    project: (x: number, y: number): [number, number] => [dx + (x - xMin) * scale, height - dy - (y - yMin) * scale],
  };
}

function usePlotWidth(initial: number) {
  const [width, setWidth] = useState(initial);
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  // Measured once on attach too: the observer only reports while the page is rendering frames.
  const ref = useCallback((el: HTMLDivElement | null) => {
    setNode(el);
    const w = el ? Math.round(el.getBoundingClientRect().width) : 0;
    if (w > 0) setWidth(w);
  }, []);
  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setWidth(w);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [width, ref] as const;
}

type Spot = { c: number; x: number; y: number; width: number };

/** Each group's label goes on its medoid dot, the one closest on the map to the rest of its group. */
function labelAnchors(map: QuestionMap, screen: Float64Array, size: Size): Spot[] {
  return map.clusters.map((cluster, c) => {
    const members = map.points.flatMap((p, k) => (p.cluster === c ? [k] : []));
    let best = members[0];
    let bestCost = Infinity;
    for (const a of members) {
      let cost = 0;
      for (const b of members) cost += Math.hypot(screen[2 * a] - screen[2 * b], screen[2 * a + 1] - screen[2 * b + 1]);
      if (cost < bestCost) [best, bestCost] = [a, cost];
    }
    const width = cluster.name.length * LABEL_SIZE * 0.56;
    const x = Math.min(size.width - width / 2 - 2, Math.max(width / 2 + 2, screen[2 * best]));
    return { c, x, y: screen[2 * best + 1] - 8, width };
  });
}

/** Labels move down, top first, until they clear the ones above them and the "You" marker. */
function placeLabels(anchors: Spot[], size: Size, you: readonly [number, number] | null) {
  const placed: Spot[] = you ? [{ c: -1, x: you[0] + 15, y: you[1] + 4, width: 46 }] : [];
  const out: Spot[] = [];
  for (const anchor of [...anchors].sort((a, b) => a.y - b.y)) {
    const spot = { ...anchor };
    while (placed.some((p) => Math.abs(p.x - spot.x) < (p.width + spot.width) / 2 && Math.abs(p.y - spot.y) < LABEL_SIZE + 2)) {
      spot.y += 3;
    }
    spot.y = Math.min(size.height - 4, Math.max(LABEL_SIZE, spot.y));
    placed.push(spot);
    out.push(spot);
  }
  return out;
}

/** Drawn once per map and size; highlighting only changes each group's opacity. */
const Dots = memo(function Dots({ map, screen, active }: { map: QuestionMap; screen: Float64Array; active: number | null }) {
  const groups = useMemo(() => {
    const out = map.clusters.map(() => [] as ReactNode[]);
    map.points.forEach((p, k) => out[p.cluster].push(<circle key={p.item} cx={screen[2 * k]} cy={screen[2 * k + 1]} r={DOT} />));
    return out;
  }, [map, screen]);
  return groups.map((circles, c) => (
    <g key={c} fill={COLORS[c % COLORS.length]} opacity={active === null || active === c ? 0.9 : 0.12}>
      {circles}
    </g>
  ));
});

export function TasteMap({
  domain,
  map,
  you,
  swipes,
  fresh,
}: {
  domain: Domain;
  map: QuestionMap;
  /** Where the profile on show places the user, or null before it has a direction. */
  you: Placement | null;
  /** The swipes the profile on show was fitted to. */
  swipes: Swipe[];
  /** True while the profile is still the population prior (no swipes or edits shown yet). */
  fresh: boolean;
}) {
  const items = map.model.artifact.items;
  const noun = DOMAIN_NOUN[domain];
  const [width, plotRef] = usePlotWidth(544);
  const [hover, setHover] = useState<Target | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [legendHover, setLegendHover] = useState<number | null>(null);
  const [locked, setLocked] = useState<number | null>(null);
  const active = legendHover ?? locked;

  const { size, project } = useMemo(() => projector(map, width), [map, width]);
  const screen = useMemo(() => {
    const out = new Float64Array(2 * map.points.length);
    map.points.forEach((p, k) => ([out[2 * k], out[2 * k + 1]] = project(p.x, p.y)));
    return out;
  }, [map, project]);
  const anchors = useMemo(() => labelAnchors(map, screen, size), [map, screen, size]);
  const youAt = useMemo(() => you && project(you.x, you.y), [you, project]);
  const labels = useMemo(() => placeLabels(anchors, size, youAt), [anchors, size, youAt]);

  const nearest = (event: MouseEvent<SVGSVGElement>): Target | null => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) * size.width) / box.width;
    const y = ((event.clientY - box.top) * size.height) / box.height;
    if (youAt && Math.hypot(youAt[0] - x, youAt[1] - y) < HIT) return { kind: "you" };
    let best = -1;
    let bestDistance = HIT;
    for (let k = 0; k < map.points.length; k++) {
      if (active !== null && map.points[k].cluster !== active) continue;
      const d = Math.hypot(screen[2 * k] - x, screen[2 * k + 1] - y);
      if (d < bestDistance) [best, bestDistance] = [k, d];
    }
    return best < 0 ? null : { kind: "item", item: map.points[best].item };
  };

  const at = (item: number) => {
    const k = map.indexOf(item);
    return [screen[2 * k], screen[2 * k + 1]] as const;
  };
  const hovered = hover?.kind === "item" ? hover.item : null;
  const tip = hover && (hover.kind === "you" ? youAt : at(hover.item));

  const youLine =
    you === null ? (
      <>You&rsquo;ll appear on the map at the first update.</>
    ) : (
      <>
        {fresh ? `Before any swipes, “You” is where most people’s taste points: ` : "You sit "}
        in <strong>{map.clusters[you.cluster].name}</strong>, nearest to{" "}
        {you.near.slice(0, 3).map((item, i) => (
          <span key={item}>
            {i > 0 && (i === 2 ? ", and " : ", ")}
            <button className="taste-link" onClick={() => setSelected(item)}>
              {items[item].title}
            </button>
          </span>
        ))}
        .
      </>
    );

  return (
    <section className="taste-map" aria-label="Map of the catalog">
      <h2>Map of the catalog</h2>
      <p className="taste-note">
        Every one of the {map.points.length.toLocaleString("en-US")} {noun}, placed by its answers to the questions, so {noun} that
        answer alike sit together (UMAP). The colors are {map.clusters.length} groups found in those same answers (Leiden). Hover a
        dot to see what it is; click it to read its answers.
      </p>

      <ul className="taste-legend" aria-label="Groups">
        {map.clusters.map((cluster, c) => (
          <li key={cluster.center}>
            <button
              aria-pressed={locked === c}
              onMouseEnter={() => setLegendHover(c)}
              onMouseLeave={() => setLegendHover(null)}
              onFocus={() => setLegendHover(c)}
              onBlur={() => setLegendHover(null)}
              onClick={() => setLocked(locked === c ? null : c)}
            >
              <span className="taste-swatch" style={{ background: COLORS[c % COLORS.length] }} aria-hidden="true" />
              {cluster.name}
              <span className="taste-dim">{cluster.size}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="taste-plot" ref={plotRef} style={{ height: size.height }}>
        <svg
          viewBox={`0 0 ${size.width} ${size.height}`}
          role="img"
          aria-label={`A map of ${map.points.length} ${noun} in ${map.clusters.length} groups${you ? `, with you in ${map.clusters[you.cluster].name}` : ""}.`}
          onPointerMove={(event) => event.pointerType === "mouse" && setHover(nearest(event))}
          onPointerLeave={() => setHover(null)}
          onClick={(event) => {
            const target = nearest(event);
            if (target?.kind === "item") setSelected(target.item);
          }}
          data-pointing={hover ? "" : undefined}
        >
          <Dots map={map} screen={screen} active={active} />
          {swipes.map(({ item, like }) => {
            if (map.indexOf(item) < 0) return null;
            const [x, y] = at(item);
            return like ? (
              <circle key={item} className="taste-mark" cx={x} cy={y} r={DOT + 2} />
            ) : (
              <path key={item} className="taste-mark" d={`M${x - 3} ${y - 3}L${x + 3} ${y + 3}M${x + 3} ${y - 3}L${x - 3} ${y + 3}`} />
            );
          })}
          {labels.map(({ c, x, y }) => (
            <text
              key={c}
              className="taste-map-label"
              x={x}
              y={y}
              fontSize={LABEL_SIZE}
              opacity={active === null || active === c ? 1 : 0.35}
            >
              {map.clusters[c].name}
            </text>
          ))}
          {selected !== null && map.pointOf(selected) && (
            <circle
              className="taste-ring"
              cx={at(selected)[0]}
              cy={at(selected)[1]}
              r={DOT * 2.6}
              stroke={COLORS[map.pointOf(selected)!.cluster % COLORS.length]}
              strokeWidth={2}
            />
          )}
          {hovered !== null && <circle className="taste-ring" cx={at(hovered)[0]} cy={at(hovered)[1]} r={DOT * 2} strokeWidth={1.5} />}
          {youAt && (
            <g className="taste-you" style={{ transform: `translate(${youAt[0]}px, ${youAt[1]}px)` }}>
              <circle r={6.5} />
              <text x={10} y={4}>
                You
              </text>
            </g>
          )}
        </svg>
        {hover && tip && (
          <div
            className="taste-tip"
            style={{ left: tip[0], top: tip[1] }}
            data-flip={tip[0] > size.width * 0.6 || undefined}
            data-below={tip[1] < 70 || undefined}
            aria-hidden="true"
          >
            {hover.kind === "you" ? (
              <>
                <strong>You</strong>
                <span className="taste-dim">
                  Your taste as a point in question-space, placed among the {map.artifact.neighbors} {noun} whose answers are closest
                  to it.
                </span>
              </>
            ) : (
              <>
                <strong>{items[hover.item].title}</strong>
                <span className="taste-dim">{items[hover.item].subtitle}</span>
                <span className="taste-tip-group">
                  <span
                    className="taste-key"
                    style={{ background: COLORS[map.pointOf(hover.item)!.cluster % COLORS.length] }}
                    aria-hidden="true"
                  />
                  {map.clusters[map.pointOf(hover.item)!.cluster].name}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <p className="taste-map-keys taste-dim" aria-hidden="true">
        <span className="taste-key-you" /> you
        {swipes.length > 0 && (
          <>
            <span className="taste-key-like" /> liked <span className="taste-key-nope">×</span> passed
          </>
        )}
      </p>

      <div className="taste-map-detail" aria-live="polite">
        {active !== null ? (
          <p>
            <strong>{map.clusters[active].name}</strong>: {map.clusters[active].traits.join(", ")}. Most central:{" "}
            {map.examples[active].slice(0, 3).map((item, i) => (
              <span key={item}>
                {i > 0 && (i === 2 ? ", and " : ", ")}
                <button className="taste-link" onClick={() => setSelected(item)}>
                  {items[item].title}
                </button>
              </span>
            ))}
            .
          </p>
        ) : (
          <p>{youLine}</p>
        )}
      </div>

      {selected !== null && (
        <Answers
          key={selected}
          domain={domain}
          map={map}
          item={selected}
          color={COLORS[(map.pointOf(selected)?.cluster ?? 0) % COLORS.length]}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}

/** Every shown question and this item's answer, in a panel of its own that scrolls. */
function Answers({
  domain,
  map,
  item,
  color,
  onClose,
}: {
  domain: Domain;
  map: QuestionMap;
  item: number;
  color: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const data = map.model.artifact.items[item];
  const point = map.pointOf(item);
  const groups = useMemo(() => answers(map.model, item), [map, item]);
  const count = groups.reduce((n, g) => n + g.rows.length, 0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, []);

  return (
    <div className="taste-answers" ref={ref} role="region" aria-label={`Answers for ${data.title}`}>
      <header>
        {data.image && (
          <span className="taste-answers-image">
            <Image src={`/taste/image/${domain}/${data.id}`} alt="" fill unoptimized sizes="3rem" />
          </span>
        )}
        <span>
          <strong>{data.title}</strong>
          <span className="taste-dim"> {data.subtitle}</span>
          {point && (
            <span className="taste-tip-group">
              <span className="taste-key" style={{ background: color }} aria-hidden="true" />
              {map.clusters[point.cluster].name}
            </span>
          )}
        </span>
        <button className="taste-link" onClick={onClose}>
          close
        </button>
      </header>
      <p className="taste-note">
        Its answers to all {count} questions, as the model reads them. Scales show where the answer falls between the lowest and
        highest level; choices show how sure the answerer was.
      </p>
      {/* Arrow keys scroll this list instead of swiping. */}
      <div className="taste-answers-list" tabIndex={0} data-own-keys aria-label="Questions and answers">
        {groups.map((group) => (
          <section key={group.name}>
            <h3>{group.name}</h3>
            <dl>
              {group.rows.map((row) => (
                <div key={row.question} className="taste-answer">
                  <dt>{row.text}</dt>
                  <dd>
                    <span>{row.answer}</span>
                    {row.kind === "score" ? (
                      <span className="taste-scale" title={`${Math.round(100 * row.value)}% of the way up`} aria-hidden="true">
                        <span style={{ left: `${100 * row.value}%` }} />
                      </span>
                    ) : (
                      <span className="taste-dim">{Math.round(100 * row.value)}%</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
