import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, OAUTH_STATE_COOKIE, appUrl } from "@/lib/auth/config";

export async function GET(req: NextRequest) {
  const next = req.nextUrl.searchParams.get("next");
  const redirectTo = next && next.startsWith("/") ? `${appUrl()}${next}` : `${appUrl()}/login?loggedOut=1`;

  const res = NextResponse.redirect(redirectTo);
  res.cookies.delete(AUTH_COOKIE);
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}

