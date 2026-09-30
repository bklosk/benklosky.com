"use client";

import { useMemo, useState } from "react";

export type ClusterMark = {
  label: string;
  mean: number;
  overall: number;
};

export type Cluster = {
  id: string;
  label: string;
  count: number;
  color: string;
  marks: ClusterMark[];
};

export type ClusterMapData = {
  patients: number;
  scores: number;
  clusters: Cluster[];
  points: number[][];
};

export function ClusterMap({ data }: { data: ClusterMapData }) {
  const [hover, setHover] = useState<number | null>(null);
  const [locked, setLocked] = useState<number | null>(null);
  const active = locked ?? hover;

  const bounds = useMemo(() => {
    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const point of data.points) {
      xMin = Math.min(xMin, point[0]);
      xMax = Math.max(xMax, point[0]);
      yMin = Math.min(yMin, point[1]);
      yMax = Math.max(yMax, point[1]);
    }
    const padX = (xMax - xMin) * 0.07;
    const padY = (yMax - yMin) * 0.07;
    return {
      xMin: xMin - padX,
      yMin: yMin - padY,
      width: xMax - xMin + padX * 2,
      height: yMax - yMin + padY * 2,
      yFlip: yMin + yMax,
    };
  }, [data.points]);

  const radius = Math.min(bounds.width, bounds.height) * 0.0085;

  function show(index: number) {
    if (locked === null) setHover(index);
  }

  function lock(index: number) {
    setHover(null);
    setLocked((current) => (current === index ? null : index));
  }

  return (
    <div className="embeddings-page">
      <p className="embeddings-lead">
        {data.patients.toLocaleString("en-US")} patients. Each dot averages that person&apos;s charts
        into {data.scores} scores. Nearby dots had similar charts. The colors are{" "}
        {data.clusters.length} k-means groups.
      </p>
      <div className="embeddings-layout">
        <div className={`embeddings-plot${active === null ? "" : " is-active"}`}>
          <svg
            viewBox={`${bounds.xMin} ${bounds.yMin} ${bounds.width} ${bounds.height}`}
            aria-hidden="true"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setLocked(null);
                setHover(null);
              }
            }}
          >
            {data.points.map((point, index) => {
              const cluster = point[2];
              const on = active === cluster;
              return (
                <circle
                  key={index}
                  cx={point[0]}
                  cy={bounds.yFlip - point[1]}
                  r={on ? radius * 1.35 : radius}
                  fill={data.clusters[cluster].color}
                  className={on ? "is-on" : undefined}
                  onPointerEnter={(event) => {
                    if (event.pointerType === "mouse") show(cluster);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    lock(cluster);
                  }}
                />
              );
            })}
          </svg>
        </div>
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
                  onClick={() => lock(index)}
                >
                  <span className="embeddings-swatch" style={{ background: cluster.color }} />
                  <span className="embeddings-group-name">{cluster.label}</span>
                  <span className="embeddings-group-count">{cluster.count.toLocaleString("en-US")}</span>
                </button>
                {selected && (
                  <div className="embeddings-marks">
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
                    <p className="embeddings-mark-note">Bar is this group&apos;s mean score. Tick is every patient.</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
