export const DOMAINS = ["movies", "books", "art"] as const;
export type Domain = (typeof DOMAINS)[number];

export const isDomain = (value: string): value is Domain => (DOMAINS as readonly string[]).includes(value);
