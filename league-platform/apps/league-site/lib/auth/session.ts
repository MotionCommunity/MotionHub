import { SignJWT, jwtVerify } from "jose";
import type { SessionPayload } from "./types";

const encoder = new TextEncoder();

function jwtSecret(): Uint8Array {
  const raw = process.env.AUTH_SESSION_SECRET?.trim() || "";
  if (!raw) throw new Error("Missing required env: AUTH_SESSION_SECRET");
  return encoder.encode(raw);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(jwtSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

