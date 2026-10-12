"use client";

import { createContext, memo, use, useEffect, useMemo, useState, type ReactNode } from "react";

export type ClusterMark = {
  label: string;
  mean: number;
  overall: number;
};

export type ClusterSettings = {
  outpatient: number;
  ed: number;
  inpatient: number;
  icu: number;
};

export type Cluster = {
  id: string;
  label: string;
  count: number;
  color: string;
  findings: number;
  settings: ClusterSettings;
  marks: ClusterMark[];
  examples: string[];
};

export type Question = {
  id: string;
  label: string;
  group: string;
};

export type ClusterMapData = {
  charts: number;
  shown: number;
  scores: number;
  /** What each chart was placed by. Defaults to the presentation scores. */
  placement?: string;
  /** When false, the chart panel does not mark Jev answers as used for the map. */
  answersPlaceChart?: boolean;
  presentation: string[];
  questions: Question[];
  clusters: Cluster[];
  /** [x, y, cluster index, encounter id] */
  points: [number, number, number, number][];
};

type MapId = "jev" | "openai";

type Chart = {
  id: number;
  cluster: number;
  setting: string;
  department: string;
  date: string;
  complaint: string;
  note: string;
  answers: number[];
};

const SETTING_LABELS: [keyof ClusterSettings, string][] = [
  ["outpatient", "Clinic"],
  ["ed", "ED"],
  ["inpatient", "Ward"],
  ["icu", "ICU"],
];

const SETTING_NAMES: Record<string, string> = {
  outpatient: "Clinic visit",
  ed: "Emergency department",
  inpatient: "Ward admission",
  icu: "ICU",
  follow_up: "Follow-up",
  procedure: "Procedure",
  telehealth: "Telehealth",
};

type Selection = {
  hover: number | null;
  locked: number | null;
  chart: number | null;
  chartCluster: number | null;
};

type ClusterState = {
  jev: ClusterMapData;
  openai: ClusterMapData;
  sel: Record<MapId, Selection>;
  show: (source: MapId, index: number | null) => void;
  lock: (source: MapId, index: number | null) => void;
  openChart: (source: MapId, id: number, cluster: number) => void;
  closeChart: (source: MapId) => void;
};

function blankSelection(): Selection {
  return { hover: null, locked: null, chart: null, chartCluster: null };
}

const ClusterContext = createContext<ClusterState | null>(null);

function useClusters() {
  const state = use(ClusterContext);
  if (!state) throw new Error("Cluster components must sit inside ClusterProvider");
  return state;
}

function useMap(source: MapId) {
  const state = useClusters();
  const sel = state.sel[source];
  return {
    data: state[source],
    active: sel.locked ?? sel.hover,
    locked: sel.locked,
    chart: sel.chart,
    chartCluster: sel.chartCluster,
    show: (index: number | null) => state.show(source, index),
    lock: (index: number | null) => state.lock(source, index),
    openChart: (id: number, cluster: number) => state.openChart(source, id, cluster),
    closeChart: () => state.closeChart(source),
  };
}

export function ClusterProvider({
  data,
  openai,
  children,
}: {
  data: ClusterMapData;
  openai: ClusterMapData;
  children: ReactNode;
}) {
  const [sel, setSel] = useState<Record<MapId, Selection>>({
    jev: blankSelection(),
    openai: blankSelection(),
  });

  const state = useMemo<ClusterState>(
    () => ({
      jev: data,
      openai,
      sel,
      show: (source, index) => {
        setSel((current) => {
          const item = current[source];
          if (item.locked !== null || item.hover === index) return current;
          return { ...current, [source]: { ...item, hover: index } };
        });
      },
      lock: (source, index) => {
        setSel((current) => {
          const item = current[source];
          const locked = index === null || item.locked === index ? null : index;
          return {
            ...current,
            [source]: { hover: null, locked, chart: null, chartCluster: null },
          };
        });
      },
      openChart: (source, id, cluster) => {
        setSel((current) => ({
          ...current,
          [source]: { hover: null, locked: cluster, chart: id, chartCluster: cluster },
        }));
      },
      closeChart: (source) => {
        setSel((current) => {
          const item = current[source];
          if (item.chart === null) return current;
          return { ...current, [source]: { ...item, chart: null, chartCluster: null } };
        });
      },
    }),
    [data, openai, sel],
  );

  return <ClusterContext value={state}>{children}</ClusterContext>;
}

