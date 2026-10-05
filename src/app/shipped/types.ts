export type Source = "comment" | "title";

export type WordSeries = {
  source: Source;
  months: string[];
  items: number[];
  words: Record<string, number[]>;
};
