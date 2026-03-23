import { NextResponse } from "next/server";
import { SignJWT, importPKCS8 } from "jose";
import { isAdminRole } from "@/lib/auth/config";
import { getServerSession } from "@/lib/auth/session-server";

type PlayerRecord = {
  ign: string;
  region?: string;
  discordUsername?: string;
  discordUserId?: string;
  epicGamesId?: string;
  trackerUrl?: string;
};

type ExistingPlayer = {
  id: string;
  ign: string;
  region: string | null;
  discordUsername: string | null;
  discordUserId: string | null;
  epicGamesId: string | null;
  trackerUrl: string | null;
};

function leagueApiBaseUrl(): string {
  return process.env.LEAGUE_API_BASE_URL?.trim() || "http://localhost:4001";
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeIgn(value: string): string {
  return value.trim().toLowerCase();
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.indexOf(normalizeHeader(candidate));
    if (idx >= 0) return idx;
  }
  return -1;
}

function readOptionalCell(row: string[], index: number): string | undefined {
  if (index < 0) return undefined;
  const value = (row[index] || "").trim();
  return value.length > 0 ? value : "";
}

function isApproved(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "approved" || normalized === "approve" || normalized === "yes" || normalized === "true";
}

function parseCsv(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];

    if (inQuotes) {
      if (ch === "\"") {
        const next = raw[i + 1];
        if (next === "\"") {
          cell += "\"";
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === "\"") {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    if (ch !== "\r") {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((v) => v.trim().length > 0));
}

function getColumnName(envKey: string, fallback: string): string {
  return process.env[envKey]?.trim() || fallback;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function parseGoogleServiceAccountPrivateKey(raw: string): string {
  return raw.replace(/\\n/g, "\n");
}

async function getGoogleAccessToken(): Promise<string> {
  const clientEmail = requiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = parseGoogleServiceAccountPrivateKey(requiredEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"));
  const tokenUri = process.env.GOOGLE_TOKEN_URI?.trim() || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);

  const key = await importPKCS8(privateKey, "RS256");
  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly"
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience(tokenUri)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const tokenResponse = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    }).toString()
  });

  const tokenBody = (await tokenResponse.json()) as { access_token?: string; error_description?: string };
  if (!tokenResponse.ok || !tokenBody.access_token) {
    const message = tokenBody.error_description || `Google token request failed (${tokenResponse.status})`;
    throw new Error(message);
  }
  return tokenBody.access_token;
}

