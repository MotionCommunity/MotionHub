"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteShell } from "../../components/site-shell";

type Tournament = {
  id: string;
  name: string;
  externalTournamentId: number | null;
  format: string | null;
  bracketType: string | null;
  status: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
};

type TournamentDraft = {
  name: string;
  externalTournamentId: string;
  format: string;
  bracketType: string;
  status: string;
  startedAt: string;
  endedAt: string;
};

const emptyDraft: TournamentDraft = {
  name: "",
  externalTournamentId: "",
  format: "",
  bracketType: "",
  status: "active",
  startedAt: "",
  endedAt: ""
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

export default function AdminTournamentsPage() {
  const [items, setItems] = useState<Tournament[]>([]);
  const [draftsById, setDraftsById] = useState<Record<string, TournamentDraft>>({});
  const [createDraft, setCreateDraft] = useState<TournamentDraft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed">("all");

  const loadTournaments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tournaments", { cache: "no-store" });
      const body = await readJsonBody<{ items?: Tournament[]; error?: string }>(res);
      if (!res.ok) throw new Error(body?.error || "Failed to load tournaments");
      const rows = body?.items || [];
      setItems(rows);
      setDraftsById(
        Object.fromEntries(
          rows.map((t) => [
            t.id,
            {
              name: t.name || "",
              externalTournamentId: t.externalTournamentId === null ? "" : String(t.externalTournamentId),
              format: t.format || "",
              bracketType: t.bracketType || "",
              status: t.status || "",
              startedAt: t.startedAt || "",
              endedAt: t.endedAt || ""
            }
          ])
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tournaments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTournaments();
  }, [loadTournaments]);

  const filteredItems = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((t) => (t.status || "").toLowerCase() === statusFilter);
  }, [items, statusFilter]);

  function toPayload(draft: TournamentDraft) {
    return {
      name: draft.name.trim(),
      externalTournamentId: draft.externalTournamentId.trim() ? Number(draft.externalTournamentId.trim()) : null,
      format: draft.format.trim() || null,
      bracketType: draft.bracketType.trim() || null,
      status: draft.status.trim() || null,
      startedAt: draft.startedAt.trim() || null,
      endedAt: draft.endedAt.trim() || null
    };
  }

  async function createTournament() {
    setCreating(true);
    setError(null);
    try {
      const payload = toPayload(createDraft);
      if (!payload.name) throw new Error("Tournament name is required");
      const res = await fetch("/api/admin/tournaments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await readJsonBody<{ item?: Tournament; error?: string }>(res);
      if (!res.ok) throw new Error(body?.error || "Failed to create tournament");
      setCreateDraft(emptyDraft);
      await loadTournaments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tournament");
    } finally {
      setCreating(false);
    }
  }

  async function saveTournament(id: string) {
    const draft = draftsById[id];
    if (!draft) return;
    setSavingId(id);
    setError(null);
    try {
      const payload = toPayload(draft);
      if (!payload.name) throw new Error("Tournament name is required");
      const res = await fetch(`/api/admin/tournaments/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await readJsonBody<{ item?: Tournament; error?: string }>(res);
      if (!res.ok) throw new Error(body?.error || "Failed to update tournament");
      if (body?.item) {
        setItems((prev) => prev.map((row) => (row.id === id ? body.item! : row)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update tournament");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <SiteShell
      title="Admin / Tournaments"
      subtitle="Create and manage tournaments used by matches, schedule, and results."
    >
      <section className="card flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Create Tournament</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="rounded-md border border-border bg-surface-2 px-3 py-2"
            placeholder="Tournament Name"
            value={createDraft.name}
            onChange={(e) => setCreateDraft((prev) => ({ ...prev, name: e.target.value }))}
          />
          <input
            className="rounded-md border border-border bg-surface-2 px-3 py-2"
            placeholder="External Tournament ID"
            value={createDraft.externalTournamentId}
            onChange={(e) => setCreateDraft((prev) => ({ ...prev, externalTournamentId: e.target.value }))}
          />
          <input
            className="rounded-md border border-border bg-surface-2 px-3 py-2"
            placeholder="Format (e.g. 2v2)"
            value={createDraft.format}
            onChange={(e) => setCreateDraft((prev) => ({ ...prev, format: e.target.value }))}
          />
          <input
            className="rounded-md border border-border bg-surface-2 px-3 py-2"
            placeholder="Bracket Type (e.g. single elimination)"
            value={createDraft.bracketType}
            onChange={(e) => setCreateDraft((prev) => ({ ...prev, bracketType: e.target.value }))}
          />
          <input
            className="rounded-md border border-border bg-surface-2 px-3 py-2"
            placeholder="Status (active/completed)"
            value={createDraft.status}
            onChange={(e) => setCreateDraft((prev) => ({ ...prev, status: e.target.value }))}
          />
          <input
            className="rounded-md border border-border bg-surface-2 px-3 py-2"
            placeholder="Started At (ISO)"
            value={createDraft.startedAt}
            onChange={(e) => setCreateDraft((prev) => ({ ...prev, startedAt: e.target.value }))}
          />
          <input
            className="rounded-md border border-border bg-surface-2 px-3 py-2"
            placeholder="Ended At (ISO)"
            value={createDraft.endedAt}
            onChange={(e) => setCreateDraft((prev) => ({ ...prev, endedAt: e.target.value }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={creating || !createDraft.name.trim()}
            onClick={() => void createTournament()}
            className="rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? "Creating..." : "Create"}
          </button>
          <button
            type="button"
            onClick={() => setCreateDraft(emptyDraft)}
            className="chip hover:text-foreground"
            disabled={creating}
          >
            Clear
          </button>
        </div>
      </section>

      <section className="card flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Tournament Manager</h2>
          <div className="flex items-center gap-2">
            <button className={`chip ${statusFilter === "all" ? "text-foreground" : ""}`} onClick={() => setStatusFilter("all")}>
              All
            </button>
            <button className={`chip ${statusFilter === "active" ? "text-foreground" : ""}`} onClick={() => setStatusFilter("active")}>
              Active
            </button>
            <button className={`chip ${statusFilter === "completed" ? "text-foreground" : ""}`} onClick={() => setStatusFilter("completed")}>
              Completed
            </button>
            <button className="chip hover:text-foreground" onClick={() => void loadTournaments()}>
              Refresh
            </button>
          </div>
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {loading ? <p className="text-sm text-muted">Loading tournaments...</p> : null}
        {!loading && filteredItems.length === 0 ? <p className="text-sm text-muted">No tournaments found.</p> : null}

        {!loading && filteredItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="px-2 py-1">Name</th>
                  <th className="px-2 py-1">External ID</th>
                  <th className="px-2 py-1">Format</th>
                  <th className="px-2 py-1">Bracket</th>
                  <th className="px-2 py-1">Status</th>
                  <th className="px-2 py-1">Started At</th>
                  <th className="px-2 py-1">Ended At</th>
                  <th className="px-2 py-1">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((t) => {
                  const draft = draftsById[t.id] || emptyDraft;
                  return (
                    <tr key={t.id} className="rounded-lg border border-border bg-surface-2">
                      <td className="px-2 py-2">
                        <input
                          className="w-52 rounded-md border border-border bg-surface px-2 py-1"
                          value={draft.name}
                          onChange={(e) =>
                            setDraftsById((prev) => ({ ...prev, [t.id]: { ...draft, name: e.target.value } }))
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-28 rounded-md border border-border bg-surface px-2 py-1"
                          value={draft.externalTournamentId}
                          onChange={(e) =>
                            setDraftsById((prev) => ({
                              ...prev,
                              [t.id]: { ...draft, externalTournamentId: e.target.value }
                            }))
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-24 rounded-md border border-border bg-surface px-2 py-1"
                          value={draft.format}
                          onChange={(e) =>
                            setDraftsById((prev) => ({ ...prev, [t.id]: { ...draft, format: e.target.value } }))
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-36 rounded-md border border-border bg-surface px-2 py-1"
                          value={draft.bracketType}
                          onChange={(e) =>
                            setDraftsById((prev) => ({ ...prev, [t.id]: { ...draft, bracketType: e.target.value } }))
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-24 rounded-md border border-border bg-surface px-2 py-1"
                          value={draft.status}
                          onChange={(e) =>
                            setDraftsById((prev) => ({ ...prev, [t.id]: { ...draft, status: e.target.value } }))
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-48 rounded-md border border-border bg-surface px-2 py-1"
                          value={draft.startedAt}
                          onChange={(e) =>
                            setDraftsById((prev) => ({ ...prev, [t.id]: { ...draft, startedAt: e.target.value } }))
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-48 rounded-md border border-border bg-surface px-2 py-1"
                          value={draft.endedAt}
                          onChange={(e) =>
                            setDraftsById((prev) => ({ ...prev, [t.id]: { ...draft, endedAt: e.target.value } }))
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          className="rounded-md border border-primary bg-primary px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={savingId === t.id || !draft.name.trim()}
                          onClick={() => void saveTournament(t.id)}
                        >
                          {savingId === t.id ? "Saving..." : "Save"}
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

