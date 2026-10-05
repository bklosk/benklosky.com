export function monthDate(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, (monthIndex ?? 1) - 1, 1);
}

/** Last month when it holds less than three quarters of the previous six-month median. */
export function partialMonth(months: string[], items: number[]) {
  if (items.length < 7) return null;
  const last = items.length - 1;
  const previous = items.slice(last - 6, last).sort((a, b) => a - b);
  const median = (previous[2] + previous[3]) / 2;
  if (items[last] >= median * 0.75) return null;
  return months[last] ?? null;
}
