"use client";

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { bisector, line, max, pointer, scaleLinear, scaleTime, timeFormat, type ScaleLinear, type ScaleTime } from "d3";
import { monthDate, partialMonth } from "./months";
import type { Source, WordSeries } from "./types";
import { CONTROL_COLOR, CONTROL_WORDS, NAMED_CONTROLS, SHIP_COLORS, SHIP_WORDS, VOLUME_COLOR } from "./words";

type Metric = "rate" | "count";

type LineSeries = {
  id: string;
  color: string;
  values: number[];
};

const monthFormat = timeFormat("%b %Y");
const yearFormat = timeFormat("%Y");
const countFormat = new Intl.NumberFormat("en-US");
const rateFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rateFormatCoarse = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

const bisectMonth = bisector<string, Date>((month) => monthDate(month)).center;

function formatMetric(value: number, metric: Metric) {
  if (metric === "count") return countFormat.format(Math.round(value));
  return value >= 10 ? rateFormatCoarse.format(value) : rateFormat.format(value);
}

function formatTick(value: number, metric: Metric) {
  if (metric === "count") {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}m`;
    if (value >= 1000) return `${Math.round(value / 100) / 10}k`;
    return String(Math.round(value));
  }
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 10) / 10);
}

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const next = Math.round(element.clientWidth);
      if (next < 40) return;
      setWidth((current) => (current === next ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}

function yScale(values: number[][], height: number, marginBottom: number, marginTop: number) {
  const peak = max(values, (series) => max(series) ?? 0) ?? 0;
  const scale = scaleLinear()
    .domain([0, peak > 0 ? peak * 1.08 : 1])
    .nice()
    .range([height - marginBottom, marginTop]);
  if (scale.domain()[0] < 0) scale.domain([0, scale.domain()[1]]);
  return scale;
}

function Plot({
  months,
  lines,
  height,
  activeIndex,
  onActiveIndex,
  frame,
  axisLeft,
  metric,
  label,
}: {
  months: string[];
  lines: LineSeries[];
  height: number;
  activeIndex: number;
  onActiveIndex: (index: number) => void;
  frame: "hero" | "band" | "spark";
  axisLeft: number;
  metric: Metric;
  label: string;
}) {
  const [frameRef, width] = useElementWidth<HTMLDivElement>();
  const clipId = useId().replace(/:/g, "");
  const margin =
    frame === "spark"
      ? { top: 8, right: 4, bottom: 6, left: 4 }
      : frame === "band"
        ? { top: 8, right: 12, bottom: 4, left: axisLeft }
        : { top: 20, right: 12, bottom: 28, left: axisLeft };
  const showAxis = frame === "hero";

  const geometry = useMemo(() => {
    if (!width || lines.length === 0 || months.length === 0) return null;
    const x = scaleTime()
      .domain([monthDate(months[0]), monthDate(months[months.length - 1])])
      .range([margin.left, width - margin.right]);
    const y = yScale(
      lines.map((series) => series.values),
      height,
      margin.bottom,
      margin.top,
    );
    const path = line<number>()
      .x((_, index) => x(monthDate(months[index])))
      .y((value) => y(value));
    return {
      x,
      y,
      paths: lines.map((series) => ({ ...series, d: path(series.values) ?? "" })),
    };
  }, [width, lines, months, height, margin.left, margin.right, margin.bottom, margin.top]);

  function hover(event: ReactPointerEvent<SVGSVGElement>, x: ScaleTime<number, number>) {
    const [px] = pointer(event);
    if (px < margin.left || px > (width ?? 0) - margin.right) return;
    const index = bisectMonth(months, x.invert(px));
    onActiveIndex(Math.max(0, Math.min(months.length - 1, index)));
  }

  function step(delta: number) {
    onActiveIndex(Math.max(0, Math.min(months.length - 1, activeIndex + delta)));
  }

  return (
    <div className="shipped-plot" ref={frameRef} style={{ minHeight: height }}>
      {width && geometry ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={label}
          tabIndex={showAxis ? 0 : undefined}
          onPointerDown={(event) => hover(event, geometry.x)}
          onPointerMove={(event) => hover(event, geometry.x)}
          onKeyDown={
            showAxis
              ? (event) => {
                  if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    step(-1);
                  } else if (event.key === "ArrowRight") {
                    event.preventDefault();
                    step(1);
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    onActiveIndex(0);
                  } else if (event.key === "End") {
                    event.preventDefault();
                    onActiveIndex(months.length - 1);
                  }
                }
              : undefined
          }
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={margin.left} y={margin.top} width={Math.max(0, width - margin.left - margin.right)} height={Math.max(0, height - margin.top - margin.bottom)} />
            </clipPath>
          </defs>
          {showAxis
            ? geometry.y.ticks(4).map((tick) => (
                <g key={tick}>
                  <line className="shipped-grid" x1={margin.left} x2={width - margin.right} y1={geometry.y(tick)} y2={geometry.y(tick)} />
                  <text className="shipped-tick" x={margin.left - 8} y={geometry.y(tick)} dy="0.32em" textAnchor="end">
                    {formatTick(tick, metric)}
                  </text>
                </g>
              ))
            : null}
          <line
            className="shipped-baseline"
            x1={margin.left}
            x2={width - margin.right}
            y1={geometry.y(0)}
            y2={geometry.y(0)}
          />
          <g clipPath={`url(#${clipId})`}>
            {geometry.paths.map((series) => (
              <path key={series.id} className="shipped-series" d={series.d} stroke={series.color} />
            ))}
          </g>
          {showAxis
            ? geometry.x.ticks(width < 520 ? 4 : 7).map((tick) => (
                <text key={tick.toISOString()} className="shipped-tick" x={geometry.x(tick)} y={height - 6} textAnchor="middle">
                  {yearFormat(tick)}
                </text>
              ))
            : null}
          <HoverMarks
            months={months}
            lines={lines}
            activeIndex={activeIndex}
            x={geometry.x}
            y={geometry.y}
            marginTop={margin.top}
            plotBottom={height - margin.bottom}
          />
        </svg>
      ) : null}
    </div>
  );
}

