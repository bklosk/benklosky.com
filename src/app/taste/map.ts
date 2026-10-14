import type { Posterior, TasteModel } from "./model";

/**
 * The catalog map from scripts/taste/map.py: a UMAP layout of every item in
 * question-space, and the groups Leiden found there. The user is placed the
 * same way: their taste becomes a point in question-space, and UMAP's own rule
 * for a new sample puts it among its nearest items.
 */

export type MapCluster = {
  name: string;
  center: string;
  size: number;
  /** The group's most distinctive answers, as profile phrases. */
  traits: string[];
  /** Its most central items, by id. */
  examples: string[];
};

export type MapArtifact = {
  domain: string;
  model: number;
  neighbors: number;
  method: { resolution: number; stability: number; drift: number };
  clusters: MapCluster[];
  /** [item id, x, y, cluster] */
  points: [string, number, number, number][];
};

/**
 * The odds are cubed so the average leans on the items the model is surest about: a few hundred of
 * them rather than the whole catalog. Plain odds put a synthetic horror fan among dark thrillers;
 * cubed, each of five one-genre users lands in its own group.
 */
const SHARPEN = 3;

export type MapPoint = { item: number; x: number; y: number; cluster: number };

export type Placement = {
  x: number;
  y: number;
  /** The neighbors it was placed among, nearest first. */
  near: number[];
  /** The group holding most of the placement's weight. */
  cluster: number;
};

export class QuestionMap {
  /** One per catalog item the map knows, in map order. */
  readonly points: MapPoint[];
  readonly clusters: MapCluster[];
  private readonly at = new Map<number, number>();
  /** Centered question-space rows (points × shown features), and their lengths. */
  private readonly Q: Float64Array;
  private readonly norms: Float64Array;
  private readonly width: number;
  private readonly typical: number;

  constructor(
    readonly model: TasteModel,
    readonly artifact: MapArtifact,
  ) {
    const index = new Map(model.artifact.items.map((item, i) => [item.id, i]));
    this.points = artifact.points.flatMap(([id, x, y, cluster]) => {
      const item = index.get(id);
      return item === undefined ? [] : [{ item, x, y, cluster }];
    });
    this.points.forEach((p, k) => this.at.set(p.item, k));
    this.clusters = artifact.clusters;

    // Question-space as map.py builds it: answers centered on the catalog, with each choice option
    // scaled by 1/√2 so every question weighs the same. Hidden questions are left out.
    const { D, F, X } = model;
    const { features, std } = model.artifact;
    const columns: number[] = [];
    const scale: number[] = [];
    for (let j = 0; j < F; j++) {
      if (features[j].hidden) continue;
      columns.push(j);
      scale.push(std[j] * (features[j].kind === "score" ? 1 : Math.SQRT1_2));
    }
    const W = columns.length;
    this.width = W;
    this.Q = new Float64Array(this.points.length * W);
    this.norms = new Float64Array(this.points.length);
    this.points.forEach(({ item }, k) => {
      let s = 0;
      for (let c = 0; c < W; c++) {
        const v = X[item * D + columns[c] + 1] * scale[c];
        this.Q[k * W + c] = v;
        s += v * v;
      }
      this.norms[k] = Math.sqrt(s);
    });
    this.typical = [...this.norms].sort((a, b) => a - b)[this.norms.length >> 1] ?? 1;
  }

  /** The item's position in points, or -1 if the map doesn't have it. */
  indexOf(item: number) {
    return this.at.get(item) ?? -1;
  }

  pointOf(item: number) {
    const k = this.indexOf(item);
    return k < 0 ? undefined : this.points[k];
  }

