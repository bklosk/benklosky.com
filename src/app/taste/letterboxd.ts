import type { Item } from "./model";

/**
 * Read a Letterboxd export (ratings.csv: Date, Name, Year, Letterboxd URI,
 * Rating) in the browser and match films to the catalog by title and year.
 * 3.5 stars and up is a like, 2.5 and down a dislike, 3 is skipped. Nothing
 * is uploaded.
 */

export type Imported = { matched: { item: number; like: boolean }[]; rows: number; unrated: number; unmatched: number };

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows.filter((r) => r.some((cell) => cell.trim()));
}

export const normalize = (title: string) =>
  title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/^(the|a|an) /, "")
    .replace(/[^a-z0-9]+/g, "");

export function importLetterboxd(text: string, items: Item[]): Imported {
  const [header, ...rows] = parseCsv(text);
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const [name, year, rating] = [col("name"), col("year"), col("rating")];
  if (name < 0 || rating < 0) throw new Error("This doesn't look like Letterboxd's ratings.csv (it needs Name and Rating columns).");

  const index = new Map<string, number[]>();
  items.forEach((item, i) => {
    const key = normalize(item.title);
    index.set(key, [...(index.get(key) ?? []), i]);
  });

  const matched = new Map<number, boolean>();
  let unrated = 0;
  let unmatched = 0;
  for (const row of rows) {
    const stars = parseFloat(row[rating]);
    if (!Number.isFinite(stars) || stars === 3) {
      unrated++;
      continue;
    }
    const y = year >= 0 ? parseInt(row[year], 10) : NaN;
    const candidates = index.get(normalize(row[name] ?? "")) ?? [];
    const hit = candidates.find((i) => !Number.isFinite(y) || items[i].year == null || Math.abs(items[i].year! - y) <= 1);
    if (hit === undefined) {
      unmatched++;
      continue;
    }
    matched.set(hit, stars >= 3.5);
  }
  return {
    matched: [...matched].map(([item, like]) => ({ item, like })),
    rows: rows.length,
    unrated,
    unmatched,
  };
}
