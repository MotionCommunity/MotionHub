import { NextResponse } from "next/server";
import { isAdminRole, requiredEnv } from "@/lib/auth/config";
import { getServerSession } from "@/lib/auth/session-server";
import { createMatchPodChannels } from "../discord-match-pod";

/**
 * Mirrors Motion bot `/match create`: posts ready-up to announce channel + creates match thread.
 *
 * **Legacy:** DISCORD_MATCH_ANNOUNCE_CHANNEL_ID + DISCORD_MATCH_RESULTS_CHANNEL_ID (thread under results).
 *
 * **Pod mode:** set DISCORD_MATCH_POD_CATEGORY_ID — creates 1 text + 2 team-only voice channels under that
 * category (per match), registers the text channel for replay timers, and PATCHes pod IDs to league-api.
 */

function leagueApiBaseUrl(): string {
  return process.env.LEAGUE_API_BASE_URL?.trim() || "http://localhost:4001";
}

function discordApiBase(): string {
  return "https://discord.com/api/v10";
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

async function discordRequest(path: string, init: RequestInit = {}) {
  const botToken = requiredEnv("DISCORD_BOT_TOKEN");
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bot ${botToken}`);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${discordApiBase()}${path}`, { ...init, headers });
}

type TeamRow = {
  id: string;
  name: string;
  discordRoleId: string | null;
};

type MatchRow = {
  id: string;
  tournamentId: string;
  roundCode: string | null;
  slot: string | null;
  teamAId: string | null;
  teamBId: string | null;
  bestOf: number | null;
  status: string;
  discordPodTextChannelId?: string | null;
  discordPodVoiceAChannelId?: string | null;
  discordPodVoiceBChannelId?: string | null;
  tournament?: { id: string; name: string };
};

function bestOfToFormat(bestOf: number | null): "BO1" | "BO3" | "BO5" | "BO7" {
  if (bestOf === 1) return "BO1";
  if (bestOf === 5) return "BO5";
  if (bestOf === 7) return "BO7";
  return "BO3";
}

function replayCountLabel(format: string): string {
  const m: Record<string, string> = {
    BO1: "1 replay",
    BO3: "2–3 replays",
    BO5: "3–5 replays",
    BO7: "4–7 replays"
  };
  return m[format] || m.BO3;
}