function HoverMarks({
  months,
  lines,
  activeIndex,
  x,
  y,
  marginTop,
  plotBottom,
}: {
  months: string[];
  lines: LineSeries[];
  activeIndex: number;
  x: ScaleTime<number, number>;
  y: ScaleLinear<number, number>;
  marginTop: number;
  plotBottom: number;
}) {
  const month = months[activeIndex];
  if (!month) return null;
  const cx = x(monthDate(month));
  return (
    <g className="shipped-hover" aria-hidden="true">
      <line x1={cx} x2={cx} y1={marginTop} y2={plotBottom} />
      {lines.map((series) => (
        <circle key={series.id} cx={cx} cy={y(series.values[activeIndex] ?? 0)} r={3.25} fill={series.color} />
      ))}
    </g>
  );
}

export function ShippedChart({ series }: { series: WordSeries[] }) {
  const [source, setSource] = useState<Source>("comment");
  const [metric, setMetric] = useState<Metric>("rate");
  const [hidden, setHidden] = useState<string[]>([]);
  const [activeMonth, setActiveMonth] = useState<string | null>(null);

  const current = series.find((entry) => entry.source === source) ?? series[0];
  const month = activeMonth && current.months.includes(activeMonth) ? activeMonth : current.months[current.months.length - 1];
  const activeIndex = Math.max(0, current.months.indexOf(month ?? ""));
  const partial = partialMonth(current.months, current.items);

  const values = useMemo(() => {
    const next: Record<string, number[]> = {};
    for (const [word, counts] of Object.entries(current.words)) {
      next[word] = counts.map((count, index) =>
        metric === "count" || current.items[index] === 0 ? count : (1000 * count) / current.items[index],
      );
    }
    return next;
  }, [current, metric]);

  const shipLines = SHIP_WORDS.filter((word) => values[word] && !hidden.includes(word)).map((word) => ({
    id: word,
    color: SHIP_COLORS[word],
    values: values[word],
  }));
  const controls = [
    ...CONTROL_WORDS.filter((word) => values[word]),
    ...Object.keys(values).filter((word) => !SHIP_WORDS.includes(word as (typeof SHIP_WORDS)[number]) && !CONTROL_WORDS.includes(word as (typeof CONTROL_WORDS)[number])),
  ];

  const sourceLabel = source === "comment" ? "comments" : "story titles";
  const axisLeft = metric === "count" ? 48 : 36;
  const metricLabel = metric === "rate" ? `Mentions per 1,000 ${sourceLabel}` : `${source === "comment" ? "Comments" : "Story titles"} containing the word`;

  function toggleWord(word: string) {
    setHidden((currentHidden) =>
      currentHidden.includes(word) ? currentHidden.filter((item) => item !== word) : [...currentHidden, word],
    );
  }

  return (
    <div className="shipped-chart">
      <div className="shipped-switches">
        <div className="shipped-switch" role="group" aria-label="Source">
          <button type="button" aria-pressed={source === "comment"} onClick={() => setSource("comment")}>
            Comments
          </button>
          <button type="button" aria-pressed={source === "title"} onClick={() => setSource("title")}>
            Titles
          </button>
        </div>
        <div className="shipped-switch" role="group" aria-label="Measure">
          <button type="button" aria-pressed={metric === "rate"} onClick={() => setMetric("rate")}>
            Per 1,000
          </button>
          <button type="button" aria-pressed={metric === "count"} onClick={() => setMetric("count")}>
            Count
          </button>
        </div>
      </div>

      <p className="shipped-ylab">{metricLabel}</p>
      {shipLines.length > 0 ? (
        <Plot
          months={current.months}
          lines={shipLines}
          height={320}
          activeIndex={activeIndex}
          onActiveIndex={(index) => setActiveMonth(current.months[index] ?? null)}
          frame="hero"
          axisLeft={axisLeft}
          metric={metric}
          label={`Ship words in Hacker News ${sourceLabel} over time. Left and right arrow keys move between months.`}
        />
      ) : (
        <p className="shipped-empty">Choose a word to draw its line.</p>
      )}

      <div className="shipped-legend" role="group" aria-label="Ship words">
        {SHIP_WORDS.filter((word) => values[word]).map((word) => {
          const on = !hidden.includes(word);
          return (
            <button key={word} type="button" aria-pressed={on} onClick={() => toggleWord(word)}>
              <span className="shipped-swatch" style={{ background: on ? SHIP_COLORS[word] : undefined }} />
              <span>{word}</span>
              <span className="shipped-legend-value">{formatMetric(values[word][activeIndex] ?? 0, metric)}</span>
            </button>
          );
        })}
      </div>
      <p className="shipped-when">
        <time dateTime={month}>{month ? monthFormat(monthDate(month)) : ""}</time>
        <span>
          {countFormat.format(current.items[activeIndex] ?? 0)} {sourceLabel}
        </span>
        {partial === month ? <span>Partial month</span> : null}
      </p>

      <div className="shipped-volume">
        <div className="shipped-cell-label">
          <span>Posts</span>
          <span className="shipped-cell-value">{countFormat.format(current.items[activeIndex] ?? 0)}</span>
        </div>
        <Plot
          months={current.months}
          lines={[{ id: "posts", color: VOLUME_COLOR, values: current.items }]}
          height={64}
          activeIndex={activeIndex}
          onActiveIndex={(index) => setActiveMonth(current.months[index] ?? null)}
          frame="band"
          axisLeft={axisLeft}
          metric="count"
          label={`Number of ${sourceLabel} each month`}
        />
      </div>

      <h2>Control words</h2>
      <p className="shipped-section-note">Each panel has its own vertical scale, starting at zero. The number is the selected month.</p>
      <div className="shipped-multiples">
        {controls.map((word) => (
          <div key={word} className={NAMED_CONTROLS.has(word) ? "shipped-cell is-named" : "shipped-cell"}>
            <div className="shipped-cell-label">
              <span>{word}</span>
              <span className="shipped-cell-value">{formatMetric(values[word][activeIndex] ?? 0, metric)}</span>
            </div>
            <Plot
              months={current.months}
              lines={[{ id: word, color: CONTROL_COLOR, values: values[word] }]}
              height={68}
              activeIndex={activeIndex}
              onActiveIndex={(index) => setActiveMonth(current.months[index] ?? null)}
              frame="spark"
              axisLeft={0}
              metric={metric}
              label={`${word} in Hacker News ${sourceLabel}, ${formatMetric(values[word][activeIndex] ?? 0, metric)} in ${month ? monthFormat(monthDate(month)) : "the selected month"}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