async function loadRowsFromGoogleSheetApi(): Promise<string[][] | null> {
  const sheetId = process.env.PLAYERS_SHEET_ID?.trim();
  if (!sheetId) return null;

  const sheetRange = process.env.PLAYERS_SHEET_RANGE?.trim() || "Form Responses 1!A:Z";
  const accessToken = await getGoogleAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(sheetRange)}?majorDimension=ROWS`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });
  const body = (await response.json()) as { values?: string[][]; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(body.error?.message || `Google Sheets API request failed (${response.status})`);
  }
  return body.values || [];
}

async function loadRowsFromCsvUrl(): Promise<string[][] | null> {
  const sheetCsvUrl = process.env.PLAYERS_SHEET_CSV_URL?.trim();
  if (!sheetCsvUrl) return null;

  const csvResponse = await fetch(sheetCsvUrl, { cache: "no-store" });
  if (!csvResponse.ok) {
    throw new Error(`Failed to fetch Google Sheet CSV (${csvResponse.status})`);
  }
  const csvText = await csvResponse.text();
  return parseCsv(csvText);
}

async function loadSheetRows(): Promise<{ rows: string[][]; source: "private_api" | "csv" }> {
  const sheetId = process.env.PLAYERS_SHEET_ID?.trim();
  if (sheetId) {
    const rows = await loadRowsFromGoogleSheetApi();
    return { rows: rows || [], source: "private_api" };
  }

  const rows = await loadRowsFromCsvUrl();
  if (!rows) {
    throw new Error("Missing sheet config. Set PLAYERS_SHEET_ID (private) or PLAYERS_SHEET_CSV_URL (public CSV).");
  }
  return { rows, source: "csv" };
}

async function requireAdmin() {
  const session = await getServerSession();
  if (!session || !isAdminRole(session.appRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

function sameValue(a?: string | null, b?: string | null): boolean {
  return (a || "").trim() === (b || "").trim();
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

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const ignColumn = getColumnName("PLAYERS_SHEET_IGN_COLUMN", "ign");
  const regionColumn = getColumnName("PLAYERS_SHEET_REGION_COLUMN", "region");
  const discordUsernameColumn = getColumnName("PLAYERS_SHEET_DISCORD_USERNAME_COLUMN", "discordUsername");
  const discordUserIdColumn = getColumnName("PLAYERS_SHEET_DISCORD_USER_ID_COLUMN", "discordUserId");
  const epicGamesIdColumn = getColumnName("PLAYERS_SHEET_EPIC_GAMES_ID_COLUMN", "epicGamesId");
  const trackerUrlColumn = getColumnName("PLAYERS_SHEET_TRACKER_URL_COLUMN", "trackerUrl");
  const validationColumn = getColumnName("PLAYERS_SHEET_VALIDATION_COLUMN", "validation");
  const onlyApproved =
    (process.env.PLAYERS_SHEET_ONLY_APPROVED?.trim().toLowerCase() || "true") !== "false";
  const pruneNonApproved =
    (process.env.PLAYERS_SHEET_PRUNE_NON_APPROVED?.trim().toLowerCase() || "true") !== "false";

  let rows: string[][];
  let source: "private_api" | "csv";
  try {
    const loaded = await loadSheetRows();
    rows = loaded.rows;
    source = loaded.source;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load sheet data" },
      { status: 400 }
    );
  }

  if (rows.length < 2) {
    return NextResponse.json({ error: "Sheet has no data rows" }, { status: 400 });
  }

  const headers = rows[0].map(normalizeHeader);
  const ignIndex = findColumnIndex(headers, [ignColumn, "ign", "ingamename", "playername"]);
  const regionIndex = findColumnIndex(headers, [regionColumn, "region", "serverregion"]);
  const discordUsernameIndex = findColumnIndex(headers, [discordUsernameColumn, "discordusername", "discord", "discordname"]);
  const discordUserIdIndex = findColumnIndex(headers, [discordUserIdColumn, "discorduserid", "discordid", "userid"]);
  const epicGamesIdIndex = findColumnIndex(headers, [epicGamesIdColumn, "epicgamesid", "epicid", "epic"]);
  const trackerUrlIndex = findColumnIndex(headers, [trackerUrlColumn, "trackerggurl", "trackerurl", "tracker"]);
  const validationIndex = findColumnIndex(headers, [validationColumn, "validation", "status", "approval"]);

  if (ignIndex < 0) {
    return NextResponse.json(
      { error: `IGN column not found. Expected header: "${ignColumn}"` },
      { status: 400 }
    );
  }
  if (onlyApproved && validationIndex < 0) {
    return NextResponse.json(
      {
        error: `Validation column not found. Expected header like "${validationColumn}" when PLAYERS_SHEET_ONLY_APPROVED=true.`
      },
      { status: 400 }
    );
  }

  const incomingByIgn = new Map<string, PlayerRecord>();
  let skippedNoIgn = 0;
  let skippedByValidation = 0;

  for (const row of rows.slice(1)) {
    const ign = (row[ignIndex] || "").trim();
    if (!ign) {
      skippedNoIgn += 1;
      continue;
    }

    if (onlyApproved && validationIndex >= 0 && !isApproved((row[validationIndex] || "").trim())) {
      skippedByValidation += 1;
      continue;
    }

    const key = normalizeIgn(ign);
    incomingByIgn.set(key, {
      ign,
      region: readOptionalCell(row, regionIndex),
      discordUsername: readOptionalCell(row, discordUsernameIndex),
      discordUserId: readOptionalCell(row, discordUserIdIndex),
      epicGamesId: readOptionalCell(row, epicGamesIdIndex),
      trackerUrl: readOptionalCell(row, trackerUrlIndex)
    });
  }

  const incoming = Array.from(incomingByIgn.values());
  let playersResponse: Response;
  try {
    playersResponse = await fetch(`${leagueApiBaseUrl()}/v1/players`, { cache: "no-store" });
  } catch {
    return NextResponse.json(
      { error: "League API is offline. Start league-api on port 4001." },
      { status: 502 }
    );
  }
  const playersBody = await readJsonBody<{ items?: ExistingPlayer[]; error?: string }>(playersResponse);
  if (!playersResponse.ok) {
    return NextResponse.json(
      { error: playersBody?.error || "Failed to load existing players from API" },
      { status: 502 }
    );
  }

  const existingByIgn = new Map<string, ExistingPlayer>();
  for (const player of playersBody.items || []) {
    existingByIgn.set(normalizeIgn(player.ign), player);
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let removed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const nextPlayer of incoming) {
    const existing = existingByIgn.get(normalizeIgn(nextPlayer.ign));
    if (!existing) {
      let createResponse: Response;
      try {
        createResponse = await fetch(`${leagueApiBaseUrl()}/v1/players`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(nextPlayer)
        });
      } catch {
        failed += 1;
        errors.push(`${nextPlayer.ign}: League API offline`);
        continue;
      }
      if (createResponse.ok) {
        created += 1;
      } else {
        failed += 1;
        const body = await readJsonBody<{ error?: string }>(createResponse);
        errors.push(`${nextPlayer.ign}: ${body?.error || `create failed (${createResponse.status})`}`);
      }
      continue;
    }

    const changed =
      !sameValue(existing.ign, nextPlayer.ign) ||
      (nextPlayer.region !== undefined && !sameValue(existing.region, nextPlayer.region)) ||
      (nextPlayer.discordUsername !== undefined &&
        !sameValue(existing.discordUsername, nextPlayer.discordUsername)) ||
      (nextPlayer.discordUserId !== undefined && !sameValue(existing.discordUserId, nextPlayer.discordUserId)) ||
      (nextPlayer.epicGamesId !== undefined && !sameValue(existing.epicGamesId, nextPlayer.epicGamesId)) ||
      (nextPlayer.trackerUrl !== undefined && !sameValue(existing.trackerUrl, nextPlayer.trackerUrl));

    if (!changed) {
      unchanged += 1;
      continue;
    }

    const patchPayload: PlayerRecord = { ign: nextPlayer.ign };
    if (nextPlayer.region !== undefined) patchPayload.region = nextPlayer.region;
    if (nextPlayer.discordUsername !== undefined) patchPayload.discordUsername = nextPlayer.discordUsername;
    if (nextPlayer.discordUserId !== undefined) patchPayload.discordUserId = nextPlayer.discordUserId;
    if (nextPlayer.epicGamesId !== undefined) patchPayload.epicGamesId = nextPlayer.epicGamesId;
    if (nextPlayer.trackerUrl !== undefined) patchPayload.trackerUrl = nextPlayer.trackerUrl;

    let patchResponse: Response;
    try {
      patchResponse = await fetch(`${leagueApiBaseUrl()}/v1/players/${existing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patchPayload)
      });
    } catch {
      failed += 1;
      errors.push(`${nextPlayer.ign}: League API offline`);
      continue;
    }

    if (patchResponse.ok) {
      updated += 1;
    } else {
      failed += 1;
      const body = await readJsonBody<{ error?: string }>(patchResponse);
      errors.push(`${nextPlayer.ign}: ${body?.error || `update failed (${patchResponse.status})`}`);
    }
  }

  if (pruneNonApproved) {
    const approvedKeys = new Set(incoming.map((p) => normalizeIgn(p.ign)));
    for (const existing of playersBody?.items || []) {
      const key = normalizeIgn(existing.ign);
      if (approvedKeys.has(key)) continue;

      let deleteResponse: Response;
      try {
        deleteResponse = await fetch(`${leagueApiBaseUrl()}/v1/players/${existing.id}`, {
          method: "DELETE"
        });
      } catch {
        failed += 1;
        errors.push(`${existing.ign}: League API offline during delete`);
        continue;
      }

      if (deleteResponse.ok) {
        removed += 1;
      } else {
        failed += 1;
        const body = await readJsonBody<{ error?: string }>(deleteResponse);
        errors.push(`${existing.ign}: ${body?.error || `delete failed (${deleteResponse.status})`}`);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    summary: {
      totalRows: rows.length - 1,
      uniquePlayers: incoming.length,
      skippedNoIgn,
      skippedByValidation,
      created,
      updated,
      unchanged,
      removed,
      failed,
      source,
      errors: errors.slice(0, 20)
    }
  });
}
