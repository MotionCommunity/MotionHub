import { cookies } from "next/headers";
import { AUTH_COOKIE } from "./config";
import { verifySession } from "./session";
import type { SessionPayload } from "./types";

export async function getServerSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

