import Fastify from "fastify";
import { Queue } from "bullmq";
import { MatchStatus, PrismaClient, ReplayParseStatus } from "@prisma/client";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT || 4001);
const redisUrl = process.env.REDIS_URL || "redis://localhost:6380";
const replayQueueName = "replay-ingest";

const prisma = new PrismaClient();
const replayQueue = new Queue(replayQueueName, { connection: { url: redisUrl } });

app.get("/health", async () => {
  const db = await prisma.$queryRaw`SELECT 1`;
  return { ok: true, service: "league-api", db: Array.isArray(db) };
});

app.get("/v1/players", async () => {
  const items = await prisma.player.findMany({
    orderBy: { createdAt: "desc" },
    take: 200
  });
  return { items };
});

app.get<{ Params: { id: string } }>("/v1/players/:id", async (req, reply) => {
  const item = await prisma.player.findUnique({ where: { id: req.params.id } });
  if (!item) return reply.code(404).send({ error: "Player not found" });
  return { item };
});

app.post<{
  Body: {
    ign?: string;
    region?: string;
    discordUsername?: string;
    discordUserId?: string;
    epicGamesId?: string;
    trackerUrl?: string;
  };
}>(
  "/v1/players",
  async (req, reply) => {
    const ign = req.body?.ign?.trim();
    if (!ign) return reply.code(400).send({ error: "ign is required" });
    const item = await prisma.player.create({
      data: {
        ign,
        region: req.body?.region?.trim() || null,
        discordUsername: req.body?.discordUsername?.trim() || null,
        discordUserId: req.body?.discordUserId?.trim() || null,
        epicGamesId: req.body?.epicGamesId?.trim() || null,
        trackerUrl: req.body?.trackerUrl?.trim() || null
      }
    });
    return reply.code(201).send({ item });
  }
);

app.patch<{
  Params: { id: string };
  Body: {
    ign?: string;
    region?: string;
    discordUsername?: string;
    discordUserId?: string;
    epicGamesId?: string;
    trackerUrl?: string;
  };
}>(
  "/v1/players/:id",
  async (req, reply) => {
    const existing = await prisma.player.findUnique({ where: { id: req.params.id } });
    if (!existing) return reply.code(404).send({ error: "Player not found" });

    const ign = req.body?.ign?.trim();
    if (ign === "") return reply.code(400).send({ error: "ign cannot be empty" });

    const item = await prisma.player.update({
      where: { id: req.params.id },
      data: {
        ...(ign ? { ign } : {}),
        ...(req.body?.region !== undefined ? { region: req.body.region?.trim() || null } : {}),
        ...(req.body?.discordUsername !== undefined ? { discordUsername: req.body.discordUsername?.trim() || null } : {}),
        ...(req.body?.discordUserId !== undefined ? { discordUserId: req.body.discordUserId?.trim() || null } : {}),
        ...(req.body?.epicGamesId !== undefined ? { epicGamesId: req.body.epicGamesId?.trim() || null } : {}),
        ...(req.body?.trackerUrl !== undefined ? { trackerUrl: req.body.trackerUrl?.trim() || null } : {})
      }
    });
    return { item };
  }
);

app.delete<{ Params: { id: string } }>("/v1/players/:id", async (req, reply) => {
  const existing = await prisma.player.findUnique({ where: { id: req.params.id } });
  if (!existing) return reply.code(404).send({ error: "Player not found" });
  await prisma.player.delete({ where: { id: req.params.id } });
  return { ok: true, id: req.params.id };
});

app.get("/v1/tournaments", async () => {
  const items = await prisma.tournament.findMany({
    orderBy: { createdAt: "desc" },
    take: 100
  });
  return { items };
});

