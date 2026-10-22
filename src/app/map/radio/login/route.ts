// POST /map/radio/login: check RADIO_PASSWORD and start a 30-day session cookie, then back to the map.
import { NextResponse, type NextRequest } from "next/server";
import { HINT_COOKIE, newSession, passwordMatches, radioConfigured, SESSION_COOKIE } from "../auth";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  if (!radioConfigured() || !passwordMatches(password)) {
    // Slow down guessing; one person uses this.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return NextResponse.redirect(new URL("/map/radio?wrong=1", request.url), 303);
  }
  const session = newSession();
  const response = NextResponse.redirect(new URL("/map", request.url), 303);
  response.cookies.set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/map",
    maxAge: session.maxAge,
  });
  response.cookies.set(HINT_COOKIE, "1", { sameSite: "lax", path: "/map", maxAge: session.maxAge });
  return response;
}
