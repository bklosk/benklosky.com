// Runs once when the server starts. Ships on /rail are shown an hour late, so the AIS relay starts listening now
// instead of waiting for the first visitor.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { aisHub } = await import("./app/rail/ais");
  aisHub.start();
}
