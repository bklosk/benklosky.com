import type { Feature, Posterior, TasteModel } from "./model";

/**
 * Turn the posterior into English. Every sentence is computed from the model:
 * a trait is claimed only when its posterior interval excludes zero and its
 * size passes the threshold set from real users (see build.py), so the
 * profile never says more than the model has learned. Features from hidden
 * questions still shape predictions but are never named.
 */

export type Trait = {
  feature: number;
  /** Slope of the model's score on this feature, in logits per sd. */
  mean: number;
  sd: number;
  strong: boolean;
  /** The phrase for the side the user leans toward, and the verb to use. */
  phrase: string;
  verb: "prefer" | "avoid";
  /** Whether the population prior already leans this way on its own. */
  shared: boolean;
  pinned: boolean;
};

export type Unsure = { feature: number; topic: string; sd: number };

export const DOMAIN_NOUN: Record<string, string> = { movies: "films", books: "books", art: "works" };

export function phrasing(f: Feature, mean: number): { phrase: string; verb: "prefer" | "avoid" } {
  if (f.kind === "score") return { phrase: mean > 0 ? f.pos : f.neg, verb: "prefer" };
  return { phrase: f.pos, verb: mean > 0 ? "prefer" : "avoid" };
}

export function sentence(t: Pick<Trait, "strong" | "verb" | "phrase">) {
  if (t.verb === "prefer") return `${t.strong ? "strongly prefer" : "lean toward"} ${t.phrase}`;
  return `${t.strong ? "steer clear of" : "tend to avoid"} ${t.phrase}`;
}

export function profile(model: TasteModel, post: Posterior, pinned: Set<number>, limit = 10) {
  const { z, min, strong, dedupe } = model.artifact.readout;
  const { F, C } = model;
  const features = model.artifact.features;

  const credible: number[] = [];
  for (let j = 0; j < F; j++) {
    if (features[j].hidden) continue;
    const m = post.traitMean[j];
    if (Math.abs(m) >= min && Math.abs(m) >= z * post.traitSd[j]) credible.push(j);
  }
  // The user's own edits come first, so a correlated trait never hides one they set.
  credible.sort(
    (a, b) => Number(pinned.has(b)) - Number(pinned.has(a)) || Math.abs(post.traitMean[b]) - Math.abs(post.traitMean[a]),
  );

  // Correlated features say the same thing twice; keep the strongest of each cluster.
  const traits: Trait[] = [];
  const shown: number[] = [];
  for (const j of credible) {
    if (shown.some((k) => Math.abs(C[j * F + k]) >= dedupe)) continue;
    shown.push(j);
    const m = post.traitMean[j];
    const p0 = model.priorTraitMean[j];
    traits.push({
      feature: j,
      mean: m,
      sd: post.traitSd[j],
      strong: Math.abs(m) >= strong,
      ...phrasing(features[j], m),
      shared: Math.sign(p0) === Math.sign(m) && Math.abs(p0) >= min && Math.abs(p0) >= z * model.priorTraitSd[j],
      pinned: pinned.has(j),
    });
    if (traits.length >= limit) break;
  }

  // "Not sure yet": where people differ most and these swipes haven't settled it.
  const unsure: Unsure[] = [];
  const open: number[] = [];
  const order = Array.from({ length: F }, (_, j) => j)
    .filter((j) => !features[j].hidden && !credible.includes(j) && !pinned.has(j))
    .sort((a, b) => post.traitSd[b] - post.traitSd[a]);
  for (const j of order) {
    if (open.some((k) => Math.abs(C[j * F + k]) >= dedupe) || shown.some((k) => Math.abs(C[j * F + k]) >= dedupe)) continue;
    open.push(j);
    unsure.push({ feature: j, topic: features[j].topic, sd: post.traitSd[j] });
    if (unsure.length >= 3) break;
  }
  return { traits, unsure };
}

export function summary(traits: Trait[], unsure: Unsure[], swipes: number) {
  if (!traits.length) {
    return swipes === 0
      ? "Nothing yet. Swipe and the model will say what it has learned, and only that."
      : `Nothing it's sure of yet after ${swipes} swipe${swipes === 1 ? "" : "s"}.`;
  }
  const top = traits.slice(0, 3).map(sentence);
  const list = top.length > 1 ? `${top.slice(0, -1).join(", ")} and ${top[top.length - 1]}` : top[0];
  const doubt = unsure.length ? `; not sure yet about ${unsure[0].topic}` : "";
  return `You ${list}${doubt}.`;
}

/** Group per-feature parts by question and return the biggest, phrased for the item's side. */
export function topReasons(model: TasteModel, parts: Float64Array, item: number, count: number, sign: 1 | -1 = 1) {
  const features = model.artifact.features;
  const byQuestion = new Map<string, { total: number; best: number; bestPart: number }>();
  for (let j = 0; j < model.F; j++) {
    if (features[j].hidden) continue;
    const part = parts[j + 1] * sign;
    const q = features[j].question;
    const entry = byQuestion.get(q) ?? { total: 0, best: -1, bestPart: -Infinity };
    entry.total += part;
    // A choice option can only describe the item if the item has it.
    const describes = features[j].kind === "score" || model.X[item * model.D + j + 1] > 0;
    if (describes && part > entry.bestPart) {
      entry.best = j;
      entry.bestPart = part;
    }
    byQuestion.set(q, entry);
  }
  return [...byQuestion.values()]
    .filter((e) => e.total > 0 && e.best >= 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, count)
    .map((e) => {
      const f = features[e.best];
      const x = model.X[item * model.D + e.best + 1];
      return { feature: e.best, share: e.total, phrase: f.kind === "score" ? (x > 0 ? f.pos : f.neg) : f.pos };
    });
}
