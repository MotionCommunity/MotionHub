import { NextResponse } from "next/server";
import { isAdminRole } from "@/lib/auth/config";
import { getServerSession } from "@/lib/auth/session-server";

function leagueApiBaseUrl(): string {
  return process.env.LEAGUE_API_BASE_URL?.trim() || "http://localhost:4001";
}

type TournamentPayload = {
  name?: string;
  externalTournamentId?: number | null;
  format?: string | null;
  bracketType?: string | null;
  status?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
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

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  let res: Response;
  try {
    res = await fetch(`${leagueApiBaseUrl()}/v1/tournaments`, { cache: "no-store" });
  } catch {
    return NextResponse.json(
      { error: "League API is offline. Start league-api on port 4001." },
      { status: 502 }
    );
  }

  const body = await readJsonBody<{ items?: unknown[]; error?: string }>(res);
  if (!res.ok) {
    return NextResponse.json({ error: body?.error || "Failed to load tournaments" }, { status: res.status });
  }
  return NextResponse.json({ items: body?.items || [] });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const payload = (await req.json()) as TournamentPayload;
  let res: Response;
  try {
    res = await fetch(`${leagueApiBaseUrl()}/v1/tournaments`, {
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
    return NextResponse.json({ error: body?.error || "Failed to create tournament" }, { status: res.status });
  }
  return NextResponse.json({ item: body?.item }, { status: 201 });
}
