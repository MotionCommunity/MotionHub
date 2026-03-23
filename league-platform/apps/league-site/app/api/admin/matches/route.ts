import { NextResponse } from "next/server";
import { isAdminRole } from "@/lib/auth/config";
import { getServerSession } from "@/lib/auth/session-server";

function leagueApiBaseUrl(): string {
  return process.env.LEAGUE_API_BASE_URL?.trim() || "http://localhost:4001";
}

type MatchPayload = {
  tournamentId?: string;
  roundCode?: string | null;
  slot?: string | null;
  teamAId?: string | null;
  teamBId?: string | null;
  winnerTeamId?: string | null;
  bestOf?: number | null;
  status?: "scheduled" | "in_progress" | "completed" | "disputed";
  scheduledAt?: string | null;
  playedAt?: string | null;
  discordChannelId?: string | null;
  teamARoleId?: string | null;
  teamBRoleId?: string | null;
  checkInMessageId?: string | null;
  checkInRequestedAt?: string | null;
  teamACheckedInAt?: string | null;
  teamBCheckedInAt?: string | null;
};

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

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const url = new URL(req.url);
  const query = new URLSearchParams();
  const tournamentId = url.searchParams.get("tournamentId");
  const status = url.searchParams.get("status");
  if (tournamentId) query.set("tournamentId", tournamentId);
  if (status) query.set("status", status);

  let res: Response;
  try {
    res = await fetch(`${leagueApiBaseUrl()}/v1/matches${query.size ? `?${query.toString()}` : ""}`, {
      cache: "no-store"
    });
  } catch {
    return NextResponse.json(
      { error: "League API is offline. Start league-api on port 4001." },
      { status: 502 }
    );
  }

  const body = await readJsonBody<{ items?: unknown[]; error?: string }>(res);
  if (!res.ok) {
    return NextResponse.json({ error: body?.error || "Failed to load matches" }, { status: res.status });
  }
  return NextResponse.json({ items: body?.items || [] });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const payload = (await req.json()) as MatchPayload;
  let res: Response;
  try {
    res = await fetch(`${leagueApiBaseUrl()}/v1/matches`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch {
    return NextResponse.json(
      { error: "League API is offline. Start league-api on port 4001." },
      { status: 502 }
    );
  }
  const body = await readJsonBody<{ item?: unknown; error?: string }>(res);
  if (!res.ok) {
    return NextResponse.json({ error: body?.error || "Failed to create match" }, { status: res.status });
  }
  return NextResponse.json({ item: body?.item }, { status: 201 });
}