app.post<{
  Body: {
    name?: string;
    externalTournamentId?: number | null;
    format?: string | null;
    bracketType?: string | null;
    status?: string | null;
    startedAt?: string | null;
    endedAt?: string | null;
  };
}>("/v1/tournaments", async (req, reply) => {
  const name = req.body?.name?.trim();
  if (!name) return reply.code(400).send({ error: "name is required" });
  const item = await prisma.tournament.create({
    data: {
      name,
      externalTournamentId: req.body?.externalTournamentId ?? null,
      format: req.body?.format ?? null,
      bracketType: req.body?.bracketType ?? null,
      status: req.body?.status ?? "active",
      startedAt: req.body?.startedAt ? new Date(req.body.startedAt) : null,
      endedAt: req.body?.endedAt ? new Date(req.body.endedAt) : null
    }
  });
  return reply.code(201).send({ item });
});

app.patch<{
  Params: { id: string };
  Body: {
    name?: string;
    externalTournamentId?: number | null;
    format?: string | null;
    bracketType?: string | null;
    status?: string | null;
    startedAt?: string | null;
    endedAt?: string | null;
  };
}>("/v1/tournaments/:id", async (req, reply) => {
  const existing = await prisma.tournament.findUnique({ where: { id: req.params.id } });
  if (!existing) return reply.code(404).send({ error: "Tournament not found" });

  const name = req.body?.name?.trim();
  if (name === "") return reply.code(400).send({ error: "name cannot be empty" });

  const item = await prisma.tournament.update({
    where: { id: req.params.id },
    data: {
      ...(name ? { name } : {}),
      ...(req.body?.externalTournamentId !== undefined ? { externalTournamentId: req.body.externalTournamentId } : {}),
      ...(req.body?.format !== undefined ? { format: req.body.format || null } : {}),
      ...(req.body?.bracketType !== undefined ? { bracketType: req.body.bracketType || null } : {}),
      ...(req.body?.status !== undefined ? { status: req.body.status || null } : {}),
      ...(req.body?.startedAt !== undefined
        ? { startedAt: req.body.startedAt ? new Date(req.body.startedAt) : null }
        : {}),
      ...(req.body?.endedAt !== undefined ? { endedAt: req.body.endedAt ? new Date(req.body.endedAt) : null } : {})
    }
  });

  return { item };
});

app.get<{ Params: { id: string } }>("/v1/tournaments/:id/teams", async (req, reply) => {
  const tournament = await prisma.tournament.findUnique({ where: { id: req.params.id } });
  if (!tournament) return reply.code(404).send({ error: "Tournament not found" });
  const items = await prisma.team.findMany({
    where: { tournamentId: req.params.id },
    orderBy: [{ seed: "asc" }, { name: "asc" }]
  });
  return { items };
});

app.post<{
  Params: { id: string };
  Body: {
    name?: string;
    seed?: number | null;
    placement?: number | null;
    discordRoleId?: string | null;
    discordTextChannelId?: string | null;
    discordVoiceChannelId?: string | null;
  };
}>("/v1/tournaments/:id/teams", async (req, reply) => {
  const tournament = await prisma.tournament.findUnique({ where: { id: req.params.id } });
  if (!tournament) return reply.code(404).send({ error: "Tournament not found" });

  const name = req.body?.name?.trim();
  if (!name) return reply.code(400).send({ error: "name is required" });

  const item = await prisma.team.create({
    data: {
      tournamentId: req.params.id,
      name,
      seed: req.body?.seed ?? null,
      placement: req.body?.placement ?? null,
      discordRoleId: req.body?.discordRoleId?.trim() || null,
      discordTextChannelId: req.body?.discordTextChannelId?.trim() || null,
      discordVoiceChannelId: req.body?.discordVoiceChannelId?.trim() || null
    }
  });
  return reply.code(201).send({ item });
});

