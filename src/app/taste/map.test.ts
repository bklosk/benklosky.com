import { expect, test } from "bun:test";
import fixture from "./parity.fixture.json";
import { answers, membership, QuestionMap, type MapArtifact } from "./map";
import { TasteModel, type Artifact, type Item, type Posterior } from "./model";

const bin = Uint8Array.from(atob(fixture.bin), (ch) => ch.charCodeAt(0)).buffer;
const [N, F] = fixture.artifact.layout.X as [number, number];
const HIDDEN = 4;

// The fixture's matrices with made-up items and features: odd features are options of one choice.
const model = new TasteModel(
  {
    ...(fixture.artifact as unknown as Artifact),
    items: Array.from({ length: N }, (_, i) => ({ id: `it${i}`, title: `item ${i}` }) as Item),
    features: Array.from({ length: F }, (_, j) => ({
      question: j % 2 ? "choice" : `q${j}`,
      option: j % 2 ? `o${j}` : null,
      kind: j % 2 ? ("choice" as const) : ("score" as const),
      group: j < 5 ? "first" : "second",
      text: `question ${j}`,
      pos: `high ${j}`,
      neg: `low ${j}`,
      topic: `topic ${j}`,
      levels: j % 2 ? null : ["none", "some", "lots"],
      hidden: j === HIDDEN,
    })),
  },
  bin,
);
const artifact: MapArtifact = {
  domain: "test",
  model: 0,
  neighbors: 5,
  method: { resolution: 1, stability: 1, drift: 0 },
  clusters: [0, 1].map((c) => ({ name: `group ${c}`, center: `it${c}`, size: N / 2, traits: [], examples: [`it${c}`] })),
  points: Array.from({ length: N }, (_, i) => [`it${i}`, i % 8, Math.floor(i / 8), i % 2] as [string, number, number, number]),
};
const map = new QuestionMap(model, artifact);

const posterior = (itemMean: (i: number) => number) =>
  ({ itemMean: Float64Array.from({ length: N }, (_, i) => itemMean(i)), itemVar: new Float64Array(N).fill(0.5) }) as Posterior;

test("membership strengths: 1 for the nearest neighbor, log2 k in total", () => {
  const w = membership([0.2, 0.25, 0.4, 0.41, 0.9, 1.3]);
  expect(w[0]).toBeCloseTo(1, 9);
  expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(Math.log2(6), 4);
  for (let i = 1; i < w.length; i++) expect(w[i]).toBeLessThanOrEqual(w[i - 1]);
});

test("a taste with no direction isn't placed", () => {
  expect(map.place(posterior(() => 0))).toBeNull();
});

test("a taste for one item lands on it, among its neighbors", () => {
  const placed = map.place(posterior((i) => (i === 7 ? 30 : 0)))!;
  expect(placed.near[0]).toBe(7);
  expect(placed.near).toHaveLength(5);
  expect(placed.cluster).toBe(1);
  // Inside the hull of the neighbors it was placed among.
  const near = placed.near.map((i) => map.pointOf(i)!);
  expect(placed.x).toBeGreaterThanOrEqual(Math.min(...near.map((p) => p.x)));
  expect(placed.x).toBeLessThanOrEqual(Math.max(...near.map((p) => p.x)));
});

test("answers cover every shown question once, and never a hidden one", () => {
  const groups = answers(model, 3);
  const rows = groups.flatMap((g) => g.rows);
  expect(groups.map((g) => g.name)).toEqual(["first", "second"]);
  expect(rows.some((r) => r.question === `q${HIDDEN}`)).toBe(false);
  expect(new Set(rows.map((r) => r.question)).size).toBe(rows.length);
  for (const r of rows) {
    if (r.kind === "score") expect(["none", "some", "lots"]).toContain(r.answer);
    else expect(r.answer).toMatch(/^high \d$/);
    expect(r.value).toBeGreaterThanOrEqual(0);
    expect(r.value).toBeLessThanOrEqual(1);
  }
});
