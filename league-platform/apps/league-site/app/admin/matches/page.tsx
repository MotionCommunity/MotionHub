"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteShell } from "../../components/site-shell";

type Tournament = {
  id: string;
  name: string;
};

type MatchRow = {
  id: string;
  tournamentId: string;
  tournament?: { id: string; name: string };
  roundCode: string | null;
  slot: string | null;
  teamAId: string | null;
  teamBId: string | null;
  winnerTeamId: string | null;
  bestOf: number | null;
  status: "scheduled" | "in_progress" | "completed" | "disputed";
  scheduledAt: string | null;
  playedAt: string | null;
  discordChannelId: string | null;
  teamARoleId: string | null;
  teamBRoleId: string | null;
  checkInMessageId: string | null;
  checkInRequestedAt: string | null;
  teamACheckedInAt: string | null;
  teamBCheckedInAt: string | null;
};

type MatchDraft = {
  tournamentId: string;
  roundCode: string;
  slot: string;
  teamAId: string;
  teamBId: string;
  winnerTeamId: string;
  bestOf: string;
  status: "scheduled" | "in_progress" | "completed" | "disputed";
  scheduledAt: string;
  playedAt: string;
  discordChannelId: string;
  teamARoleId: string;
  teamBRoleId: string;
  checkInMessageId: string;
  checkInRequestedAt: string;
  teamACheckedInAt: string;
  teamBCheckedInAt: string;
};