app.patch<{
  Params: { id: string };
  Body: {
    name?: string;
    seed?: number | null;
    placement?: number | null;
    discordRoleId?: string | null;
    discordTextChannelId?: string | null;
    discordVoiceChannelId?: string | null;
  };
}>("/v1/teams/:id", async (req, reply) => {
  const existing = await prisma.team.findUnique({ where: { id: req.params.id } });
  if (!existing) return reply.code(404).send({ error: "Team not found" });

  const name = req.body?.name?.trim();
  if (name === "") return reply.code(400).send({ error: "name cannot be empty" });

  const item = await prisma.team.update({
    where: { id: req.params.id },
    data: {
      ...(name ? { name } : {}),
      ...(req.body?.seed !== undefined ? { seed: req.body.seed } : {}),
      ...(req.body?.placement !== undefined ? { placement: req.body.placement } : {}),
      ...(req.body?.discordRoleId !== undefined ? { discordRoleId: req.body.discordRoleId?.trim() || null } : {}),
      ...(req.body?.discordTextChannelId !== undefined
        ? { discordTextChannelId: req.body.discordTextChannelId?.trim() || null }
        : {}),
      ...(req.body?.discordVoiceChannelId !== undefined
        ? { discordVoiceChannelId: req.body.discordVoiceChannelId?.trim() || null }
        : {})
    }
  });
  return { item };
});

app.delete<{ Params: { id: string } }>("/v1/teams/:id", async (req, reply) => {
  const existing = await prisma.team.findUnique({ where: { id: req.params.id } });
  if (!existing) return reply.code(404).send({ error: "Team not found" });
  await prisma.team.delete({ where: { id: req.params.id } });
  return { ok: true, id: req.params.id };
});

app.get<{ Querystring: { tournamentId?: string; status?: string; limit?: string } }>("/v1/matches", async (req, reply) => {
  const tournamentId = req.query?.tournamentId?.trim();
  const statusRaw = req.query?.status?.trim();
  const limitRaw = Number(req.query?.limit ?? 200);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 500) : 200;

  if (statusRaw && !Object.values(MatchStatus).includes(statusRaw as MatchStatus)) {
    return reply.code(400).send({ error: "status must be one of: scheduled, in_progress, completed, disputed" });
  }

  const items = await prisma.match.findMany({
    where: {
      ...(tournamentId ? { tournamentId } : {}),
      ...(statusRaw ? { status: statusRaw as MatchStatus } : {})
    },
    orderBy: [{ scheduledAt: "asc" }, { id: "desc" }],
    take: limit,
    include: {
      tournament: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });
  return { items };
});

app.get<{ Params: { id: string } }>("/v1/matches/:id", async (req, reply) => {
  const item = await prisma.match.findUnique({
    where: { id: req.params.id },
    include: {
      tournament: {
        select: {
          id: true,
          name: true
        }
      },
      games: {
        orderBy: { gameNumber: "asc" },
        include: {
          replayFiles: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              storageKey: true,
              sha256: true,
              parserStatus: true,
              parserError: true,
              createdAt: true
            }
          }
        }
      }
    }
  });
  if (!item) return reply.code(404).send({ error: "Match not found" });
  return { item };
});

app.post<{
  Params: { id: string };
  Body: { gameNumber?: number; winnerTeamId?: string | null };
}>("/v1/matches/:id/games", async (req, reply) => {
  const match = await prisma.match.findUnique({ where: { id: req.params.id } });
  if (!match) return reply.code(404).send({ error: "Match not found" });

  const raw = req.body?.gameNumber;
  const gameNumber = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(gameNumber) || gameNumber < 1 || !Number.isInteger(gameNumber)) {
    return reply.code(400).send({ error: "gameNumber must be a positive integer" });
  }

  try {
    const item = await prisma.game.create({
      data: {
        matchId: req.params.id,
        gameNumber,
        winnerTeamId: req.body?.winnerTeamId?.trim() || null
      },
      include: {
        replayFiles: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            storageKey: true,
            sha256: true,
            parserStatus: true,
            parserError: true,
            createdAt: true
          }
        }
      }
    });
    return reply.code(201).send({ item });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "P2002") {
      return reply.code(409).send({ error: "A game with this number already exists for this match" });
    }
    throw e;
  }
});

