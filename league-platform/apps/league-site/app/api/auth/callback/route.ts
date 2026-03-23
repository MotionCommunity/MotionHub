import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, OAUTH_STATE_COOKIE, appUrl, discordRedirectUri, isAdminRole, requiredEnv, resolveAppRole } from "@/lib/auth/config";
import { signSession } from "@/lib/auth/session";

type DiscordUser = {
  id: string;
  username: string;
  avatar: string | null;
};

type DiscordMember = {
  roles: string[];
};

function avatarUrl(user: DiscordUser): string | null {
  if (!user.avatar) return null;
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
}

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    if (!code || !state) {
      return NextResponse.redirect(`${appUrl()}/login?error=missing_code`);
    }

    const stateCookie = req.cookies.get(OAUTH_STATE_COOKIE)?.value || "";
    const [expectedState, nextPathRaw] = stateCookie.split("|");
    const nextPath = nextPathRaw?.startsWith("/") ? nextPathRaw : "/admin";
    if (!expectedState || expectedState !== state) {
      return NextResponse.redirect(`${appUrl()}/login?error=invalid_state`);
    }

    const clientId = requiredEnv("DISCORD_CLIENT_ID");
    const clientSecret = requiredEnv("DISCORD_CLIENT_SECRET");
    const guildId = requiredEnv("DISCORD_GUILD_ID");
    const botToken = requiredEnv("DISCORD_BOT_TOKEN");

    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: discordRedirectUri(),
      }),
    });
    if (!tokenRes.ok) {
      return NextResponse.redirect(`${appUrl()}/login?error=token_exchange_failed`);
    }
    const tokenJson = await tokenRes.json();
    const accessToken = tokenJson.access_token as string;
    if (!accessToken) {
      return NextResponse.redirect(`${appUrl()}/login?error=missing_access_token`);
    }

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      return NextResponse.redirect(`${appUrl()}/login?error=user_fetch_failed`);
    }
    const user = (await userRes.json()) as DiscordUser;

    const memberRes = await fetch(`https://discord.com/api/guilds/${guildId}/members/${user.id}`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    const member = (memberRes.ok ? await memberRes.json() : { roles: [] }) as DiscordMember;
    const discordRoles = Array.isArray(member.roles) ? member.roles : [];

    const appRole = resolveAppRole(discordRoles);
    if (!isAdminRole(appRole)) {
      const denied = NextResponse.redirect(`${appUrl()}/unauthorized`);
      denied.cookies.delete(OAUTH_STATE_COOKIE);
      return denied;
    }

    const jwt = await signSession({
      sub: user.id,
      username: user.username,
      avatarUrl: avatarUrl(user),
      discordRoles,
      appRole,
    });

    const res = NextResponse.redirect(`${appUrl()}${nextPath}`);
    res.cookies.delete(OAUTH_STATE_COOKIE);
    res.cookies.set(AUTH_COOKIE, jwt, {
      httpOnly: true,
      sameSite: "lax",
      secure: appUrl().startsWith("https://"),
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return res;
  } catch {
    return NextResponse.redirect(`${appUrl()}/login?error=callback_failed`);
  }
}

