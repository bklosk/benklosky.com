import { expect, test } from "bun:test";
import fixture from "./parity.fixture.json";
import { bald, predictive, TasteModel, type Artifact, type Observation } from "./model";
import { profile, topReasons } from "./readout";

// Regenerate with scripts/taste/parity.py whenever model.py changes.
test("the browser model matches model.py", () => {
  const bin = Uint8Array.from(atob(fixture.bin), (ch) => ch.charCodeAt(0)).buffer;
  const model = new TasteModel(fixture.artifact as unknown as Artifact, bin);
  const observations: Observation[] = [
    ...fixture.swipes.map(([item, like]) => ({ kind: "swipe" as const, item, like: like === 1 })),
    { kind: "pin", feature: fixture.pin[0], value: fixture.pin[1] },
  ];
  const post = model.fit(observations);
  const close = (actual: ArrayLike<number>, expected: number[]) =>
    expected.forEach((value, i) => expect(actual[i]).toBeCloseTo(value, 4));
  close(post.m, fixture.expected.m);
  close(post.itemMean, fixture.expected.itemMean);
  close(post.itemVar, fixture.expected.itemVar);
  close(post.traitMean, fixture.expected.traitMean);
  close(post.traitSd, fixture.expected.traitSd);
  close(Array.from(post.itemMean, (m, i) => predictive(m, post.itemVar[i])), fixture.expected.predictive);
  close(Array.from(post.itemMean, (m, i) => bald(m, post.itemVar[i])), fixture.expected.bald);

  // The variance split is exact: its parts add up to the item's variance.
  const parts = model.varianceParts(post, 5);
  expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(post.itemVar[5], 6);
});

test("hidden questions shape the model but never reach the readout", () => {
  const bin = Uint8Array.from(atob(fixture.bin), (ch) => ch.charCodeAt(0)).buffer;
  const F = fixture.artifact.layout.X[1] as number;
  const artifact = {
    ...(fixture.artifact as unknown as Artifact),
    features: Array.from({ length: F }, (_, j) => ({
      question: `q${j}`,
      option: null,
      kind: "score" as const,
      group: "g",
      text: `question ${j}`,
      pos: `high ${j}`,
      neg: `low ${j}`,
      topic: `topic ${j}`,
      levels: null,
      hidden: j === 4,
    })),
  };
  const model = new TasteModel(artifact, bin);
  // Pin the hidden feature hard so it would certainly be claimed if shown.
  const post = model.fit([
    ...fixture.swipes.map(([item, like]) => ({ kind: "swipe" as const, item, like: like === 1 })),
    { kind: "pin", feature: 4, value: 2 },
  ]);
  expect(Math.abs(post.traitMean[4])).toBeGreaterThan(1);
  const { traits, unsure } = profile(model, post, new Set());
  expect(traits.some((t) => t.feature === 4)).toBe(false);
  expect(unsure.some((u) => u.feature === 4)).toBe(false);
  for (let i = 0; i < model.N; i++) {
    expect(topReasons(model, model.varianceParts(post, i), i, F).some((r) => r.feature === 4)).toBe(false);
    expect(topReasons(model, model.scoreParts(post, i), i, F).some((r) => r.feature === 4)).toBe(false);
  }
});
