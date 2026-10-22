// Who may see the home SDR's radio data on /map: whoever knows RADIO_PASSWORD (just Ben, for now).
// The session is a signed, expiring httpOnly cookie, so the password itself is only ever sent once.
import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "map_radio";
// Readable by the page's JavaScript so it knows to look for the radio layer; it grants nothing by itself.
export const HINT_COOKIE = "map_radio_hint";
const SESSION_DAYS = 30;

function secret() {
  const value = process.env.RADIO_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("RADIO_SESSION_SECRET is not set");
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

const same = (a: string, b: string) => {
  const x = createHash("sha256").update(a).digest();
  const y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
};

export function radioConfigured() {
  return Boolean(process.env.RADIO_PASSWORD && process.env.RADIO_SESSION_SECRET && process.env.RAIL_API_URL && process.env.RAIL_API_TOKEN);
}

export function passwordMatches(password: string) {
  const expected = process.env.RADIO_PASSWORD;
  return Boolean(expected) && same(password, expected!);
}

export function newSession() {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  const payload = `v1.${expires}`;
  return { value: `${payload}.${sign(payload)}`, maxAge: SESSION_DAYS * 86_400 };
}

export function validSession(value: string | undefined) {
  if (!value || !radioConfigured()) return false;
  const [version, expires, signature] = value.split(".");
  if (version !== "v1" || !expires || !signature) return false;
  if (!same(signature, sign(`${version}.${expires}`))) return false;
  return Number(expires) > Date.now();
}

export async function radioAuthorized() {
  return validSession((await cookies()).get(SESSION_COOKIE)?.value);
}
