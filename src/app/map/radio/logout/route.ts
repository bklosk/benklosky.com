// POST /map/radio/logout: end the radio session.
import { NextResponse, type NextRequest } from "next/server";
import { HINT_COOKIE, SESSION_COOKIE } from "../auth";

export function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/map", request.url), 303);
  response.cookies.set(SESSION_COOKIE, "", { path: "/map", maxAge: 0 });
  response.cookies.set(HINT_COOKIE, "", { path: "/map", maxAge: 0 });
  return response;
}