function voiceLabel(slot: string): string {
  const a = process.env.DISCORD_MATCH_VOICE_1_LABEL?.trim() || "Match Voice A";
  const b = process.env.DISCORD_MATCH_VOICE_2_LABEL?.trim() || "Match Voice B";
  return slot === "2" ? b : a;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const announceId = process.env.DISCORD_MATCH_ANNOUNCE_CHANNEL_ID?.trim();
  const resultsParentId = process.env.DISCORD_MATCH_RESULTS_CHANNEL_ID?.trim();
  const podCategoryId = process.env.DISCORD_MATCH_POD_CATEGORY_ID?.trim();
  const guildIdEnv = process.env.DISCORD_GUILD_ID?.trim();
  const staffRoleForPod =
    process.env.DISCORD_BOT_STAFF_ROLE_ID?.trim() || process.env.DISCORD_ROLE_STAFF_ID?.trim();

  const podMode = Boolean(podCategoryId);
  if (!announceId) {
    return NextResponse.json(
      {
        error:
          "Set DISCORD_MATCH_ANNOUNCE_CHANNEL_ID in .env.local (match announcements; same as bot CHANNEL_MATCH_ANNOUNCE)."
      },
      { status: 500 }
    );
  }
  if (!podMode && !resultsParentId) {
    return NextResponse.json(
      {
        error:
          "Either set DISCORD_MATCH_POD_CATEGORY_ID (pod mode: 1 text + 2 voice per match) or set DISCORD_MATCH_RESULTS_CHANNEL_ID (legacy thread mode)."
      },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { voiceSlot?: "1" | "2" };
  const voiceSlot = body?.voiceSlot === "2" ? "2" : "1";
  const vl = voiceLabel(voiceSlot);

  const { id: matchId } = await params;

  let matchRes: Response;
  try {
    matchRes = await fetch(`${leagueApiBaseUrl()}/v1/matches/${encodeURIComponent(matchId)}`, {
      cache: "no-store"
    });
  } catch {
    return NextResponse.json({ error: "League API offline" }, { status: 502 });
  }
  const matchBody = await readJsonBody<{ item?: MatchRow; error?: string }>(matchRes);
  if (!matchRes.ok || !matchBody?.item) {
    return NextResponse.json({ error: matchBody?.error || "Match not found" }, { status: matchRes.status });
  }
  const match = matchBody.item;

  let teamsRes: Response;
  try {
    teamsRes = await fetch(
      `${leagueApiBaseUrl()}/v1/tournaments/${encodeURIComponent(match.tournamentId)}/teams`,
      { cache: "no-store" }
    );
  } catch {
    return NextResponse.json({ error: "League API offline" }, { status: 502 });
  }
  const teamsBody = await readJsonBody<{ items?: TeamRow[] }>(teamsRes);
  const teams = teamsBody?.items || [];
  const teamA = teams.find((t) => t.id === match.teamAId);
  const teamB = teams.find((t) => t.id === match.teamBId);
  const nameA = teamA?.name || "Team A";
  const nameB = teamB?.name || "Team B";
  const roleA = teamA?.discordRoleId?.trim();
  const roleB = teamB?.discordRoleId?.trim();

  const format = bestOfToFormat(match.bestOf);
  const replayLabel = replayCountLabel(format);
  const roundLabel = [match.roundCode, match.slot].filter(Boolean).join(" · ") || "Match";

  const team1Display = roleA ? `<@&${roleA}>` : `**${nameA}**`;
  const team2Display = roleB ? `<@&${roleB}>` : `**${nameB}**`;
  const pingLine = [roleA ? `<@&${roleA}>` : nameA, roleB ? `<@&${roleB}>` : nameB].join(" vs ") + " — your match is ready!";

  const allowedRoles = [roleA, roleB].filter(Boolean) as string[];

  let threadId: string | undefined;
  let podTextId: string | undefined;
  let podVoiceAId: string | undefined;
  let podVoiceBId: string | undefined;
  let announceMsgId: string | undefined;

  const staffRole = process.env.DISCORD_BOT_STAFF_ROLE_ID?.trim() || process.env.DISCORD_ROLE_STAFF_ID?.trim();

  /** Tell the Motion bot process to add thread or pod text channel to matchTimers. */
  let timerRegistered = false;
  let timerRegisterError: string | null = null;
  const registerBase = process.env.MOTION_BOT_REGISTER_URL?.trim().replace(/\/$/, "");
  const registerSecret = process.env.MOTION_BOT_INTERNAL_SECRET?.trim();
  const guildIdForTimer = process.env.DISCORD_GUILD_ID?.trim();

  async function registerReplayTimer(targetChannelId: string) {
    if (!registerBase || !registerSecret || !guildIdForTimer) {
      timerRegisterError =
        "Set MOTION_BOT_REGISTER_URL, MOTION_BOT_INTERNAL_SECRET (same as bot BOT_INTERNAL_SECRET), and DISCORD_GUILD_ID for replay timer";
      return;
    }
    try {
      const regRes = await fetch(`${registerBase}/internal/register-match-thread`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${registerSecret}`
        },
        body: JSON.stringify({
          channelId: targetChannelId,
          threadId: targetChannelId,
          guildId: guildIdForTimer,
          team1: nameA,
          team2: nameB,
          round: roundLabel,
          format
        })
      });
      const regJson = await readJsonBody<{ ok?: boolean; error?: string }>(regRes);
      timerRegistered = regRes.ok && regJson?.ok === true;
      if (!timerRegistered) {
        timerRegisterError = regJson?.error || `HTTP ${regRes.status}`;
      }
    } catch (e) {
      timerRegisterError = e instanceof Error ? e.message : "register fetch failed";
    }
  }

  if (podMode) {
    if (!guildIdEnv || !staffRoleForPod) {
      return NextResponse.json(
        {
          error:
            "Pod mode requires DISCORD_GUILD_ID and DISCORD_BOT_STAFF_ROLE_ID (or DISCORD_ROLE_STAFF_ID) for channel permissions."
        },
        { status: 500 }
      );
    }
    if (!roleA || !roleB) {
      return NextResponse.json(
        {
          error:
            "Pod mode requires both teams to have Discord role IDs on file (admin Teams page). Legacy mode uses threads without per-team voice locks."
        },
        { status: 400 }
      );
    }

    const matchShort = matchId.replace(/-/g, "").slice(0, 8);
    const pod = await createMatchPodChannels({
      guildId: guildIdEnv,
      categoryId: podCategoryId!,
      staffRoleId: staffRoleForPod,
      teamARoleId: roleA,
      teamBRoleId: roleB,
      nameA,
      nameB,
      matchShort,
      discordRequest
    });
    if ("error" in pod) {
      return NextResponse.json({ error: pod.error }, { status: 502 });
    }
    podTextId = pod.textId;
    podVoiceAId = pod.voiceAId;
    podVoiceBId = pod.voiceBId;

    const readyEmbedPod = {
      title: `🎮 ${roundLabel} — ${format}`,
      description:
        `${team1Display}  vs  ${team2Display}\n\n` +
        `Both teams react ✅ below to confirm ready.\n` +
        `Join your team's voice channel — **${nameA}** → <#${podVoiceAId}> · **${nameB}** → <#${podVoiceBId}>`,
      color: 0xe94560,
      fields: [
        { name: "⏱️ Ready-Up Deadline", value: "15 minutes — or match escalates to staff", inline: false },
        { name: "📁 Replays", value: `${replayLabel} in ${`<#${podTextId}>`}`, inline: true },
        {
          name: "🔊 Team voice",
          value: `<#${podVoiceAId}> · <#${podVoiceBId}>`,
          inline: true
        }
      ],
      footer: { text: `${process.env.EMBED_FOOTER_TEXT?.trim() || "Motion"} • React ✅ to confirm ready` },
      timestamp: new Date().toISOString()
    };

    const announcePost = await discordRequest(`/channels/${announceId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        content: pingLine,
        embeds: [readyEmbedPod],
        allowed_mentions: { parse: [], roles: allowedRoles }
      })
    });
    const announceJson = await readJsonBody<{ id?: string; message?: string }>(announcePost);
    if (!announcePost.ok) {
      return NextResponse.json(
        { error: announceJson?.message || "Failed to post to announce channel", podChannelsCreated: true },
        { status: announcePost.status }
      );
    }
    announceMsgId = announceJson?.id;
    if (announceMsgId) {
      await discordRequest(`/channels/${announceId}/messages/${announceMsgId}/reactions/%E2%9C%85/@me`, {
        method: "PUT"
      }).catch(() => undefined);
    }

    const threadEmbedPod = {
      title: `🎮 ${roundLabel} — ${format}`,
      description: `${team1Display}  vs  ${team2Display}`,
      color: 0x0f3460,
      fields: [
        { name: "📁 Replays Required", value: replayLabel, inline: true },
        {
          name: "🔊 Voice",
          value: `**${nameA}:** <#${podVoiceAId}>\n**${nameB}:** <#${podVoiceBId}>`,
          inline: true
        },
        { name: "⏱️ Submission Timer", value: "15 minutes from first .replay upload in this channel", inline: false },
        { name: "📤 Winning Team", value: "Upload all .replay files from this series here once complete.", inline: false },
        {
          name: "📥 Losing Team",
          value: "Type `/confirm` to agree with the result.\nType `/dispute [reason]` if you disagree.",
          inline: false
        },
        {
          name: "⚠️ Warning",
          value: "No replay submission within 15 minutes = default loss awarded to opposing team.",
          inline: false
        }
      ],
      footer: { text: `${process.env.EMBED_FOOTER_TEXT?.trim() || "Motion"} • Timer starts on first .replay upload` },
      timestamp: new Date().toISOString()
    };

    await discordRequest(`/channels/${podTextId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        embeds: [threadEmbedPod],
        ...(staffRole ? { content: `<@&${staffRole}> — Match pod opened (from site).` } : {})
      })
    }).catch(() => undefined);

    await registerReplayTimer(podTextId);
  } else {
    const readyEmbed = {
      title: `🎮 ${roundLabel} — ${format}`,
      description:
        `${team1Display}  vs  ${team2Display}\n\n` +
        `Both teams react ✅ below to confirm ready.\n` +
        `Then join 🔊 **${vl}**`,
      color: 0xe94560,
      fields: [
        { name: "⏱️ Ready-Up Deadline", value: "15 minutes — or match escalates to staff", inline: false },
        { name: "📁 Replays Required", value: replayLabel, inline: true },
        { name: "🔊 Voice Room", value: vl, inline: true }
      ],
      footer: { text: `${process.env.EMBED_FOOTER_TEXT?.trim() || "Motion"} • React ✅ to confirm ready` },
      timestamp: new Date().toISOString()
    };

    const announcePost = await discordRequest(`/channels/${announceId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        content: pingLine,
        embeds: [readyEmbed],
        allowed_mentions: { parse: [], roles: allowedRoles }
      })
    });
    const announceJson = await readJsonBody<{ id?: string; message?: string }>(announcePost);
    if (!announcePost.ok) {
      return NextResponse.json(
        { error: announceJson?.message || "Failed to post to announce channel" },
        { status: announcePost.status }
      );
    }
    announceMsgId = announceJson?.id;
    if (announceMsgId) {
      await discordRequest(`/channels/${announceId}/messages/${announceMsgId}/reactions/%E2%9C%85/@me`, {
        method: "PUT"
      }).catch(() => undefined);
    }

    const threadRes = await discordRequest(`/channels/${resultsParentId!}/threads`, {
      method: "POST",
      body: JSON.stringify({
        name: `${roundLabel} — ${nameA} vs ${nameB}`.slice(0, 100),
        auto_archive_duration: 1440,
        type: 11
      })
    });
    const threadJson = await readJsonBody<{ id?: string; message?: string }>(threadRes);
    if (!threadRes.ok) {
      return NextResponse.json(
        {
          error: threadJson?.message || "Posted announce but failed to create thread",
          announceMessageId: announceMsgId
        },
        { status: 502 }
      );
    }
    threadId = threadJson?.id;

    const threadEmbed = {
      title: `🎮 ${roundLabel} — ${format}`,
      description: `${team1Display}  vs  ${team2Display}`,
      color: 0x0f3460,
      fields: [
        { name: "📁 Replays Required", value: replayLabel, inline: true },
        { name: "🔊 Voice Room", value: vl, inline: true },
        { name: "⏱️ Submission Timer", value: "15 minutes from first .replay upload", inline: false },
        { name: "📤 Winning Team", value: "Upload all .replay files from this series here once complete.", inline: false },
        {
          name: "📥 Losing Team",
          value: "Type `/confirm` to agree with the result.\nType `/dispute [reason]` if you disagree.",
          inline: false
        },
        {
          name: "⚠️ Warning",
          value: "No replay submission within 15 minutes = default loss awarded to opposing team.",
          inline: false
        }
      ],
      footer: { text: `${process.env.EMBED_FOOTER_TEXT?.trim() || "Motion"} • Timer starts on first .replay upload` },
      timestamp: new Date().toISOString()
    };

    if (threadId) {
      await discordRequest(`/channels/${threadId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          embeds: [threadEmbed],
          ...(staffRole ? { content: `<@&${staffRole}> — Match thread opened (from site).` } : {})
        })
      }).catch(() => undefined);
    }

    if (threadId) {
      await registerReplayTimer(threadId);
    } else {
      timerRegisterError =
        "Set MOTION_BOT_REGISTER_URL, MOTION_BOT_INTERNAL_SECRET (same as bot BOT_INTERNAL_SECRET), and DISCORD_GUILD_ID for replay timer";
    }
  }

  let updatedMatch: MatchRow | null = null;
  const patchPayload: Record<string, unknown> = {};
  if (match.status === "scheduled") patchPayload.status = "in_progress";
  if (podTextId && podVoiceAId && podVoiceBId) {
    patchPayload.discordPodTextChannelId = podTextId;
    patchPayload.discordPodVoiceAChannelId = podVoiceAId;
    patchPayload.discordPodVoiceBChannelId = podVoiceBId;
  }
  if (Object.keys(patchPayload).length > 0) {
    try {
      const patchRes = await fetch(`${leagueApiBaseUrl()}/v1/matches/${encodeURIComponent(matchId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patchPayload)
      });
      const patchBody = await readJsonBody<{ item?: MatchRow }>(patchRes);
      if (patchRes.ok && patchBody?.item) updatedMatch = patchBody.item;
    } catch {
      /* optional */
    }
  }

  return NextResponse.json({
    ok: true,
    podMode,
    announceChannelId: announceId,
    announceMessageId: announceMsgId,
    threadId: threadId || null,
    podTextChannelId: podTextId || null,
    podVoiceAChannelId: podVoiceAId || null,
    podVoiceBChannelId: podVoiceBId || null,
    voiceSlot: podMode ? null : voiceSlot,
    match: updatedMatch,
    timerRegistered,
    ...(timerRegisterError ? { timerRegisterWarning: timerRegisterError } : {})
  });
}
