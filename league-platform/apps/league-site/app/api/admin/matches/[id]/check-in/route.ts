import { NextResponse } from "next/server";
import { isAdminRole, requiredEnv } from "@/lib/auth/config";
import { getServerSession } from "@/lib/auth/session-server";

type CheckInAction = "send_checkin" | "sync_reactions";

type MatchItem = {
  id: string;
  tournamentId: string;
  roundCode: string | null;
  slot: string | null;
  teamAId: string | null;
  teamBId: string | null;
  status: "scheduled" | "in_progress" | "completed" | "disputed";
  discordChannelId: string | null;
  teamARoleId: string | null;
  teamBRoleId: string | null;
  checkInMessageId: string | null;
  checkInRequestedAt: string | null;
  teamACheckedInAt: string | null;
  teamBCheckedInAt: string | null;
  tournament?: {
    id: string;
    name: string;
  };
};

function leagueApiBaseUrl(): string {
  return process.env.LEAGUE_API_BASE_URL?.trim() || "http://localhost:4001";
}

async function readJsonBody<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function requireAdmin() {
  const session = await getServerSession();
  if (!session || !isAdminRole(session.appRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

async function loadMatch(id: string): Promise<MatchItem> {
  const res = await fetch(`${leagueApiBaseUrl()}/v1/matches/${id}`, { cache: "no-store" });
  const body = await readJsonBody<{ item?: MatchItem; error?: string }>(res);
  if (!res.ok || !body?.item) {
    throw new Error(body?.error || "Failed to load match");
  }
  return body.item;
}

async function patchMatch(id: string, payload: Record<string, unknown>): Promise<MatchItem> {
  const res = await fetch(`${leagueApiBaseUrl()}/v1/matches/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await readJsonBody<{ item?: MatchItem; error?: string }>(res);
  if (!res.ok || !body?.item) {
    throw new Error(body?.error || "Failed to update match");
  }
  return body.item;
}

function discordApiBase(): string {
  return "https://discord.com/api/v10";
}

function normalizeRole(id: string | null): string | null {
  const v = id?.trim() || "";
  return v.length > 0 ? v : null;
}

async function discordRequest(path: string, init: RequestInit = {}) {
  const botToken = requiredEnv("DISCORD_BOT_TOKEN");
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bot ${botToken}`);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${discordApiBase()}${path}`, {
    ...init,
    headers
  });
  return res;
}

async function sendCheckInMessage(match: MatchItem) {
  const channelId = match.discordChannelId?.trim();
  const roleA = normalizeRole(match.teamARoleId);
  const roleB = normalizeRole(match.teamBRoleId);
  if (!channelId) throw new Error("discordChannelId is required");
  if (!roleA || !roleB) throw new Error("teamARoleId and teamBRoleId are required");

  const title = match.tournament?.name || "Motion Match";
  const roundLabel = [match.roundCode, match.slot].filter(Boolean).join(" / ");
  const content = [
    `**${title} — Match Check-In**`,
    roundLabel ? `Round: ${roundLabel}` : null,
    `<@&${roleA}> <@&${roleB}>`,
    "React with ✅ when your team is ready. Once both teams check in, join your assigned voice channels."
  ]
    .filter(Boolean)
    .join("\n");

  const postRes = await discordRequest(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content,
      allowed_mentions: {
        parse: [],
        roles: [roleA, roleB]
      }
    })
  });

  const postBody = await readJsonBody<{ id?: string; message?: string }>(postRes);
  if (!postRes.ok || !postBody?.id) {
    throw new Error(postBody?.message || `Discord message post failed (${postRes.status})`);
  }

  const nowIso = new Date().toISOString();
  const updated = await patchMatch(match.id, {
    checkInMessageId: postBody.id,
    checkInRequestedAt: nowIso,
    teamACheckedInAt: null,
    teamBCheckedInAt: null
  });

  return { updated, messageId: postBody.id };
}

async function syncReactions(match: MatchItem) {
  const channelId = match.discordChannelId?.trim();
  const messageId = match.checkInMessageId?.trim();
  const roleA = normalizeRole(match.teamARoleId);
  const roleB = normalizeRole(match.teamBRoleId);
  const guildId = requiredEnv("DISCORD_GUILD_ID");

  if (!channelId || !messageId) {
    throw new Error("discordChannelId and checkInMessageId are required");
  }
  if (!roleA || !roleB) {
    throw new Error("teamARoleId and teamBRoleId are required");
  }

  const reactionRes = await discordRequest(
    `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent("✅")}?limit=100`
  );
  const reactionUsers = await readJsonBody<Array<{ id: string; bot?: boolean; username?: string }>>(reactionRes);
  if (!reactionRes.ok || !reactionUsers) {
    const body = await readJsonBody<{ message?: string }>(reactionRes);
    throw new Error(body?.message || `Failed to read reactions (${reactionRes.status})`);
  }

  let teamAReady = false;
  let teamBReady = false;
  const readyBy: string[] = [];

  for (const user of reactionUsers) {
    if (!user?.id || user.bot) continue;
    const memberRes = await discordRequest(`/guilds/${guildId}/members/${user.id}`);
    const member = await readJsonBody<{ roles?: string[] }>(memberRes);
    if (!memberRes.ok || !member?.roles) continue;

    const hasA = member.roles.includes(roleA);
    const hasB = member.roles.includes(roleB);
    if (hasA) teamAReady = true;
    if (hasB) teamBReady = true;
    if (hasA || hasB) readyBy.push(user.username || user.id);
    if (teamAReady && teamBReady) break;
  }

  const nowIso = new Date().toISOString();
  const patchPayload: Record<string, unknown> = {};
  if (teamAReady && !match.teamACheckedInAt) patchPayload.teamACheckedInAt = nowIso;
  if (teamBReady && !match.teamBCheckedInAt) patchPayload.teamBCheckedInAt = nowIso;

  const updated = Object.keys(patchPayload).length > 0 ? await patchMatch(match.id, patchPayload) : match;
  return {
    updated,
    teamAReady,
    teamBReady,
    readyBy
  };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  try {
    const body = (await req.json()) as { action?: CheckInAction };
    const action = body?.action;
    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 });
    }

    const match = await loadMatch(id);
    if (action === "send_checkin") {
      const result = await sendCheckInMessage(match);
      return NextResponse.json({
        ok: true,
        action,
        messageId: result.messageId,
        item: result.updated
      });
    }
    if (action === "sync_reactions") {
      const result = await syncReactions(match);
      return NextResponse.json({
        ok: true,
        action,
        teamAReady: result.teamAReady,
        teamBReady: result.teamBReady,
        readyBy: result.readyBy,
        item: result.updated
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Check-in action failed" },
      { status: 500 }
    );
  }
}
