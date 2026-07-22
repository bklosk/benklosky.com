import posthog from "posthog-js";

posthog.init("phc_B2HuWHlorJ3GRZkvGtQ0zlrZEj1NM6tYYANwklR9cMT", {
  api_host: "https://us.i.posthog.com",
  defaults: "2026-01-30",
  capture_exceptions: true,
  debug: process.env.NODE_ENV === "development",
});
