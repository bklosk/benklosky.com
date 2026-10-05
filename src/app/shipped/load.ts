import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Source, WordSeries } from "./types";

const SOURCES: Source[] = ["comment", "title"];

export async function loadWordSeries(): Promise<WordSeries[]> {
  const csv = await readFile(path.join(process.cwd(), "data/hn-word-counts-monthly.csv"), "utf8");
  const [headerLine, ...lines] = csv.trim().split("\n");
  const headers = headerLine.split(",");
  const wordNames = headers.filter((header) => header !== "month" && header !== "source" && header !== "items");

  const grouped = new Map<Source, { month: string; items: number; words: Record<string, number> }[]>();

  for (const line of lines) {
    if (!line) continue;
    const cells = line.split(",");
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? "";
    });
    const source = record.source;
    if (source !== "comment" && source !== "title") continue;
    const items = Number(record.items);
    if (!Number.isFinite(items) || items < 100) continue;

    const words: Record<string, number> = {};
    for (const word of wordNames) words[word] = Number(record[word] ?? 0);
    const rows = grouped.get(source) ?? [];
    rows.push({ month: record.month, items, words });
    grouped.set(source, rows);
  }

  return SOURCES.map((source) => {
    const rows = (grouped.get(source) ?? []).sort((a, b) => a.month.localeCompare(b.month));
    return {
      source,
      months: rows.map((row) => row.month),
      items: rows.map((row) => row.items),
      words: Object.fromEntries(wordNames.map((word) => [word, rows.map((row) => row.words[word] ?? 0)])),
    };
  });
}
