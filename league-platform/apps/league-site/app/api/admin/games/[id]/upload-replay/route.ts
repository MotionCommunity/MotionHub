import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { isAdminRole } from "@/lib/auth/config";
import { getServerSession } from "@/lib/auth/session-server";

export const runtime = "nodejs";

function leagueApiBaseUrl(): string {
  return process.env.LEAGUE_API_BASE_URL?.trim() || "http://localhost:4001";
}

function uploadsBaseDir(): string | null {
  const raw = process.env.REPLAY_UPLOADS_DIR?.trim();
  return raw || null;
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

/**
 * Saves the .replay under REPLAY_UPLOADS_DIR/matches/{matchId}/ and queues ingest with gameId.
 * league-worker must use the same REPLAY_UPLOADS_DIR to resolve storageKey.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const baseDir = uploadsBaseDir();
  if (!baseDir) {
    return NextResponse.json(
      {
        error:
          "REPLAY_UPLOADS_DIR is not set. Set it to an absolute folder shared with league-worker (same path the worker uses for replay files)."
      },
      { status: 500 }
    );
  }

  const { id: gameId } = await params;
  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Expected multipart field \"file\" with the .replay binary" }, { status: 400 });
  }

  const originalName =
    typeof (file as File & { name?: string }).name === "string" ? (file as File).name : "replay.replay";
  const safe =
    originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "replay.replay";
  const withExt = safe.toLowerCase().endsWith(".replay") ? safe : `${safe}.replay`;

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }

  const sha256 = createHash("sha256").update(buf).digest("hex");

  let ctxRes: Response;
  try {
    ctxRes = await fetch(`${leagueApiBaseUrl()}/v1/games/${encodeURIComponent(gameId)}/context`, {
      cache: "no-store"
    });
  } catch {
    return NextResponse.json(
      { error: "League API is offline. Start league-api on port 4001." },
      { status: 502 }
    );
  }
  const ctxBody = await readJsonBody<{ matchId?: string; error?: string }>(ctxRes);
  if (!ctxRes.ok || !ctxBody?.matchId) {
    return NextResponse.json(
      { error: ctxBody?.error || "Game not found" },
      { status: ctxRes.status === 404 ? 404 : ctxRes.status }
    );
  }
  const matchId = ctxBody.matchId;

  const relativeParts = ["matches", matchId, `${gameId.slice(0, 8)}-${withExt}`];
  const storageKey = relativeParts.join("/");
  const absPath = path.join(baseDir, ...relativeParts);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, buf);

  const session = await getServerSession();
  const uploadedBy = session?.username || session?.sub || null;

  let ingestRes: Response;
  try {
    ingestRes = await fetch(`${leagueApiBaseUrl()}/v1/replays/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        storageKey,
        sha256,
        gameId,
        uploadedBy: uploadedBy || undefined
      })
    });
  } catch {
    return NextResponse.json(
      { error: "League API is offline. Start league-api on port 4001.", storageKey },
      { status: 502 }
    );
  }

  const ingestBody = await readJsonBody<{
    queued?: boolean;
    duplicate?: boolean;
    item?: unknown;
    error?: string;
  }>(ingestRes);
  if (!ingestRes.ok) {
    return NextResponse.json(
      { error: ingestBody?.error || "Ingest request failed", storageKey },
      { status: ingestRes.status }
    );
  }

  return NextResponse.json({
    ok: true,
    storageKey,
    sha256,
    queued: ingestBody?.queued,
    duplicate: ingestBody?.duplicate,
    item: ingestBody?.item
  });
}
