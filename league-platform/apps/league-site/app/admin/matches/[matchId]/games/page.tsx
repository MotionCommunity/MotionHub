"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SiteShell } from "../../../../components/site-shell";

type ReplayFileRow = {
  id: string;
  storageKey: string;
  sha256: string | null;
  parserStatus: "pending" | "parsed" | "failed";
  parserError: string | null;
  createdAt: string;
};

type GameRow = {
  id: string;
  matchId: string;
  gameNumber: number;
  winnerTeamId: string | null;
  durationSeconds: number | null;
  replayFiles: ReplayFileRow[];
};

type MatchDetail = {
  id: string;
  tournamentId: string;
  roundCode: string | null;
  slot: string | null;
  teamAId: string | null;
  teamBId: string | null;
  status: string;
  tournament?: { id: string; name: string };
  games: GameRow[];
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

export default function MatchGamesPage() {
  const params = useParams();
  const matchId = typeof params?.matchId === "string" ? params.matchId : "";

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameNumber, setGameNumber] = useState("1");
  const [creating, setCreating] = useState(false);
  const [uploadBusyId, setUploadBusyId] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!matchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/matches/${encodeURIComponent(matchId)}`, { cache: "no-store" });
      const body = await readJsonBody<{ item?: MatchDetail; error?: string }>(res);
      if (!res.ok) throw new Error(body?.error || "Failed to load match");
      const item = body?.item;
      if (!item) throw new Error("No match data");
      setMatch(item as MatchDetail);
      const nums = (item as MatchDetail).games?.map((g) => g.gameNumber) || [];
      const next = nums.length ? Math.max(...nums) + 1 : 1;
      setGameNumber(String(next));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createGame() {
    if (!matchId) return;
    setCreating(true);
    setError(null);
    try {
      const n = Number(gameNumber);
      if (!Number.isFinite(n) || n < 1) throw new Error("Game number must be a positive integer");
      const res = await fetch(`/api/admin/matches/${encodeURIComponent(matchId)}/games`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameNumber: Math.floor(n) })
      });
      const body = await readJsonBody<{ error?: string }>(res);
      if (!res.ok) throw new Error(body?.error || "Failed to create game");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create game");
    } finally {
      setCreating(false);
    }
  }

  async function uploadReplay(gameId: string, file: File | null) {
    if (!file) return;
    setUploadBusyId(gameId);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/api/admin/games/${encodeURIComponent(gameId)}/upload-replay`, {
        method: "POST",
        body: fd
      });
      const body = await readJsonBody<{ error?: string; duplicate?: boolean; queued?: boolean }>(res);
      if (!res.ok) throw new Error(body?.error || "Upload failed");
      if (body?.duplicate) {
        setError("This replay was already ingested (duplicate SHA).");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadBusyId(null);
    }
  }

  async function deleteGame(gameId: string) {
    if (!confirm("Delete this game row? Replay files will be unlinked (replay rows kept).")) return;
    setDeleteBusyId(gameId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/games/${encodeURIComponent(gameId)}`, { method: "DELETE" });
      const body = await readJsonBody<{ error?: string }>(res);
      if (!res.ok) throw new Error(body?.error || "Failed to delete");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleteBusyId(null);
    }
  }

  const title = match?.tournament?.name
    ? `${match.tournament.name} — games`
    : "Match games";

  return (
    <SiteShell
      title={`Admin / ${title}`}
      subtitle="Add one row per game (Game 1, 2, …), then drop the .replay here. The worker parses it and writes player stats to the database for that game."
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/matches" className="chip hover:text-foreground">
          ← Back to matches
        </Link>
        <button type="button" className="chip hover:text-foreground" onClick={() => void load()} disabled={loading}>
          Refresh
        </button>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {loading ? <p className="text-sm text-muted">Loading…</p> : null}

      {!loading && match ? (
        <section className="card flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Match</h2>
          <p className="text-sm text-muted">
            Round: {match.roundCode || "—"} · Slot: {match.slot || "—"} · Status: {match.status}
          </p>

          <div className="flex flex-wrap items-end gap-2 border-t border-border/70 pt-3">
            <label className="flex flex-col text-sm">
              <span className="text-muted">Next game #</span>
              <input
                className="mt-1 w-24 rounded-md border border-border bg-surface-2 px-2 py-1"
                value={gameNumber}
                onChange={(e) => setGameNumber(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={creating}
              onClick={() => void createGame()}
              className="rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {creating ? "Adding…" : "Add game slot"}
            </button>
          </div>
        </section>
      ) : null}

      {!loading && match && match.games.length === 0 ? (
        <p className="text-sm text-muted">No games yet. Add a game slot, then upload a .replay file.</p>
      ) : null}

      {!loading && match && match.games.length > 0 ? (
        <section className="card flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Games & replays</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="py-2 pr-3">Game</th>
                  <th className="py-2 pr-3">Upload .replay</th>
                  <th className="py-2 pr-3">Replay / parse status</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {match.games.map((g) => {
                  const latest = g.replayFiles[0];
                  return (
                    <tr key={g.id} className="border-b border-border/60 align-top">
                      <td className="py-3 pr-3 font-medium">Game {g.gameNumber}</td>
                      <td className="py-3 pr-3">
                        <input
                          type="file"
                          accept=".replay,.Replay"
                          disabled={uploadBusyId === g.id}
                          className="max-w-xs text-xs"
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            e.target.value = "";
                            void uploadReplay(g.id, f);
                          }}
                        />
                        {uploadBusyId === g.id ? (
                          <span className="ml-2 text-xs text-muted">Uploading…</span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs">
                        {latest ? (
                          <div>
                            <div>
                              <span
                                className={
                                  latest.parserStatus === "parsed"
                                    ? "text-green-400"
                                    : latest.parserStatus === "failed"
                                      ? "text-red-300"
                                      : "text-amber-300"
                                }
                              >
                                {latest.parserStatus}
                              </span>{" "}
                              · {latest.id.slice(0, 8)}…
                            </div>
                            <div className="mt-1 max-w-md truncate text-muted" title={latest.storageKey}>
                              {latest.storageKey}
                            </div>
                            {latest.parserError ? (
                              <div className="mt-1 text-red-300" title={latest.parserError || ""}>
                                {latest.parserError.slice(0, 120)}
                                {latest.parserError.length > 120 ? "…" : ""}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted">No replay yet</span>
                        )}
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          className="text-xs text-red-300 underline hover:text-foreground disabled:opacity-50"
                          disabled={deleteBusyId === g.id}
                          onClick={() => void deleteGame(g.id)}
                        >
                          {deleteBusyId === g.id ? "…" : "Delete game"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">
            Set <code className="text-foreground">REPLAY_UPLOADS_DIR</code> on the site and worker to the same absolute
            folder. Files are stored under <code className="text-foreground">matches/&lt;matchId&gt;/</code> and queued for
            the parser worker.
          </p>
        </section>
      ) : null}
    </SiteShell>
  );
}