app.delete<{ Params: { id: string } }>("/v1/games/:id", async (req, reply) => {
  const existing = await prisma.game.findUnique({ where: { id: req.params.id } });
  if (!existing) return reply.code(404).send({ error: "Game not found" });
  await prisma.game.delete({ where: { id: req.params.id } });
  return { ok: true, id: req.params.id };
});

app.get<{ Params: { id: string } }>("/v1/games/:id/context", async (req, reply) => {
  const game = await prisma.game.findUnique({
    where: { id: req.params.id },
    select: { id: true, matchId: true, gameNumber: true }
  });
  if (!game) return reply.code(404).send({ error: "Game not found" });
  return { gameId: game.id, matchId: game.matchId, gameNumber: game.gameNumber };
});

app.post<{
  Body: {
    tournamentId?: string;
    roundCode?: string | null;
    slot?: string | null;
    teamAId?: string | null;
    teamBId?: string | null;
    winnerTeamId?: string | null;
    bestOf?: number | null;
    status?: MatchStatus;
    scheduledAt?: string | null;
    playedAt?: string | null;
    discordChannelId?: string | null;
    teamARoleId?: string | null;
    teamBRoleId?: string | null;
    checkInMessageId?: string | null;
    checkInRequestedAt?: string | null;
    teamACheckedInAt?: string | null;
    teamBCheckedInAt?: string | null;
    discordPodTextChannelId?: string | null;
    discordPodVoiceAChannelId?: string | null;
    discordPodVoiceBChannelId?: string | null;
  };
}>("/v1/matches", async (req, reply) => {
  const tournamentId = req.body?.tournamentId?.trim();
  if (!tournamentId) return reply.code(400).send({ error: "tournamentId is required" });

  const item = await prisma.match.create({
    data: {
      tournamentId,
      roundCode: req.body?.roundCode ?? null,
      slot: req.body?.slot ?? null,
      teamAId: req.body?.teamAId ?? null,
      teamBId: req.body?.teamBId ?? null,
      winnerTeamId: req.body?.winnerTeamId ?? null,
      bestOf: req.body?.bestOf ?? null,
      status: req.body?.status ?? MatchStatus.scheduled,
      scheduledAt: req.body?.scheduledAt ? new Date(req.body.scheduledAt) : null,
      playedAt: req.body?.playedAt ? new Date(req.body.playedAt) : null,
      discordChannelId: req.body?.discordChannelId ?? null,
      teamARoleId: req.body?.teamARoleId ?? null,
      teamBRoleId: req.body?.teamBRoleId ?? null,
      checkInMessageId: req.body?.checkInMessageId ?? null,
      checkInRequestedAt: req.body?.checkInRequestedAt ? new Date(req.body.checkInRequestedAt) : null,
      teamACheckedInAt: req.body?.teamACheckedInAt ? new Date(req.body.teamACheckedInAt) : null,
      teamBCheckedInAt: req.body?.teamBCheckedInAt ? new Date(req.body.teamBCheckedInAt) : null,
      discordPodTextChannelId: req.body?.discordPodTextChannelId?.trim() || null,
      discordPodVoiceAChannelId: req.body?.discordPodVoiceAChannelId?.trim() || null,
      discordPodVoiceBChannelId: req.body?.discordPodVoiceBChannelId?.trim() || null
    },
    include: {
      tournament: {
        select: { id: true, name: true }
      }
    }
  });
  return reply.code(201).send({ item });
});

