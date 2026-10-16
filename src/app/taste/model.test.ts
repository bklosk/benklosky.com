import { expect, test } from "bun:test";
import fixture from "./parity.fixture.json";
import { bald, predictive, TasteModel, type Artifact, type Observation } from "./model";
import { profile, sentence, topReasons } from "./readout";

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

const F = fixture.artifact.layout.X[1] as number;
const swipes = fixture.swipes.map(([item, like]) => ({ kind: "swipe" as const, item, like: like === 1 }));

/** The fixture's model with made-up questions, one score feature each. */
function withQuestions(hidden: number | null = null) {
  const bin = Uint8Array.from(atob(fixture.bin), (ch) => ch.charCodeAt(0)).buffer;
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
      hidden: j === hidden,
    })),
  };
  return new TasteModel(artifact, bin);
}

test("hidden questions shape the model but never reach the readout", () => {
  const model = withQuestions(4);
  // Pin the hidden feature hard so it would certainly be claimed if shown.
  const post = model.fit([...swipes, { kind: "pin", feature: 4, value: 2 }]);
  expect(Math.abs(post.traitMean[4])).toBeGreaterThan(1);
  const { traits, unsure } = profile(model, post, new Set());
  expect(traits.some((t) => t.feature === 4)).toBe(false);
  expect(unsure.some((u) => u.feature === 4)).toBe(false);
  for (let i = 0; i < model.N; i++) {
    expect(topReasons(model, model.varianceParts(post, i), i, F).some((r) => r.feature === 4)).toBe(false);
    expect(topReasons(model, model.scoreParts(post, i), i, F).some((r) => r.feature === 4)).toBe(false);
  }
});

test("when it can claim too few traits, the profile adds its likeliest leanings as guesses", () => {
  const model = withQuestions();
  const post = model.fit(swipes);
  // Six swipes settle nothing in the fixture, so all three are guesses, surest first.
  const { traits } = profile(model, post, new Set());
  expect(traits.map((t) => t.guess)).toEqual([true, true, true]);
  const z = traits.map((t) => Math.abs(t.mean) / t.sd);
  expect(z).toEqual([...z].sort((a, b) => b - a));
  expect(Math.min(...z)).toBeGreaterThanOrEqual(0.5);
  expect(traits.some((t) => t.strong)).toBe(false);
  expect(sentence(traits[0])).toStartWith("might ");
  expect(profile(model, post, new Set(), 10, 0).traits).toEqual([]);

  // An edit is claimed or listed as neutral, never guessed. Claims come first; guesses only top them up to three.
  const j = traits[0].feature;
  const neutral = profile(model, model.fit([...swipes, { kind: "pin", feature: j, value: 0 }]), new Set([j])).traits;
  expect(neutral.some((t) => t.feature === j)).toBe(false);
  const firm = profile(model, model.fit([...swipes, { kind: "pin", feature: j, value: 2 }]), new Set([j])).traits;
  expect(firm[0]).toMatchObject({ feature: j, pinned: true, guess: false });
  const claims = firm.filter((t) => !t.guess).length;
  expect(firm.slice(claims).every((t) => t.guess)).toBe(true);
  expect(firm.length - claims).toBeLessThanOrEqual(Math.max(0, 3 - claims));
});