  /**
   * Where the user's taste sits: every item's answers, averaged with weights equal to the cube of the
   * odds the user likes it, then placed from its nearest items by cosine. Null while the taste has no
   * direction yet (art before any swipe, where every item is a coin flip).
   */
  place(post: Posterior): Placement | null {
    const { points, Q, width: W } = this;
    // The predictive's own log-odds (the latent mean, shrunk by its uncertainty), sharpened.
    const logit = points.map(({ item }) => (SHARPEN * post.itemMean[item]) / Math.sqrt(1 + (Math.PI * post.itemVar[item]) / 8));
    const top = Math.max(...logit);
    const u = new Float64Array(W);
    let total = 0;
    for (let k = 0; k < points.length; k++) {
      const w = Math.exp(logit[k] - top);
      total += w;
      for (let c = 0; c < W; c++) u[c] += w * Q[k * W + c];
    }
    let norm = 0;
    for (let c = 0; c < W; c++) norm += (u[c] /= total) ** 2;
    norm = Math.sqrt(norm);
    if (norm < 1e-3 * this.typical) return null;
    const distance = points.map((_, k) => {
      let dot = 0;
      for (let c = 0; c < W; c++) dot += u[c] * Q[k * W + c];
      return 1 - dot / (norm * (this.norms[k] || 1));
    });
    const near = Array.from(points.keys())
      .sort((a, b) => distance[a] - distance[b])
      .slice(0, this.artifact.neighbors);
    const weights = membership(near.map((k) => distance[k]));
    let x = 0;
    let y = 0;
    let sum = 0;
    const byCluster = new Map<number, number>();
    near.forEach((k, n) => {
      x += weights[n] * points[k].x;
      y += weights[n] * points[k].y;
      sum += weights[n];
      byCluster.set(points[k].cluster, (byCluster.get(points[k].cluster) ?? 0) + weights[n]);
    });
    const cluster = [...byCluster].sort((a, b) => b[1] - a[1])[0][0];
    return { x: x / sum, y: y / sum, near: near.map((k) => points[k].item), cluster };
  }
}

/**
 * UMAP's membership strengths for one sample's neighbors: exp(-(d - ρ) / σ), with ρ the nearest
 * distance and σ set so they sum to log₂ k. Mirrors place() in map.py.
 */
export function membership(d: number[]) {
  const rho = Math.min(...d);
  const target = Math.log2(d.length);
  const strengths = (sigma: number) => d.map((v) => Math.exp(-Math.max(v - rho, 0) / sigma));
  let lo = 0;
  let hi = Infinity;
  let sigma = 1;
  for (let i = 0; i < 64; i++) {
    const total = strengths(sigma).reduce((a, b) => a + b, 0);
    if (Math.abs(total - target) < 1e-5) break;
    if (total > target) {
      hi = sigma;
      sigma = (lo + hi) / 2;
    } else {
      lo = sigma;
      sigma = hi === Infinity ? sigma * 2 : (lo + hi) / 2;
    }
  }
  return strengths(sigma);
}

/** One item's answer to every shown question, grouped the way the question bank groups them. */
export function answers(model: TasteModel, item: number) {
  const { D, F, X } = model;
  const { features, mean, std } = model.artifact;
  const raw = (j: number) => X[item * D + j + 1] * std[j] + mean[j];
  const groups: { name: string; rows: Answer[] }[] = [];
  const byQuestion = new Map<string, Answer>();
  for (let j = 0; j < F; j++) {
    const f = features[j];
    if (f.hidden) continue;
    let row = byQuestion.get(f.question);
    if (!row) {
      row = { question: f.question, text: f.text, kind: f.kind, answer: "", value: -1, levels: f.levels };
      byQuestion.set(f.question, row);
      let group = groups.at(-1);
      if (!group || group.name !== f.group) groups.push((group = { name: f.group, rows: [] }));
      group.rows.push(row);
    }
    const v = Math.min(1, Math.max(0, raw(j)));
    if (f.kind === "score") {
      // The expected level, scaled to [0, 1]; its nearest level names it.
      const levels = f.levels ?? [f.neg, f.pos];
      row.value = v;
      row.answer = levels[Math.round(v * (levels.length - 1))];
    } else if (v > row.value) {
      // The most likely option, and how likely the answerer thought it was.
      row.value = v;
      row.answer = f.pos;
    }
  }
  return groups;
}

export type Answer = {
  question: string;
  text: string;
  kind: "score" | "choice";
  answer: string;
  /** Score: expected level in [0, 1]. Choice: the chosen option's probability. */
  value: number;
  levels: string[] | null;
};