/** Inline text that highlights one cluster on the map, e.g. <Cluster id="shock">septic shock</Cluster>. */
export function Cluster({ id, children }: { id: string; children: ReactNode }) {
  const { data, active, locked, show, lock } = useMap("jev");
  const index = data.clusters.findIndex((cluster) => cluster.id === id);
  if (index === -1) throw new Error(`No cluster with id "${id}"`);
  const cluster = data.clusters[index];

  return (
    <button
      type="button"
      className={`embeddings-inline${active === index ? " is-active" : ""}`}
      style={{ textDecorationColor: cluster.color }}
      aria-pressed={locked === index}
      onMouseEnter={() => show(index)}
      onMouseLeave={() => show(null)}
      onClick={() => lock(index)}
    >
      {children}
    </button>
  );
}

type Size = { width: number; height: number };

const DOT_RADIUS = 2.6;
const EDGE = 8;

/** UMAP axes carry no meaning, so the layout is stretched to fill the plot box on both axes. */
function projector(points: ClusterMapData["points"], size: Size) {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const point of points) {
    xMin = Math.min(xMin, point[0]);
    xMax = Math.max(xMax, point[0]);
    yMin = Math.min(yMin, point[1]);
    yMax = Math.max(yMax, point[1]);
  }
  const xScale = (size.width - EDGE * 2) / (xMax - xMin || 1);
  const yScale = (size.height - EDGE * 2) / (yMax - yMin || 1);
  return (x: number, y: number): [number, number] => [
    EDGE + (x - xMin) * xScale,
    EDGE + (yMax - y) * yScale,
  ];
}

function usePlotSize(initial: Size) {
  const [size, setSize] = useState(initial);
  const [node, setNode] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width: Math.round(width), height: Math.round(height) });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [size, setNode] as const;
}

/** Drawn once per dataset and size; hover and selection only toggle styles on the cluster groups. */
const Dots = memo(function Dots({ data, size }: { data: ClusterMapData; size: Size }) {
  const project = projector(data.points, size);
  const groups = data.clusters.map(() => [] as ReactNode[]);
  for (const [x, y, cluster, id] of data.points) {
    const [cx, cy] = project(x, y);
    groups[cluster].push(
      <circle key={id} cx={cx} cy={cy} r={DOT_RADIUS} data-id={id} data-cluster={cluster} />,
    );
  }
  return groups.map((circles, cluster) => (
    <g key={data.clusters[cluster].id} data-group={cluster} fill={data.clusters[cluster].color}>
      {circles}
    </g>
  ));
});

function pointFrom(target: EventTarget) {
  if (!(target instanceof SVGCircleElement) || !target.dataset.id) return null;
  return { id: Number(target.dataset.id), cluster: Number(target.dataset.cluster) };
}

