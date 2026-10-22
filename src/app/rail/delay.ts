// Everything on /rail runs an hour behind real time: ships, radio clips, events, runs, and audio.
// The server enforces it (ais.ts, radio-hub.ts, radio/[...path]/route.ts); the page ages things on the same clock.
export const DELAY_MS = 60 * 60_000;

export const delayedNow = () => Date.now() - DELAY_MS;

const chicagoParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

// Chicago local time the way the rail hub stores it: ISO 8601 without an offset.
export function chicagoIso(ms: number) {
  const part = Object.fromEntries(chicagoParts.formatToParts(new Date(ms)).map(({ type, value }) => [type, value]));
  return `${part.year}-${part.month}-${part.day}T${part.hour}:${part.minute}:${part.second}`;
}

// The inverse, for hub times that come without an epoch.
export function chicagoMs(iso: string) {
  const naive = Date.parse(`${iso.slice(0, 19)}Z`);
  if (Number.isNaN(naive)) return NaN;
  const offset = Date.parse(`${chicagoIso(naive)}Z`) - naive;
  return naive - offset;
}

// The latest Chicago local time the page may show.
export const delayLine = () => chicagoIso(delayedNow());
