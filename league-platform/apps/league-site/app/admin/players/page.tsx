"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SiteShell } from "../../components/site-shell";

type Player = {
  id: string;
  ign: string;
  region: string | null;
  discordUsername: string | null;
  discordUserId: string | null;
  epicGamesId: string | null;
  trackerUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type PlayerDraft = {
  ign: string;
  region: string;
  discordUsername: string;
  discordUserId: string;
  epicGamesId: string;
  trackerUrl: string;
};

type SyncSummary = {
  totalRows: number;
  uniquePlayers: number;
  skippedNoIgn: number;
  skippedByValidation?: number;
  created: number;
  updated: number;
  unchanged: number;
  removed?: number;
  failed: number;
  source?: "private_api" | "csv";
  errors: string[];
};

type SyncHealth = "idle" | "running" | "success" | "error";
const AUTO_SYNC_MINUTES = 5;
const AUTO_SYNC_MS = AUTO_SYNC_MINUTES * 60 * 1000;

const blankDraft: PlayerDraft = {
  ign: "",
  region: "",
  discordUsername: "",
  discordUserId: "",
  epicGamesId: "",
  trackerUrl: ""
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

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const syncInFlightRef = useRef(false);
  const [draftsById, setDraftsById] = useState<Record<string, PlayerDraft>>({});
  const [filter, setFilter] = useState<"all" | "needs-link" | "linked">("all");
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);
  const [syncHealth, setSyncHealth] = useState<SyncHealth>("idle");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastSyncMessage, setLastSyncMessage] = useState<string>("Never synced");

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/players", { cache: "no-store" });
      const body = await readJsonBody<{ items?: Player[]; error?: string }>(res);
      if (!res.ok) throw new Error(body?.error || "Failed to load players");

      const rows = body?.items || [];
      setPlayers(rows);
      setDraftsById(
        Object.fromEntries(
          rows.map((p) => [
            p.id,
            {
              ign: p.ign,
              region: p.region || "",
              discordUsername: p.discordUsername || "",
              discordUserId: p.discordUserId || "",
              epicGamesId: p.epicGamesId || "",
              trackerUrl: p.trackerUrl || ""
            }
          ])
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load players");
    } finally {
      setLoading(false);
    }
  }, []);

  const syncFromGoogleSheet = useCallback(
    async (silent = false) => {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      setSyncLoading(true);
      setSyncHealth("running");
      if (!silent) setError(null);
      try {
        const res = await fetch("/api/admin/players/sync-google-sheet", {
          method: "POST",
          headers: { "content-type": "application/json" }
        });
        const body = await readJsonBody<{
          error?: string;
          summary?: SyncSummary;
        }>(res);
        if (!res.ok) throw new Error(body?.error || "Failed to sync from Google Sheet");
        setSyncSummary(body?.summary || null);
        setSyncHealth("success");
        const nowIso = new Date().toISOString();
        setLastSyncAt(nowIso);
        setLastSyncMessage("Last sync succeeded");
        await loadPlayers();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to sync from Google Sheet";
        setSyncHealth("error");
        const nowIso = new Date().toISOString();
        setLastSyncAt(nowIso);
        setLastSyncMessage(message);
        if (!silent) setError(message);
      } finally {
        syncInFlightRef.current = false;
        setSyncLoading(false);
      }
    },
    [loadPlayers]
  );

  useEffect(() => {
    void loadPlayers();
    void syncFromGoogleSheet(true);
    const timer = window.setInterval(() => {
      void syncFromGoogleSheet(true);
    }, AUTO_SYNC_MS);
    return () => window.clearInterval(timer);
  }, [loadPlayers, syncFromGoogleSheet]);

  const filteredPlayers = useMemo(() => {
    if (filter === "needs-link") return players.filter((p) => !p.discordUserId);
    if (filter === "linked") return players.filter((p) => Boolean(p.discordUserId));
    return players;
  }, [filter, players]);

  async function savePlayer(id: string) {
    const draft = draftsById[id];
    if (!draft) return;
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/players/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft)
      });
      const body = await readJsonBody<{ item?: Player; error?: string }>(res);
      if (!res.ok) throw new Error(body?.error || "Failed to update player");
      if (body?.item) {
        setPlayers((prev) => prev.map((p) => (p.id === id ? body.item! : p)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update player");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <SiteShell
      title="Admin / Players"
      subtitle="Load players from API, review Discord linkage, and edit profile metadata."
    >
      <section className="card flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Google Sheet Sync</h2>
          <div className="flex items-center gap-2">
            <span
              className={`chip ${
                syncHealth === "success"
                  ? "text-emerald-300"
                  : syncHealth === "error"
                    ? "text-red-300"
                    : syncHealth === "running"
                      ? "text-amber-200"
                      : "text-muted"
              }`}
            >
              {syncHealth === "running"
                ? "Sync Running"
                : syncHealth === "success"
                  ? "Sync Healthy"
                  : syncHealth === "error"
                    ? "Sync Error"
                    : "Sync Idle"}
            </span>
            <button
              type="button"
              disabled={syncLoading}
              onClick={() => void syncFromGoogleSheet(false)}
              className="rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {syncLoading ? "Syncing..." : "Sync From Google Sheet"}
            </button>
          </div>
        </div>
        <p className="text-sm text-muted">
          Auto-sync is on every {AUTO_SYNC_MINUTES} minutes. Sync reads Google Sheet data on the server and upserts by
          IGN.
        </p>
        <p className="text-xs text-muted">
          {lastSyncAt
            ? `${lastSyncMessage} at ${new Date(lastSyncAt).toLocaleTimeString()}`
            : "No successful sync yet"}
        </p>

        {syncSummary ? (
          <div className="rounded-md border border-border bg-surface-2 p-3 text-sm">
            <p className="font-semibold text-foreground">Last Sync Result</p>
            <p className="mt-1 text-muted">
              Rows: {syncSummary.totalRows} | Unique: {syncSummary.uniquePlayers} | Created: {syncSummary.created} |
              Updated: {syncSummary.updated} | Unchanged: {syncSummary.unchanged} | Removed:{" "}
              {syncSummary.removed ?? 0} | Failed: {syncSummary.failed}
            </p>
            {syncSummary.source ? (
              <p className="mt-1 text-muted">
                Source: {syncSummary.source === "private_api" ? "Private Google API" : "Public CSV"}
              </p>
            ) : null}
            {syncSummary.skippedNoIgn > 0 ? (
              <p className="mt-1 text-amber-200">Skipped empty IGN rows: {syncSummary.skippedNoIgn}</p>
            ) : null}
            {syncSummary.skippedByValidation && syncSummary.skippedByValidation > 0 ? (
              <p className="mt-1 text-amber-200">
                Skipped by validation filter: {syncSummary.skippedByValidation}
              </p>
            ) : null}
            {syncSummary.errors.length > 0 ? (
              <div className="mt-2">
                <p className="text-red-300">Errors</p>
                <ul className="mt-1 list-disc pl-5 text-red-200">
                  {syncSummary.errors.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="card flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Player Manager</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`chip ${filter === "all" ? "text-foreground" : ""}`}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            <button
              type="button"
              className={`chip ${filter === "needs-link" ? "text-foreground" : ""}`}
              onClick={() => setFilter("needs-link")}
            >
              Needs Discord Link
            </button>
            <button
              type="button"
              className={`chip ${filter === "linked" ? "text-foreground" : ""}`}
              onClick={() => setFilter("linked")}
            >
              Linked
            </button>
            <button
              type="button"
              className="chip hover:text-foreground"
              onClick={() => void loadPlayers()}
            >
              Refresh
            </button>
          </div>
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {loading ? <p className="text-sm text-muted">Loading players...</p> : null}
        {!loading && filteredPlayers.length === 0 ? (
          <p className="text-sm text-muted">No players found for this filter.</p>
        ) : null}

        {!loading && filteredPlayers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="px-2 py-1">IGN</th>
                  <th className="px-2 py-1">Region</th>
                  <th className="px-2 py-1">Epic Games ID</th>
                  <th className="px-2 py-1">Discord Username</th>
                  <th className="px-2 py-1">Discord User ID</th>
                  <th className="px-2 py-1">Tracker</th>
                  <th className="px-2 py-1">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((p) => {
                  const draft = draftsById[p.id] || blankDraft;
                  return (
                    <tr key={p.id} className="rounded-lg border border-border bg-surface-2">
                      <td className="px-2 py-2">
                        <input
                          className="w-44 rounded-md border border-border bg-surface px-2 py-1"
                          value={draft.ign}
                          onChange={(e) =>
                            setDraftsById((prev) => ({ ...prev, [p.id]: { ...draft, ign: e.target.value } }))
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-28 rounded-md border border-border bg-surface px-2 py-1"
                          value={draft.region}
                          onChange={(e) =>
                            setDraftsById((prev) => ({ ...prev, [p.id]: { ...draft, region: e.target.value } }))
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-52 rounded-md border border-border bg-surface px-2 py-1"
                          value={draft.epicGamesId}
                          onChange={(e) =>
                            setDraftsById((prev) => ({ ...prev, [p.id]: { ...draft, epicGamesId: e.target.value } }))
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-52 rounded-md border border-border bg-surface px-2 py-1"
                          value={draft.discordUsername}
                          onChange={(e) =>
                            setDraftsById((prev) => ({
                              ...prev,
                              [p.id]: { ...draft, discordUsername: e.target.value }
                            }))
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-56 rounded-md border border-border bg-surface px-2 py-1"
                          value={draft.discordUserId}
                          onChange={(e) =>
                            setDraftsById((prev) => ({
                              ...prev,
                              [p.id]: { ...draft, discordUserId: e.target.value }
                            }))
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <input
                            className="w-56 rounded-md border border-border bg-surface px-2 py-1"
                            value={draft.trackerUrl}
                            onChange={(e) =>
                              setDraftsById((prev) => ({ ...prev, [p.id]: { ...draft, trackerUrl: e.target.value } }))
                            }
                            placeholder="https://rocketleague.tracker.network/..."
                          />
                          {draft.trackerUrl.trim() ? (
                            <a
                              href={draft.trackerUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="chip whitespace-nowrap text-foreground hover:text-primary"
                            >
                              Open
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          className="rounded-md border border-primary bg-primary px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={savingId === p.id || !draft.ign.trim()}
                          onClick={() => void savePlayer(p.id)}
                        >
                          {savingId === p.id ? "Saving..." : "Save"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </SiteShell>
  );
}