export function ClusterMap({ source = "jev" }: { source?: MapId }) {
  const { data, active, chart, show, lock, openChart } = useMap(source);
  const [size, plotRef] = usePlotSize({ width: 640, height: 512 });
  const selected = chart === null ? undefined : data.points.find((point) => point[3] === chart);
  const selectedAt = selected && projector(data.points, size)(selected[0], selected[1]);
  const placement = data.placement ?? `its ${data.scores} presentation scores`;

  return (
    <figure className="embeddings-figure">
      <div className="embeddings-layout">
        <div
          className="embeddings-plot"
          ref={plotRef}
          data-map={source}
          data-active={active ?? undefined}
        >
          <svg
            viewBox={`0 0 ${size.width} ${size.height}`}
            aria-hidden="true"
            onPointerOver={(event) => {
              if (event.pointerType !== "mouse") return;
              const point = pointFrom(event.target);
              if (point) show(point.cluster);
            }}
            onPointerLeave={() => show(null)}
            onClick={(event) => {
              const point = pointFrom(event.target);
              if (point) openChart(point.id, point.cluster);
              else lock(null);
            }}
          >
            <Dots data={data} size={size} />
            {selected && selectedAt && (
              <circle
                className="embeddings-selected"
                cx={selectedAt[0]}
                cy={selectedAt[1]}
                r={DOT_RADIUS * 2.6}
                stroke={data.clusters[selected[2]].color}
                strokeWidth={1.75}
              />
            )}
          </svg>
          {active !== null && (
            <style>{`.embeddings-plot[data-map="${source}"][data-active="${active}"] g[data-group="${active}"] { opacity: 1; }`}</style>
          )}
        </div>
        <div className="embeddings-panel">
          {chart === null ? <ClusterList source={source} /> : <ChartPanel key={chart} id={chart} source={source} />}
        </div>
      </div>
      <figcaption className="embeddings-caption">
        {data.shown.toLocaleString("en-US")} of {data.charts.toLocaleString("en-US")} charts, each
        placed by {placement} and sampled so small groups stay visible. Nearby dots read alike. Colors
        are {data.clusters.length} k-means groups. Click a dot to read its chart.
      </figcaption>
    </figure>
  );
}

function ClusterList({ source }: { source: MapId }) {
  const { data, active, locked, show, lock } = useMap(source);
  return (
    <div className="embeddings-groups" aria-label="Clusters">
      {data.clusters.map((cluster, index) => {
        const selected = active === index;
        return (
          <div key={cluster.id} className={`embeddings-group${selected ? " is-active" : ""}`}>
            <button
              type="button"
              aria-pressed={locked === index}
              aria-expanded={selected}
              onMouseEnter={() => show(index)}
              onMouseLeave={() => show(null)}
              onClick={() => lock(index)}
            >
              <span className="embeddings-swatch" style={{ background: cluster.color }} />
              <span className="embeddings-group-name">{cluster.label}</span>
              <span className="embeddings-group-count">{cluster.count.toLocaleString("en-US")}</span>
            </button>
            {selected && <ClusterDetail cluster={cluster} />}
          </div>
        );
      })}
    </div>
  );
}