app.patch<{
  Params: { id: string };
  Body: {
    tournamentId?: string;
    roundCode?: string | null;
    slot?: string | null;
    teamAId?: string | null;
    teamBId?: string | null;
    winnerTeamId?: string | null;
    bestOf?: number | null;
    status?: MatchStatus;
    scheduledAt?: string | null;
    playedAt?: string | null;
    discordChannelId?: string | null;
    teamARoleId?: string | null;
    teamBRoleId?: string | null;
    checkInMessageId?: string | null;
    checkInRequestedAt?: string | null;
    teamACheckedInAt?: string | null;
    teamBCheckedInAt?: string | null;
    discordPodTextChannelId?: string | null;
    discordPodVoiceAChannelId?: string | null;
    discordPodVoiceBChannelId?: string | null;
  };
}>("/v1/matches/:id", async (req, reply) => {
  const existing = await prisma.match.findUnique({ where: { id: req.params.id } });
  if (!existing) return reply.code(404).send({ error: "Match not found" });

  const tournamentId = req.body?.tournamentId?.trim();
  if (tournamentId === "") return reply.code(400).send({ error: "tournamentId cannot be empty" });

  const item = await prisma.match.update({
    where: { id: req.params.id },
    data: {
      ...(tournamentId ? { tournamentId } : {}),
      ...(req.body?.roundCode !== undefined ? { roundCode: req.body.roundCode || null } : {}),
      ...(req.body?.slot !== undefined ? { slot: req.body.slot || null } : {}),
      ...(req.body?.teamAId !== undefined ? { teamAId: req.body.teamAId || null } : {}),
      ...(req.body?.teamBId !== undefined ? { teamBId: req.body.teamBId || null } : {}),
      ...(req.body?.winnerTeamId !== undefined ? { winnerTeamId: req.body.winnerTeamId || null } : {}),
      ...(req.body?.bestOf !== undefined ? { bestOf: req.body.bestOf ?? null } : {}),
      ...(req.body?.status !== undefined ? { status: req.body.status } : {}),
      ...(req.body?.scheduledAt !== undefined
        ? { scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : null }
        : {}),
      ...(req.body?.playedAt !== undefined ? { playedAt: req.body.playedAt ? new Date(req.body.playedAt) : null } : {}),
      ...(req.body?.discordChannelId !== undefined ? { discordChannelId: req.body.discordChannelId || null } : {}),
      ...(req.body?.teamARoleId !== undefined ? { teamARoleId: req.body.teamARoleId || null } : {}),
      ...(req.body?.teamBRoleId !== undefined ? { teamBRoleId: req.body.teamBRoleId || null } : {}),
      ...(req.body?.checkInMessageId !== undefined ? { checkInMessageId: req.body.checkInMessageId || null } : {}),
      ...(req.body?.checkInRequestedAt !== undefined
        ? { checkInRequestedAt: req.body.checkInRequestedAt ? new Date(req.body.checkInRequestedAt) : null }
        : {}),
      ...(req.body?.teamACheckedInAt !== undefined
        ? { teamACheckedInAt: req.body.teamACheckedInAt ? new Date(req.body.teamACheckedInAt) : null }
        : {}),
      ...(req.body?.teamBCheckedInAt !== undefined
        ? { teamBCheckedInAt: req.body.teamBCheckedInAt ? new Date(req.body.teamBCheckedInAt) : null }
        : {}),
      ...(req.body?.discordPodTextChannelId !== undefined
        ? { discordPodTextChannelId: req.body.discordPodTextChannelId?.trim() || null }
        : {}),
      ...(req.body?.discordPodVoiceAChannelId !== undefined
        ? { discordPodVoiceAChannelId: req.body.discordPodVoiceAChannelId?.trim() || null }
        : {}),
      ...(req.body?.discordPodVoiceBChannelId !== undefined
        ? { discordPodVoiceBChannelId: req.body.discordPodVoiceBChannelId?.trim() || null }
        : {})
    },
    include: {
      tournament: {
        select: { id: true, name: true }
      }
    }
  });

  return { item };
});

