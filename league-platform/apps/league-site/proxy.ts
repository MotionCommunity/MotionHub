import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, appUrl, isAdminRole } from "@/lib/auth/config";
import { verifySession } from "@/lib/auth/session";

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  if (!isAdminPath) return NextResponse.next();

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    const next = encodeURIComponent(`${pathname}${search}`);
    return NextResponse.redirect(`${appUrl()}/login?next=${next}`);
  }

  const session = await verifySession(token);
  if (!session || !isAdminRole(session.appRole ?? null)) {
    return NextResponse.redirect(`${appUrl()}/unauthorized`);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};

