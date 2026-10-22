import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { radioAuthorized } from "./auth";
import "../map.css";

export const metadata: Metadata = { title: "Radio · Ben Klosky", robots: { index: false } };

// The sign-in form for the radio layer on /map.
export default async function RadioLogin({ searchParams }: { searchParams: Promise<{ wrong?: string }> }) {
  if (await radioAuthorized()) redirect("/map");
  const { wrong } = await searchParams;
  return (
    <form className="radio-login" method="post" action="/map/radio/login">
      <h1>Radio</h1>
      <p className="rail-muted">Transcripts and audio from the home SDR on the map.</p>
      <input type="password" name="password" placeholder="Password" autoComplete="current-password" required autoFocus />
      <button type="submit">Sign in</button>
      {wrong ? <p className="radio-wrong">That wasn’t it.</p> : null}
    </form>
  );
}
