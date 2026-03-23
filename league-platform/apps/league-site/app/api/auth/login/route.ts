import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { OAUTH_STATE_COOKIE, appUrl, discordRedirectUri, requiredEnv } from "@/lib/auth/config";

function sanitizeNext(input: string | null): string {
  if (!input) return "/admin";
  if (!input.startsWith("/")) return "/admin";
  return input;
}

export async function GET(req: NextRequest) {
  try {
    const clientId = requiredEnv("DISCORD_CLIENT_ID");
    const nextPath = sanitizeNext(req.nextUrl.searchParams.get("next"));
    const state = crypto.randomUUID();

    const authorize = new URL("https://discord.com/api/oauth2/authorize");
    authorize.searchParams.set("client_id", clientId);
    authorize.searchParams.set("redirect_uri", discordRedirectUri());
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("scope", "identify");
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("prompt", "none");

    const res = NextResponse.redirect(authorize.toString());
    res.cookies.set(OAUTH_STATE_COOKIE, `${state}|${nextPath}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: appUrl().startsWith("https://"),
      maxAge: 60 * 10,
      path: "/",
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

