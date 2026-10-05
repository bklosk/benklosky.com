export const SHIP_WORDS = ["shipped", "shipping", "ships", "ship"] as const;

export const SHIP_COLORS: Record<(typeof SHIP_WORDS)[number], string> = {
  shipped: "#c4542c",
  shipping: "#a86b1f",
  ships: "#6f3d36",
  ship: "#1b1a18",
};

/** Named controls first, then the rest of the comparison set. */
export const CONTROL_WORDS = [
  "bug",
  "debug",
  "site",
  "released",
  "launch",
  "deploy",
  "fix",
  "error",
  "feature",
  "code",
  "app",
  "user",
  "data",
  "server",
  "test",
  "build",
  "problem",
] as const;

export const CONTROL_COLOR = "#2c4c6e";
export const VOLUME_COLOR = "#8a847c";

export const NAMED_CONTROLS = new Set(["bug", "debug", "site"]);
