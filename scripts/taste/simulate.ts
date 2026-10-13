/**
 * Headless smoke test of the /taste browser logic against a running dev server:
 * a synthetic user with known tastes swipes 30 BALD-picked cards, then we print
 * the readout, recommendations, and what a profile edit does.
 *
 *   bun run dev &
 *   bun scripts/taste/simulate.ts movies '{"tone_melancholy":2,"genre_horror":-2}'
 */
import { bald, predictive, TasteModel, type Artifact, type Observation } from "../../src/app/taste/model";
import { profile, summary, topReasons } from "../../src/app/taste/readout";

const domain = process.argv[2] ?? "movies";
const want: Record<string, number> = JSON.parse(process.argv[3] ?? '{"tone_melancholy":2,"genre_horror":-2}');
const host = process.env.TASTE_HOST ?? "http://localhost:3000";
const [artifact, bin] = await Promise.all([
  fetch(`${host}/taste/data/${domain}`).then((r) => r.json() as Promise<Artifact>),
  fetch(`${host}/taste/data/${domain}/bin`).then((r) => r.arrayBuffer()),
]);
let started = performance.now();
const model = new TasteModel(artifact, bin);
console.log(`loaded in ${(performance.now() - started).toFixed(0)} ms: ${model.N} items, ${model.F} features, rank ${model.K}`);

const utility = (i: number) =>
  artifact.features.reduce((s, f, j) => s + (want[f.option ? `${f.question}:${f.option}` : f.question] ?? 0) * model.X[i * model.D + j + 1], 0);

const observations: Observation[] = [];
const seen = new Set<number>();
let post = model.fit(observations);
for (let k = 1; k <= 30; k++) {
  let best = -1;
  let info = -Infinity;
  for (let i = 0; i < model.N; i++) {
    if (seen.has(i)) continue;
    const b = bald(post.itemMean[i], post.itemVar[i]);
    if (b > info) [best, info] = [i, b];
  }
  seen.add(best);
  const why = topReasons(model, model.varianceParts(post, best), best, 3).map((r) => r.phrase);
  const like = utility(best) > 0;
  observations.push({ kind: "swipe", item: best, like });
  started = performance.now();
  post = model.fit(observations);
  if (k <= 3 || k % 10 === 0) {
    const ms = (performance.now() - started).toFixed(0);
    console.log(`#${k} ${artifact.items[best].title}: ${like ? "like" : "nope"}, ${info.toFixed(2)} bits, refit ${ms} ms; probing ${why.join(" / ")}`);
  }
}
const { traits, unsure } = profile(model, post, new Set());
console.log(summary(traits, unsure, 30));
for (const t of traits) console.log(`  ${t.mean.toFixed(2)} ± ${t.sd.toFixed(2)}  ${t.verb} ${t.phrase}${t.shared ? " (like most people)" : ""}`);
const recs = [...Array(model.N).keys()]
  .filter((i) => !seen.has(i))
  .map((i) => ({ i, p: predictive(post.itemMean[i], post.itemVar[i]) }))
  .sort((a, b) => b.p - a.p)
  .slice(0, 5);
console.log("recommends:", recs.map(({ i, p }) => `${artifact.items[i].title} (${Math.round(100 * p)}%)`).join("; "));

const [question, value] = Object.entries(want).find(([, v]) => v < 0) ?? Object.entries(want)[0];
const j = artifact.features.findIndex((f) => (f.option ? `${f.question}:${f.option}` : f.question) === question);
post = model.fit([...observations, { kind: "pin", feature: j, value: -Math.sign(value) * 1.25 * artifact.readout.strong }]);
const edited = profile(model, post, new Set([j]));
console.log(`after flipping ${question}:`, summary(edited.traits, edited.unsure, 30));
