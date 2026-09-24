import type gameData from "./data/games.json";

export type Game = (typeof gameData)[number];
export type Selection = { game: Game | null; location: string; label?: string };

export function range(min: number | null, max: number | null) {
  if (!min && !max) return "—";
  if (!min || min === max) return String(max);
  if (!max) return String(min);
  return `${min}–${max}`;
}