function ClusterDetail({ cluster }: { cluster: Cluster }) {
  return (
    <div className="embeddings-marks">
      <p className="embeddings-detail-line">
        {cluster.findings.toFixed(1)} positive findings per chart
      </p>
      <div className="embeddings-settings" aria-label="Where these charts were written">
        {SETTING_LABELS.map(([key, label]) => (
          <span key={key} className="embeddings-setting">
            <span className="embeddings-setting-label">{label}</span>
            <span className="embeddings-setting-value">{Math.round(cluster.settings[key] * 100)}%</span>
          </span>
        ))}
      </div>
      {cluster.marks.length === 0 ? (
        <p className="embeddings-mark-note">No score stands out. Most are near zero.</p>
      ) : (
        <>
          {cluster.marks.map((mark) => (
            <div key={mark.label} className="embeddings-mark">
              <span className="embeddings-mark-label">{mark.label}</span>
              <span className="embeddings-mark-value">{mark.mean.toFixed(2)}</span>
              <span className="embeddings-mark-track">
                <span
                  className="embeddings-mark-fill"
                  style={{ width: `${mark.mean * 100}%`, background: cluster.color }}
                />
                <span className="embeddings-mark-tick" style={{ left: `${mark.overall * 100}%` }} />
              </span>
            </div>
          ))}
          <p className="embeddings-mark-note">Bar is this group&apos;s mean score. Tick is every chart.</p>
        </>
      )}
      {cluster.examples.length > 0 && (
        <ul className="embeddings-examples" aria-label="Typical chief complaints">
          {cluster.examples.map((example) => (
            <li key={example}>{example}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const chartCache = new Map<number, Chart>();

type ChartLoad = { status: "loading" } | { status: "error" } | { status: "ready"; chart: Chart };

function useChart(id: number): ChartLoad {
  const [load, setLoad] = useState<ChartLoad>(() => {
    const cached = chartCache.get(id);
    return cached ? { status: "ready", chart: cached } : { status: "loading" };
  });

  useEffect(() => {
    if (chartCache.has(id)) return;
    const controller = new AbortController();
    fetch(`/embeddings/charts/${id}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`chart ${id}: ${response.status}`);
        return response.json() as Promise<Chart>;
      })
      .then((chart) => {
        chartCache.set(id, chart);
        setLoad({ status: "ready", chart });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ status: "error" });
      });
    return () => controller.abort();
  }, [id]);

  return load;
}

function ChartPanel({ id, source }: { id: number; source: MapId }) {
  const { data, chartCluster, closeChart } = useMap(source);
  const load = useChart(id);
  const [yesOnly, setYesOnly] = useState(false);

  const header = (
    <button type="button" className="embeddings-back" onClick={closeChart}>
      ← All groups
    </button>
  );

  if (load.status !== "ready") {
    return (
      <div className="embeddings-chart">
        {header}
        <p className="embeddings-chart-status">
          {load.status === "loading" ? "Loading chart…" : "This chart could not be loaded."}
        </p>
      </div>
    );
  }

  const { chart } = load;
  const cluster = data.clusters[chartCluster ?? chart.cluster];
  const marksPlacement = data.answersPlaceChart !== false;
  const used = marksPlacement ? new Set(data.presentation) : new Set<string>();
  const yesCount = chart.answers.filter((value) => value >= 0.5).length;
  const groups: { name: string; rows: { question: Question; value: number }[] }[] = [];
  data.questions.forEach((question, index) => {
    const value = chart.answers[index];
    if (yesOnly && value < 0.5) return;
    let group = groups.at(-1);
    if (!group || group.name !== question.group) {
      group = { name: question.group, rows: [] };
      groups.push(group);
    }
    group.rows.push({ question, value });
  });

  return (
    <div className="embeddings-chart">
      {header}
      <p className="embeddings-chart-cluster">
        <span className="embeddings-swatch" style={{ background: cluster.color }} />
        {cluster.label}
      </p>
      <p className="embeddings-chart-meta">
        {[SETTING_NAMES[chart.setting] ?? chart.setting, chart.department, chart.date]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {chart.complaint && <p className="embeddings-chart-complaint">{chart.complaint}</p>}
      <div className="embeddings-chart-note" tabIndex={0} aria-label="Chart text">
        {chart.note}
      </div>
      <div className="embeddings-answers-head">
        <span>
          {data.questions.length} Jev answers, {yesCount} yes
        </span>
        <button type="button" aria-pressed={yesOnly} onClick={() => setYesOnly((value) => !value)}>
          {yesOnly ? "Show all" : "Yes only"}
        </button>
      </div>
      {groups.map((group) => (
        <section key={group.name} className="embeddings-answer-group">
          <h3>{group.name}</h3>
          {group.rows.map(({ question, value }) => (
            <div
              key={question.id}
              className={`embeddings-answer${value >= 0.5 ? " is-yes" : ""}`}
              title={used.has(question.id) ? "Used to place the chart on the map" : undefined}
            >
              <span className="embeddings-answer-label">
                {question.label}
                {used.has(question.id) && <span className="embeddings-answer-used" aria-label="used for the map" />}
              </span>
              <span className="embeddings-answer-value">{value.toFixed(2)}</span>
              <span className="embeddings-mark-track">
                <span
                  className="embeddings-mark-fill"
                  style={{ width: `${value * 100}%`, background: value >= 0.5 ? cluster.color : "#b9b5ad" }}
                />
              </span>
            </div>
          ))}
        </section>
      ))}
      <p className="embeddings-mark-note">
        {marksPlacement
          ? "A dot marks the 57 answers that place the chart on the map."
          : "The map placed this chart from the note text. These scores are Jev answers for the same chart."}
      </p>
    </div>
  );
}
