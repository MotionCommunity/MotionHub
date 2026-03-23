"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteShell } from "../../components/site-shell";

type Tournament = {
  id: string;
  name: string;
};

type TeamRow = {
  id: string;
  tournamentId: string;
  name: string;
  seed: number | null;
  placement: number | null;
  discordRoleId: string | null;
  discordTextChannelId: string | null;
  discordVoiceChannelId: string | null;
};

type TeamDraft = {
  name: string;
  seed: string;
  placement: string;
  discordRoleId: string;
  discordTextChannelId: string;
  discordVoiceChannelId: string;
};

const emptyCreate: TeamDraft = {
  name: "",
  seed: "",
  placement: "",
  discordRoleId: "",
  discordTextChannelId: "",
  discordVoiceChannelId: ""
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

export default function AdminTeamsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentId, setTournamentId] = useState("");
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [draftsById, setDraftsById] = useState<Record<string, TeamDraft>>({});
  const [createDraft, setCreateDraft] = useState<TeamDraft>(emptyCreate);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTournaments = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tournaments", { cache: "no-store" });
      const body = await readJsonBody<{ items?: Tournament[]; error?: string }>(res);
      if (!res.ok) throw new Error(body?.error || "Failed to load tournaments");
      const items = body?.items || [];
      setTournaments(items);
      setTournamentId((prev) => prev || items[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tournaments");
    }
  }, []);

  const loadTeams = useCallback(async (tid: string) => {
    if (!tid) {
      setTeams([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tournaments/${encodeURIComponent(tid)}/teams`, { cache: "no-store" });
      const body = await readJsonBody<{ items?: TeamRow[]; error?: string }>(res);
      if (!res.ok) throw new Error(body?.error || "Failed to load teams");
      const rows = body?.items || [];
      setTeams(rows);
      setDraftsById(
        Object.fromEntries(
          rows.map((t) => [
            t.id,
            {
              name: t.name || "",
              seed: t.seed === null ? "" : String(t.seed),
              placement: t.placement === null ? "" : String(t.placement),
              discordRoleId: t.discordRoleId || "",
              discordTextChannelId: t.discordTextChannelId || "",
              discordVoiceChannelId: t.discordVoiceChannelId || ""
            }
          ])
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load teams");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTournaments();
  }, [loadTournaments]);

  useEffect(() => {
    void loadTeams(tournamentId);
  }, [tournamentId, loadTeams]);

  const tournamentLabel = useMemo(
    () => Object.fromEntries(tournaments.map((t) => [t.id, t.name])),
    [tournaments]
  );

  function toPayload(d: TeamDraft) {
    return {
      name: d.name.trim(),
      seed: d.seed.trim() ? Number(d.seed.trim()) : null,
      placement: d.placement.trim() ? Number(d.placement.trim()) : null,
      discordRoleId: d.discordRoleId.trim() || null,
      discordTextChannelId: d.discordTextChannelId.trim() || null,
      discordVoiceChannelId: d.discordVoiceChannelId.trim() || null
    };
  }

  async function createTeam() {
    if (!tournamentId) return;
    setCreating(true);
    setError(null);
    try {
      const payload = toPayload(createDraft);
      if (!payload.name) throw new Error("Team name is required");
      const res = await fetch(`/api/admin/tournaments/${encodeURIComponent(tournamentId)}/teams`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await readJsonBody<{ item?: TeamRow; error?: string }>(res);
      if (!res.ok) throw new Error(body?.error || "Failed to create team");
      setCreateDraft(emptyCreate);
      await loadTeams(tournamentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setCreating(false);
    }
  }

  async function saveTeam(id: string) {
    const draft = draftsById[id];
    if (!draft) return;
    setSavingId(id);
    setError(null);
    try {
      const payload = toPayload(draft);
      if (!payload.name) throw new Error("Team name is required");
      const res = await fetch(`/api/admin/teams/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await readJsonBody<{ item?: TeamRow; error?: string }>(res);
      if (!res.ok) throw new Error(body?.error || "Failed to update team");
      if (body?.item) {
        setTeams((prev) => prev.map((t) => (t.id === id ? body.item! : t)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update team");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteTeam(id: string) {
    if (!confirm("Delete this team? Matches referencing this team ID may need updating.")) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/teams/${encodeURIComponent(id)}`, { method: "DELETE" });
      const body = await readJsonBody<{ error?: string }>(res);
      if (!res.ok) throw new Error(body?.error || "Failed to delete team");
      await loadTeams(tournamentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete team");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <SiteShell
      title="Admin / Teams"
      subtitle="Edit existing teams: change any field in a row and click Save on that row. Save Discord role and channel IDs per tournament; use them on Matches for check-in."
    >
      <section className="card flex flex-col gap-2 text-sm text-muted">
        <p>
          In Discord, create team channels under a category, then set permissions: deny <code className="text-foreground">@everyone</code>{" "}
          <strong>View Channel</strong>, allow the team role. Paste IDs here (Developer Mode → Copy ID). See{" "}
          <code className="text-foreground">docs/discord-team-channels.md</code> in the repo for a full template.
        </p>
      </section>

      <section className="card flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">Tournament</span>
            <select
              className="rounded-md border border-border bg-surface-2 px-3 py-2"
              value={tournamentId}
              onChange={(e) => setTournamentId(e.target.value)}
            >
              <option value="">Select tournament</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="chip hover:text-foreground" onClick={() => void loadTeams(tournamentId)} disabled={!tournamentId}>
            Refresh
          </button>
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {loading ? <p className="text-sm text-muted">Loading teams...</p> : null}

        <h2 className="text-2xl font-semibold">Add team</h2>
        <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
          <input
            className="rounded-md border border-border bg-surface-2 px-3 py-2"
            placeholder="Team name"
            value={createDraft.name}
            onChange={(e) => setCreateDraft((p) => ({ ...p, name: e.target.value }))}
            disabled={!tournamentId}
          />
          <input
            className="rounded-md border border-border bg-surface-2 px-3 py-2"
            placeholder="Seed (optional)"
            value={createDraft.seed}
            onChange={(e) => setCreateDraft((p) => ({ ...p, seed: e.target.value }))}
            disabled={!tournamentId}
          />
          <input
            className="rounded-md border border-border bg-surface-2 px-3 py-2"
            placeholder="Placement (optional)"
            value={createDraft.placement}
            onChange={(e) => setCreateDraft((p) => ({ ...p, placement: e.target.value }))}
            disabled={!tournamentId}
          />
          <input
            className="rounded-md border border-border bg-surface-2 px-3 py-2"
            placeholder="Discord role ID"
            value={createDraft.discordRoleId}
            onChange={(e) => setCreateDraft((p) => ({ ...p, discordRoleId: e.target.value }))}
            disabled={!tournamentId}
          />
          <input
            className="rounded-md border border-border bg-surface-2 px-3 py-2 md:col-span-2"
            placeholder="Team text channel ID"
            value={createDraft.discordTextChannelId}
            onChange={(e) => setCreateDraft((p) => ({ ...p, discordTextChannelId: e.target.value }))}
            disabled={!tournamentId}
          />
          <input
            className="rounded-md border border-border bg-surface-2 px-3 py-2 md:col-span-2"
            placeholder="Team voice channel ID (optional)"
            value={createDraft.discordVoiceChannelId}
            onChange={(e) => setCreateDraft((p) => ({ ...p, discordVoiceChannelId: e.target.value }))}
            disabled={!tournamentId}
          />
        </div>
        <div>
          <button
            type="button"
            disabled={creating || !tournamentId || !createDraft.name.trim()}
            onClick={() => void createTeam()}
            className="rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? "Creating..." : "Create team"}
          </button>
        </div>
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">
          Teams {tournamentId ? `— ${tournamentLabel[tournamentId] || ""}` : ""}
        </h2>
        {!tournamentId ? <p className="text-sm text-muted">Select a tournament to list teams.</p> : null}
        {!loading && tournamentId && teams.length === 0 ? (
          <p className="text-sm text-muted">No teams yet. Add one above.</p>
        ) : null}

        {teams.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="px-2 py-1">Name</th>
                  <th className="px-2 py-1">Seed / Place</th>
                  <th className="px-2 py-1">Role ID</th>
                  <th className="px-2 py-1">Text / Voice IDs</th>
                  <th className="px-2 py-1">Team UUID</th>
                  <th className="px-2 py-1">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => {
                  const d = draftsById[t.id] || {
                    name: t.name,
                    seed: t.seed === null ? "" : String(t.seed),
                    placement: t.placement === null ? "" : String(t.placement),
                    discordRoleId: t.discordRoleId || "",
                    discordTextChannelId: t.discordTextChannelId || "",
                    discordVoiceChannelId: t.discordVoiceChannelId || ""
                  };
                  return (
                    <tr key={t.id} className="align-top">
                      <td className="px-2 py-2">
                        <input
                          className="w-40 rounded-md border border-border bg-surface-2 px-2 py-1"
                          value={d.name}
                          onChange={(e) =>
                            setDraftsById((prev) => ({ ...prev, [t.id]: { ...d, name: e.target.value } }))
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="mb-1 w-16 rounded-md border border-border bg-surface-2 px-2 py-1"
                          placeholder="seed"
                          value={d.seed}
                          onChange={(e) =>
                            setDraftsById((prev) => ({ ...prev, [t.id]: { ...d, seed: e.target.value } }))
                          }
                        />
                        <input
                          className="w-16 rounded-md border border-border bg-surface-2 px-2 py-1"
                          placeholder="place"
                          value={d.placement}
                          onChange={(e) =>
                            setDraftsById((prev) => ({ ...prev, [t.id]: { ...d, placement: e.target.value } }))
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-48 rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-xs"
                          placeholder="role id"
                          value={d.discordRoleId}
                          onChange={(e) =>
                            setDraftsById((prev) => ({ ...prev, [t.id]: { ...d, discordRoleId: e.target.value } }))
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="mb-1 w-48 rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-xs"
                          placeholder="text channel"
                          value={d.discordTextChannelId}
                          onChange={(e) =>
                            setDraftsById((prev) => ({ ...prev, [t.id]: { ...d, discordTextChannelId: e.target.value } }))
                          }
                        />
                        <input
                          className="w-48 rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-xs"
                          placeholder="voice channel"
                          value={d.discordVoiceChannelId}
                          onChange={(e) =>
                            setDraftsById((prev) => ({ ...prev, [t.id]: { ...d, discordVoiceChannelId: e.target.value } }))
                          }
                        />
                      </td>
                      <td className="px-2 py-2 font-mono text-xs text-muted">{t.id}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            className="rounded-md border border-primary bg-primary px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                            disabled={savingId === t.id}
                            onClick={() => void saveTeam(t.id)}
                          >
                            {savingId === t.id ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            className="chip text-xs hover:text-foreground disabled:opacity-60"
                            disabled={deletingId === t.id}
                            onClick={() => void deleteTeam(t.id)}
                          >
                            {deletingId === t.id ? "..." : "Delete"}
                          </button>
                        </div>
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