type TeamRoleOption = {
  name: string;
  roleId: string;
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

function mergeRoleOptions(defaults: TeamRoleOption[], tournamentTeams: TeamRow[]): TeamRoleOption[] {
  const map = new Map<string, string>();
  for (const o of defaults) map.set(o.roleId, o.name);
  for (const t of tournamentTeams) {
    if (t.discordRoleId) map.set(t.discordRoleId, `${t.name} (saved)`);
  }
  return [...map.entries()].map(([roleId, name]) => ({ roleId, name }));
}

function applySavedRolesFromTeams(draft: MatchDraft, teams: TeamRow[]): MatchDraft {
  const a = teams.find((x) => x.id === draft.teamAId);
  const b = teams.find((x) => x.id === draft.teamBId);
  return {
    ...draft,
    teamARoleId: a?.discordRoleId ?? draft.teamARoleId,
    teamBRoleId: b?.discordRoleId ?? draft.teamBRoleId
  };
}

const emptyDraft: MatchDraft = {
  tournamentId: "",
  roundCode: "",
  slot: "",
  teamAId: "",
  teamBId: "",
  winnerTeamId: "",
  bestOf: "5",
  status: "scheduled",
  scheduledAt: "",
  playedAt: "",
  discordChannelId: "",
  teamARoleId: "",
  teamBRoleId: "",
  checkInMessageId: "",
  checkInRequestedAt: "",
  teamACheckedInAt: "",
  teamBCheckedInAt: ""
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

export default function AdminMatchesPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [draftsById, setDraftsById] = useState<Record<string, MatchDraft>>({});
  const [createDraft, setCreateDraft] = useState<MatchDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkInBusyId, setCheckInBusyId] = useState<string | null>(null);
  const [discordStartBusyId, setDiscordStartBusyId] = useState<string | null>(null);
  const [voiceSlotByMatchId, setVoiceSlotByMatchId] = useState<Record<string, "1" | "2">>({});
  /** When `NEXT_PUBLIC_DISCORD_MATCH_POD_MODE=1`, hide legacy "Voice slot 1/2" (pod mode uses per-match VCs). */
  const discordPodMode = process.env.NEXT_PUBLIC_DISCORD_MATCH_POD_MODE === "1";
  const [discordTimerInfo, setDiscordTimerInfo] = useState<string | null>(null);
  const [teamRoleOptions, setTeamRoleOptions] = useState<TeamRoleOption[]>([]);
  const [teamsByTournament, setTeamsByTournament] = useState<Record<string, TeamRow[]>>({});
  const [statusFilter, setStatusFilter] = useState<"all" | "scheduled" | "in_progress" | "completed" | "disputed">("all");
  const [tournamentFilter, setTournamentFilter] = useState<string>("all");

  const loadTournaments = useCallback(async () => {
    const res = await fetch("/api/admin/tournaments", { cache: "no-store" });
    const body = await readJsonBody<{ items?: Tournament[]; error?: string }>(res);
    if (!res.ok) throw new Error(body?.error || "Failed to load tournaments");
    const items = body?.items || [];
    setTournaments(items);
    setCreateDraft((prev) => ({
      ...prev,
      tournamentId: prev.tournamentId || items[0]?.id || ""
    }));
  }, []);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (statusFilter !== "all") q.set("status", statusFilter);
      if (tournamentFilter !== "all") q.set("tournamentId", tournamentFilter);
      const res = await fetch(`/api/admin/matches${q.size ? `?${q.toString()}` : ""}`, { cache: "no-store" });
      const body = await readJsonBody<{ items?: MatchRow[]; error?: string }>(res);
      if (!res.ok) throw new Error(body?.error || "Failed to load matches");
      const rows = body?.items || [];
      setMatches(rows);
      setDraftsById(
        Object.fromEntries(
          rows.map((m) => [
            m.id,
            {
              tournamentId: m.tournamentId,
              roundCode: m.roundCode || "",
              slot: m.slot || "",
              teamAId: m.teamAId || "",
              teamBId: m.teamBId || "",
              winnerTeamId: m.winnerTeamId || "",
              bestOf: m.bestOf === null ? "" : String(m.bestOf),
              status: m.status,
              scheduledAt: m.scheduledAt || "",
              playedAt: m.playedAt || "",
              discordChannelId: m.discordChannelId || "",
              teamARoleId: m.teamARoleId || "",
              teamBRoleId: m.teamBRoleId || "",
              checkInMessageId: m.checkInMessageId || "",
              checkInRequestedAt: m.checkInRequestedAt || "",
              teamACheckedInAt: m.teamACheckedInAt || "",
              teamBCheckedInAt: m.teamBCheckedInAt || ""
            }
          ])
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load matches");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, tournamentFilter]);

  const loadTeamRoleOptions = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/discord/team-roles", { cache: "no-store" });
      const body = await readJsonBody<{ items?: TeamRoleOption[] }>(res);
      if (res.ok) {
        setTeamRoleOptions(body?.items || []);
      }
    } catch {
      // Keep page usable even if role options endpoint fails.
    }
  }, []);

  const loadTeamsForTournaments = useCallback(async (ids: string[]) => {
    const unique = [...new Set(ids.filter(Boolean))];
    await Promise.all(
      unique.map(async (tid) => {
        try {
          const res = await fetch(`/api/admin/tournaments/${encodeURIComponent(tid)}/teams`, { cache: "no-store" });
          const body = await readJsonBody<{ items?: TeamRow[] }>(res);
          if (res.ok && body?.items) {
            setTeamsByTournament((prev) => ({ ...prev, [tid]: body.items! }));
          }
        } catch {
          // ignore
        }
      })
    );
  }, []);

  useEffect(() => {
    void loadTournaments();
    void loadTeamRoleOptions();
  }, [loadTeamRoleOptions, loadTournaments]);

  useEffect(() => {
    const ids = new Set<string>();
    if (createDraft.tournamentId) ids.add(createDraft.tournamentId);
    matches.forEach((m) => {
      if (m.tournamentId) ids.add(m.tournamentId);
    });
    void loadTeamsForTournaments([...ids]);
  }, [matches, createDraft.tournamentId, loadTeamsForTournaments]);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  const tournamentNameById = useMemo(
    () => Object.fromEntries(tournaments.map((t) => [t.id, t.name])),
    [tournaments]
  );

  const roleOptionsByTournamentId = useMemo(() => {
    const out: Record<string, TeamRoleOption[]> = {};
    const tids = new Set<string>();
    if (createDraft.tournamentId) tids.add(createDraft.tournamentId);
    matches.forEach((m) => {
      if (m.tournamentId) tids.add(m.tournamentId);
    });
    for (const tid of tids) {
      out[tid] = mergeRoleOptions(teamRoleOptions, teamsByTournament[tid] || []);
    }
    return out;
  }, [teamRoleOptions, teamsByTournament, matches, createDraft.tournamentId]);

  function toPayload(d: MatchDraft) {
    return {
      tournamentId: d.tournamentId.trim(),
      roundCode: d.roundCode.trim() || null,
      slot: d.slot.trim() || null,
      teamAId: d.teamAId.trim() || null,
      teamBId: d.teamBId.trim() || null,
      winnerTeamId: d.winnerTeamId.trim() || null,
      bestOf: d.bestOf.trim() ? Number(d.bestOf.trim()) : null,
      status: d.status,
      scheduledAt: d.scheduledAt.trim() || null,
      playedAt: d.playedAt.trim() || null,
      discordChannelId: d.discordChannelId.trim() || null,
      teamARoleId: d.teamARoleId.trim() || null,
      teamBRoleId: d.teamBRoleId.trim() || null,
      checkInMessageId: d.checkInMessageId.trim() || null,
      checkInRequestedAt: d.checkInRequestedAt.trim() || null,
      teamACheckedInAt: d.teamACheckedInAt.trim() || null,
      teamBCheckedInAt: d.teamBCheckedInAt.trim() || null
    };
  }

  async function createMatch() {
    setCreating(true);
    setError(null);
    try {
      const payload = toPayload(createDraft);
      if (!payload.tournamentId) throw new Error("tournamentId is required");
      const res = await fetch("/api/admin/matches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await readJsonBody<{ item?: MatchRow; error?: string }>(res);
      if (!res.ok) throw new Error(body?.error || "Failed to create match");
      setCreateDraft((prev) => ({ ...emptyDraft, tournamentId: prev.tournamentId }));
      await loadMatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create match");
    } finally {
      setCreating(false);
    }
  }

  async function saveMatch(id: string) {
    const draft = draftsById[id];
    if (!draft) return;
    setSavingId(id);
    setError(null);
    try {
      const payload = toPayload(draft);
      if (!payload.tournamentId) throw new Error("tournamentId is required");
      const res = await fetch(`/api/admin/matches/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await readJsonBody<{ item?: MatchRow; error?: string }>(res);
      if (!res.ok) throw new Error(body?.error || "Failed to update match");
      if (body?.item) {
        setMatches((prev) => prev.map((m) => (m.id === id ? body.item! : m)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update match");
    } finally {
      setSavingId(null);
    }
  }

  async function runCheckInAction(id: string, action: "send_checkin" | "sync_reactions") {
    setCheckInBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/matches/${id}/check-in`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action })
      });
      const body = await readJsonBody<{
        item?: MatchRow;
        error?: string;
        teamAReady?: boolean;
        teamBReady?: boolean;
      }>(res);
      if (!res.ok) throw new Error(body?.error || "Check-in action failed");
      if (body?.item) {
        setMatches((prev) => prev.map((m) => (m.id === id ? body.item! : m)));
      }
      return body;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-in action failed");
      return null;
    } finally {
      setCheckInBusyId(null);
    }
  }

  async function startMatchInDiscord(id: string) {
    const slot = voiceSlotByMatchId[id] || "1";
    setDiscordStartBusyId(id);
    setError(null);
    setDiscordTimerInfo(null);
    try {
      const res = await fetch(`/api/admin/matches/${encodeURIComponent(id)}/discord/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ voiceSlot: slot })
      });
      const body = await readJsonBody<{
        ok?: boolean;
        error?: string;
        threadId?: string;
        match?: MatchRow;
        timerRegistered?: boolean;
        timerRegisterWarning?: string;
      }>(res);
      if (!res.ok) throw new Error(body?.error || "Discord start failed");
      if (body?.match) {
        setMatches((prev) => prev.map((row) => (row.id === id ? { ...row, ...body.match! } : row)));
      }
      if (body?.timerRegisterWarning) {
        setDiscordTimerInfo(body.timerRegisterWarning);
      } else if (body?.timerRegistered) {
        setDiscordTimerInfo("Replay timer registered with the bot (15 min after first .replay).");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discord start failed");
    } finally {
      setDiscordStartBusyId(null);
    }
  }

  async function postAndAutoSync(id: string) {
    setCheckInBusyId(id);
    setError(null);
    try {
      const postRes = await fetch(`/api/admin/matches/${id}/check-in`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "send_checkin" })
      });
      const postBody = await readJsonBody<{ item?: MatchRow; error?: string }>(postRes);
      if (!postRes.ok) throw new Error(postBody?.error || "Failed to send check-in post");
      if (postBody?.item) setMatches((prev) => prev.map((m) => (m.id === id ? postBody.item! : m)));

      // Poll reaction sync up to ~5 minutes (20 attempts * 15s).
      for (let i = 0; i < 20; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 15000));
        const syncRes = await fetch(`/api/admin/matches/${id}/check-in`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "sync_reactions" })
        });
        const syncBody = await readJsonBody<{
          item?: MatchRow;
          error?: string;
          teamAReady?: boolean;
          teamBReady?: boolean;
        }>(syncRes);
        if (!syncRes.ok) throw new Error(syncBody?.error || "Failed to sync reactions");
        if (syncBody?.item) setMatches((prev) => prev.map((m) => (m.id === id ? syncBody.item! : m)));
        if (syncBody?.teamAReady && syncBody?.teamBReady) return;
      }
      setError("Auto sync timeout: one or both teams have not reacted with ✅ yet.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Post + auto sync failed");
    } finally {
      setCheckInBusyId(null);
    }
  }

  const teamsForCreate = teamsByTournament[createDraft.tournamentId] || [];
  const createRoleOpts = roleOptionsByTournamentId[createDraft.tournamentId] || teamRoleOptions;

  return (
    <SiteShell
      title="Admin / Matches"
      subtitle={
        discordPodMode
          ? "Schedule matches, report winners, and capture Discord check-in metadata. Start match in Discord creates a pod (1 text + 2 team-only voice channels) under DISCORD_MATCH_POD_CATEGORY_ID when set on the server. Announce pings only the two teams. Set NEXT_PUBLIC_DISCORD_MATCH_POD_MODE=1 to hide legacy voice slot UI."
          : "Schedule matches, report winners, and capture Discord check-in metadata. Use Start match in Discord to mirror /match create (announce + thread). Set DISCORD_MATCH_ANNOUNCE_CHANNEL_ID and DISCORD_MATCH_RESULTS_CHANNEL_ID in .env.local, or use DISCORD_MATCH_POD_CATEGORY_ID for per-match pods. Add teams under Admin → Teams."
      }
    >
      <section className="card flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Create Match</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <select
            className="rounded-md border border-border bg-surface-2 px-3 py-2"
            value={createDraft.tournamentId}
            onChange={(e) => setCreateDraft((prev) => ({ ...prev, tournamentId: e.target.value }))}
          >
            <option value="">Select Tournament</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input className="rounded-md border border-border bg-surface-2 px-3 py-2" placeholder="Round Code" value={createDraft.roundCode} onChange={(e) => setCreateDraft((prev) => ({ ...prev, roundCode: e.target.value }))} />
          <input className="rounded-md border border-border bg-surface-2 px-3 py-2" placeholder="Slot" value={createDraft.slot} onChange={(e) => setCreateDraft((prev) => ({ ...prev, slot: e.target.value }))} />
          <select
            className="rounded-md border border-border bg-surface-2 px-3 py-2"
            value={createDraft.teamAId}
            onChange={(e) => setCreateDraft((prev) => ({ ...prev, teamAId: e.target.value }))}
          >
            <option value="">Team A</option>
            {teamsForCreate.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-border bg-surface-2 px-3 py-2"
            value={createDraft.teamBId}
            onChange={(e) => setCreateDraft((prev) => ({ ...prev, teamBId: e.target.value }))}
          >
            <option value="">Team B</option>
            {teamsForCreate.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input className="rounded-md border border-border bg-surface-2 px-3 py-2" placeholder="Best Of" value={createDraft.bestOf} onChange={(e) => setCreateDraft((prev) => ({ ...prev, bestOf: e.target.value }))} />
          <select className="rounded-md border border-border bg-surface-2 px-3 py-2" value={createDraft.status} onChange={(e) => setCreateDraft((prev) => ({ ...prev, status: e.target.value as MatchDraft["status"] }))}>
            <option value="scheduled">scheduled</option>
            <option value="in_progress">in_progress</option>
            <option value="completed">completed</option>
            <option value="disputed">disputed</option>
          </select>
          <input className="rounded-md border border-border bg-surface-2 px-3 py-2" placeholder="Scheduled At (ISO)" value={createDraft.scheduledAt} onChange={(e) => setCreateDraft((prev) => ({ ...prev, scheduledAt: e.target.value }))} />
          <input className="rounded-md border border-border bg-surface-2 px-3 py-2" placeholder="Played At (ISO)" value={createDraft.playedAt} onChange={(e) => setCreateDraft((prev) => ({ ...prev, playedAt: e.target.value }))} />
          <input className="rounded-md border border-border bg-surface-2 px-3 py-2" placeholder="Discord Channel ID" value={createDraft.discordChannelId} onChange={(e) => setCreateDraft((prev) => ({ ...prev, discordChannelId: e.target.value }))} />
          <select
            className="rounded-md border border-border bg-surface-2 px-3 py-2"
            value={createDraft.teamARoleId}
            onChange={(e) => setCreateDraft((prev) => ({ ...prev, teamARoleId: e.target.value }))}
          >
            <option value="">Team A Role</option>
            {createRoleOpts.map((opt) => (
              <option key={`ca-${opt.roleId}`} value={opt.roleId}>
                {opt.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-border bg-surface-2 px-3 py-2"
            value={createDraft.teamBRoleId}
            onChange={(e) => setCreateDraft((prev) => ({ ...prev, teamBRoleId: e.target.value }))}
          >
            <option value="">Team B Role</option>
            {createRoleOpts.map((opt) => (
              <option key={`cb-${opt.roleId}`} value={opt.roleId}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="chip hover:text-foreground"
            disabled={!createDraft.tournamentId}
            onClick={() =>
              setCreateDraft((prev) => applySavedRolesFromTeams(prev, teamsForCreate))
            }
          >
            Apply saved Discord roles from teams
          </button>
          <span className="text-xs text-muted">Uses role IDs from Admin → Teams for the selected Team A / B.</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={creating || !createDraft.tournamentId}
            onClick={() => void createMatch()}
            className="rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? "Creating..." : "Create Match"}
          </button>
          <button className="chip hover:text-foreground" disabled={creating} onClick={() => setCreateDraft((prev) => ({ ...emptyDraft, tournamentId: prev.tournamentId }))}>
            Clear
          </button>
        </div>
      </section>

      <section className="card flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Match Manager</h2>
          <div className="flex items-center gap-2">
            <select
              className="rounded-md border border-border bg-surface-2 px-2 py-1 text-sm"
              value={tournamentFilter}
              onChange={(e) => setTournamentFilter(e.target.value)}
            >
              <option value="all">All Tournaments</option>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-border bg-surface-2 px-2 py-1 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="all">all</option>
              <option value="scheduled">scheduled</option>
              <option value="in_progress">in_progress</option>
              <option value="completed">completed</option>
              <option value="disputed">disputed</option>
            </select>
            <button className="chip hover:text-foreground" onClick={() => void loadMatches()}>
              Refresh
            </button>
          </div>
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {discordTimerInfo ? <p className="text-sm text-amber-200/90">{discordTimerInfo}</p> : null}
        {loading ? <p className="text-sm text-muted">Loading matches...</p> : null}
        {!loading && matches.length === 0 ? <p className="text-sm text-muted">No matches found.</p> : null}

        {!loading && matches.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="px-2 py-1">Tournament</th>
                  <th className="px-2 py-1">Round/Slot</th>
                  <th className="px-2 py-1">Teams</th>
                  <th className="px-2 py-1">Status</th>
                  <th className="px-2 py-1">Schedule</th>
                  <th className="px-2 py-1">Discord</th>
                  <th className="px-2 py-1">Check-In</th>
                  <th className="px-2 py-1">Actions</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => {
                  const draft = draftsById[m.id] || { ...emptyDraft, tournamentId: m.tournamentId };
                  return (
                    <tr key={m.id} className="rounded-lg border border-border bg-surface-2 align-top">
                      <td className="px-2 py-2">
                        <select
                          className="w-44 rounded-md border border-border bg-surface px-2 py-1"
                          value={draft.tournamentId}
                          onChange={(e) =>
                            setDraftsById((prev) => ({ ...prev, [m.id]: { ...draft, tournamentId: e.target.value } }))
                          }
                        >
                          <option value="">Select</option>
                          {tournaments.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-muted">{tournamentNameById[draft.tournamentId] || m.tournament?.name || ""}</p>
                      </td>
                      <td className="px-2 py-2">
                        <input className="mb-1 w-28 rounded-md border border-border bg-surface px-2 py-1" placeholder="roundCode" value={draft.roundCode} onChange={(e) => setDraftsById((prev) => ({ ...prev, [m.id]: { ...draft, roundCode: e.target.value } }))} />
                        <input className="w-28 rounded-md border border-border bg-surface px-2 py-1" placeholder="slot" value={draft.slot} onChange={(e) => setDraftsById((prev) => ({ ...prev, [m.id]: { ...draft, slot: e.target.value } }))} />
                      </td>
                      <td className="px-2 py-2">
                        {(() => {
                          const rowTeams = teamsByTournament[draft.tournamentId] || [];
                          return (
                            <>
                              <select
                                className="mb-1 w-40 rounded-md border border-border bg-surface px-2 py-1 text-xs"
                                value={draft.teamAId}
                                onChange={(e) =>
                                  setDraftsById((prev) => ({
                                    ...prev,
                                    [m.id]: { ...draft, teamAId: e.target.value }
                                  }))
                                }
                              >
                                <option value="">Team A</option>
                                {rowTeams.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                              <select
                                className="mb-1 w-40 rounded-md border border-border bg-surface px-2 py-1 text-xs"
                                value={draft.teamBId}
                                onChange={(e) =>
                                  setDraftsById((prev) => ({
                                    ...prev,
                                    [m.id]: { ...draft, teamBId: e.target.value }
                                  }))
                                }
                              >
                                <option value="">Team B</option>
                                {rowTeams.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                            </>
                          );
                        })()}
                        <input className="mb-1 w-36 rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs" placeholder="winnerTeamId" value={draft.winnerTeamId} onChange={(e) => setDraftsById((prev) => ({ ...prev, [m.id]: { ...draft, winnerTeamId: e.target.value } }))} />
                        <input className="w-20 rounded-md border border-border bg-surface px-2 py-1" placeholder="bestOf" value={draft.bestOf} onChange={(e) => setDraftsById((prev) => ({ ...prev, [m.id]: { ...draft, bestOf: e.target.value } }))} />
                      </td>
                      <td className="px-2 py-2">
                        <select className="w-28 rounded-md border border-border bg-surface px-2 py-1" value={draft.status} onChange={(e) => setDraftsById((prev) => ({ ...prev, [m.id]: { ...draft, status: e.target.value as MatchDraft["status"] } }))}>
                          <option value="scheduled">scheduled</option>
                          <option value="in_progress">in_progress</option>
                          <option value="completed">completed</option>
                          <option value="disputed">disputed</option>
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input className="mb-1 w-44 rounded-md border border-border bg-surface px-2 py-1" placeholder="scheduledAt ISO" value={draft.scheduledAt} onChange={(e) => setDraftsById((prev) => ({ ...prev, [m.id]: { ...draft, scheduledAt: e.target.value } }))} />
                        <input className="w-44 rounded-md border border-border bg-surface px-2 py-1" placeholder="playedAt ISO" value={draft.playedAt} onChange={(e) => setDraftsById((prev) => ({ ...prev, [m.id]: { ...draft, playedAt: e.target.value } }))} />
                      </td>
                      <td className="px-2 py-2">
                        <input className="mb-1 w-44 rounded-md border border-border bg-surface px-2 py-1" placeholder="discordChannelId" value={draft.discordChannelId} onChange={(e) => setDraftsById((prev) => ({ ...prev, [m.id]: { ...draft, discordChannelId: e.target.value } }))} />
                        <select
                          className="mb-1 w-44 rounded-md border border-border bg-surface px-2 py-1"
                          value={draft.teamARoleId}
                          onChange={(e) =>
                            setDraftsById((prev) => ({ ...prev, [m.id]: { ...draft, teamARoleId: e.target.value } }))
                          }
                        >
                          <option value="">Team A Role</option>
                          {(roleOptionsByTournamentId[draft.tournamentId] || teamRoleOptions).map((opt) => (
                            <option key={`a-${opt.roleId}`} value={opt.roleId}>
                              {opt.name}
                            </option>
                          ))}
                        </select>
                        <select
                          className="w-44 rounded-md border border-border bg-surface px-2 py-1"
                          value={draft.teamBRoleId}
                          onChange={(e) =>
                            setDraftsById((prev) => ({ ...prev, [m.id]: { ...draft, teamBRoleId: e.target.value } }))
                          }
                        >
                          <option value="">Team B Role</option>
                          {(roleOptionsByTournamentId[draft.tournamentId] || teamRoleOptions).map((opt) => (
                            <option key={`b-${opt.roleId}`} value={opt.roleId}>
                              {opt.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="mt-1 block text-xs text-primary underline hover:text-foreground"
                          onClick={() =>
                            setDraftsById((prev) => ({
                              ...prev,
                              [m.id]: applySavedRolesFromTeams(
                                draft,
                                teamsByTournament[draft.tournamentId] || []
                              )
                            }))
                          }
                        >
                          Apply saved roles from teams
                        </button>
                        <div className="mt-2 flex flex-col gap-1 border-t border-border/60 pt-2">
                          <span className="text-xs text-muted">Same as bot `/match create`</span>
                          {discordPodMode ? (
                            <span className="text-xs text-muted">
                              Pod mode: server uses per-match text + two team voice channels (no shared slot).
                            </span>
                          ) : (
                            <select
                              className="w-full rounded-md border border-border bg-surface px-2 py-1 text-xs"
                              value={voiceSlotByMatchId[m.id] || "1"}
                              onChange={(e) =>
                                setVoiceSlotByMatchId((prev) => ({
                                  ...prev,
                                  [m.id]: e.target.value === "2" ? "2" : "1"
                                }))
                              }
                            >
                              <option value="1">Voice slot 1 (e.g. Match Voice A)</option>
                              <option value="2">Voice slot 2 (e.g. Match Voice B)</option>
                            </select>
                          )}
                          <button
                            type="button"
                            className="rounded-md border border-amber-600/80 bg-amber-900/40 px-2 py-1 text-xs font-semibold text-amber-100 hover:bg-amber-900/60 disabled:opacity-50"
                            disabled={
                              discordStartBusyId === m.id ||
                              !draft.teamAId ||
                              !draft.teamBId ||
                              savingId === m.id
                            }
                            onClick={() => void startMatchInDiscord(m.id)}
                            title="Posts ready-up + thread via bot token (configure channel IDs in .env.local)"
                          >
                            {discordStartBusyId === m.id ? "Posting…" : "Start match in Discord"}
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <input className="mb-1 w-44 rounded-md border border-border bg-surface px-2 py-1" placeholder="checkInMessageId" value={draft.checkInMessageId} onChange={(e) => setDraftsById((prev) => ({ ...prev, [m.id]: { ...draft, checkInMessageId: e.target.value } }))} />
                        <input className="mb-1 w-44 rounded-md border border-border bg-surface px-2 py-1" placeholder="checkInRequestedAt ISO" value={draft.checkInRequestedAt} onChange={(e) => setDraftsById((prev) => ({ ...prev, [m.id]: { ...draft, checkInRequestedAt: e.target.value } }))} />
                        <input className="mb-1 w-44 rounded-md border border-border bg-surface px-2 py-1" placeholder="teamACheckedInAt ISO" value={draft.teamACheckedInAt} onChange={(e) => setDraftsById((prev) => ({ ...prev, [m.id]: { ...draft, teamACheckedInAt: e.target.value } }))} />
                        <input className="w-44 rounded-md border border-border bg-surface px-2 py-1" placeholder="teamBCheckedInAt ISO" value={draft.teamBCheckedInAt} onChange={(e) => setDraftsById((prev) => ({ ...prev, [m.id]: { ...draft, teamBCheckedInAt: e.target.value } }))} />
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="chip hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={checkInBusyId === m.id}
                            onClick={() => void postAndAutoSync(m.id)}
                          >
                            {checkInBusyId === m.id ? "Working..." : "Post + Auto Sync"}
                          </button>
                          <button
                            type="button"
                            className="chip hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={checkInBusyId === m.id}
                            onClick={() => void runCheckInAction(m.id, "send_checkin")}
                          >
                            {checkInBusyId === m.id ? "Working..." : "Send Check-In Post"}
                          </button>
                          <button
                            type="button"
                            className="chip hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={checkInBusyId === m.id}
                            onClick={() => void runCheckInAction(m.id, "sync_reactions")}
                          >
                            Sync ✅ Reactions
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <Link
                          href={`/admin/matches/${m.id}/games`}
                          className="text-sm font-medium text-primary underline hover:text-foreground"
                        >
                          Games & .replays
                        </Link>
                        <p className="mt-1 text-xs text-muted">Upload replays per game after the match.</p>
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          className="rounded-md border border-primary bg-primary px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={savingId === m.id || !draft.tournamentId}
                          onClick={() => void saveMatch(m.id)}
                        >
                          {savingId === m.id ? "Saving..." : "Save"}
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

