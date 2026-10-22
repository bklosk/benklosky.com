// POST /map/radio/logout: end the radio session.
import { NextResponse } from "next/server";
import { HINT_COOKIE, SESSION_COOKIE } from "../auth";

export function POST() {
  // Relative Location: behind App Platform's proxy request.url is the internal localhost:8080 address.
  const response = new NextResponse(null, { status: 303, headers: { Location: "/map" } });
  response.cookies.set(SESSION_COOKIE, "", { path: "/map", maxAge: 0 });
  response.cookies.set(HINT_COOKIE, "", { path: "/map", maxAge: 0 });
  return response;
}