app.post<{ Body: { storageKey?: string; uploadedBy?: string; sha256?: string; gameId?: string } }>(
  "/v1/replays/ingest",
  async (req, reply) => {
    const storageKey = req.body?.storageKey?.trim();
    if (!storageKey) return reply.code(400).send({ error: "storageKey is required" });
    const sha256 = req.body?.sha256?.trim() || null;

    // Prevent duplicate replay rows from being created.
    // Prefer SHA match when provided, with storageKey as a fallback.
    const existing = await prisma.replayFile.findFirst({
      where: sha256
        ? { OR: [{ sha256 }, { storageKey }] }
        : { storageKey },
      orderBy: { createdAt: "desc" }
    });
    if (existing) {
      return reply.code(200).send({
        queued: false,
        duplicate: true,
        reason: "already_ingested",
        item: existing
      });
    }

    const item = await prisma.replayFile.create({
      data: {
        storageKey,
        uploadedBy: req.body?.uploadedBy?.trim() || null,
        sha256,
        gameId: req.body?.gameId?.trim() || null,
        parserStatus: ReplayParseStatus.pending
      }
    });

    await replayQueue.add("ingest-replay", { replayFileId: item.id });
    return reply.code(202).send({ queued: true, item });
  }
);

app.post("/v1/replays/retry-failed", async (_req, reply) => {
  const failed = await prisma.replayFile.findMany({
    where: { parserStatus: ReplayParseStatus.failed }
  });
  if (failed.length === 0) return { retried: 0 };
  for (const r of failed) {
    await prisma.replayFile.update({
      where: { id: r.id },
      data: { parserStatus: ReplayParseStatus.pending, parserError: null }
    });
    await replayQueue.add("ingest-replay", { replayFileId: r.id });
  }
  return { retried: failed.length, ids: failed.map((r) => r.id) };
});

app.get<{ Querystring: { limit?: string; status?: string; since?: string } }>("/v1/replays/recent", async (req, reply) => {
  const limitRaw = Number(req.query?.limit ?? 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 100) : 10;
  const statusRaw = req.query?.status?.trim();
  const sinceRaw = req.query?.since?.trim();
  const validStatuses = new Set(["pending", "parsed", "failed"]);
  if (statusRaw && !validStatuses.has(statusRaw)) {
    return reply.code(400).send({ error: "status must be one of: pending, parsed, failed" });
  }

  let sinceDate: Date | undefined;
  if (sinceRaw) {
    if (sinceRaw.toLowerCase() === "today") {
      const now = new Date();
      sinceDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else {
      const parsed = new Date(sinceRaw);
      if (Number.isNaN(parsed.getTime())) {
        return reply.code(400).send({
          error: "since must be ISO date/time or 'today' (example: 2026-03-19T00:00:00Z)"
        });
      }
      sinceDate = parsed;
    }
  }

  const where = {
    ...(statusRaw ? { parserStatus: statusRaw as ReplayParseStatus } : {}),
    ...(sinceDate ? { createdAt: { gte: sinceDate } } : {})
  };
  const items = await prisma.replayFile.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      parserStatus: true,
      parserError: true,
      storageKey: true,
      gameId: true
    }
  });
  return { items };
});

app.get<{ Params: { id: string } }>("/v1/games/:id/stats", async (req, reply) => {
  const stats = await prisma.playerGameStat.findMany({
    where: { gameId: req.params.id },
    include: { player: { select: { ign: true } } }
  });
  if (stats.length === 0) return reply.code(404).send({ error: "No stats found for this game" });
  return { gameId: req.params.id, players: stats };
});

app.get<{ Params: { id: string } }>("/v1/replays/:id/status", async (req, reply) => {
  const item = await prisma.replayFile.findUnique({
    where: { id: req.params.id },
    select: { id: true, parserStatus: true, parserError: true, createdAt: true, gameId: true, storageKey: true }
  });
  if (!item) return reply.code(404).send({ error: "Replay file not found" });
  return { item };
});

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
