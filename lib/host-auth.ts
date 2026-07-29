import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const HOST_COOKIE = "most_likely_host";
const SESSION_LENGTH_MS = 8 * 60 * 60 * 1000;

function getSessionSecret() {
  const secret = process.env.HOST_SESSION_SECRET;
  if (!secret) throw new Error("Host authentication is unavailable.");
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("hex");
}

export function pinsMatch(input: string, expected: string) {
  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);
  return (
    inputBuffer.length === expectedBuffer.length &&
    timingSafeEqual(inputBuffer, expectedBuffer)
  );
}

export async function createHostSession() {
  const expiresAt = Date.now() + SESSION_LENGTH_MS;
  const value = String(expiresAt);
  const token = `${value}.${sign(value)}`;
  const cookieStore = await cookies();
  cookieStore.set(HOST_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function clearHostSession() {
  const cookieStore = await cookies();
  cookieStore.set(HOST_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export async function isHostAuthenticated() {
  const cookieStore = await cookies();
  const token = cookieStore.get(HOST_COOKIE)?.value;
  if (!token) return false;

  const [expiresAt, signature] = token.split(".");
  if (!expiresAt || !signature || Number(expiresAt) <= Date.now()) return false;

  const expected = sign(expiresAt);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}
