/**
 * Discord permission bitfields (strings for REST API v10).
 * @see https://discord.com/developers/docs/topics/permissions
 */
const VIEW = 1n << 10n;
const SEND = 1n << 11n;
const EMBED = 1n << 14n;
const ATTACH = 1n << 15n;
const READ_HIST = 1n << 16n;
const CONNECT = 1n << 20n;
const SPEAK = 1n << 25n;

function bits(...xs: bigint[]) {
  return xs.reduce((a, b) => a | b, 0n).toString();
}

const TEXT_TEAM = bits(VIEW, SEND, EMBED, ATTACH, READ_HIST);
const VOICE_TEAM = bits(VIEW, CONNECT, SPEAK);
const DENY_VIEW = bits(VIEW);

export type DiscordReq = (path: string, init?: RequestInit) => Promise<Response>;

function slug(s: string, max = 32): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max) || "team";
}

export async function createMatchPodChannels(opts: {
  guildId: string;
  categoryId: string;
  staffRoleId: string;
  teamARoleId: string;
  teamBRoleId: string;
  nameA: string;
  nameB: string;
  matchShort: string;
  discordRequest: DiscordReq;
}): Promise<{ textId: string; voiceAId: string; voiceBId: string } | { error: string }> {
  const { guildId, categoryId, staffRoleId, teamARoleId, teamBRoleId, nameA, nameB, matchShort, discordRequest } = opts;

  const sa = slug(nameA, 24);
  const sb = slug(nameB, 24);
  const prefix = `m-${matchShort}`;

  const textName = `${prefix}-${sa}-vs-${sb}`.slice(0, 100);
  const vAName = `${prefix}-vc-${sa}`.slice(0, 100);
  const vBName = `${prefix}-vc-${sb}`.slice(0, 100);

  // Text: @everyone deny view; team A & B + staff can use replays
  const textOverwrites = [
    { id: guildId, type: 0 as const, deny: DENY_VIEW },
    { id: teamARoleId, type: 0 as const, allow: TEXT_TEAM },
    { id: teamBRoleId, type: 0 as const, allow: TEXT_TEAM },
    { id: staffRoleId, type: 0 as const, allow: TEXT_TEAM }
  ];

  const textRes = await discordRequest(`/guilds/${guildId}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: textName,
      type: 0,
      parent_id: categoryId,
      permission_overwrites: textOverwrites
    })
  });
  const textJson = await textRes.json().catch(() => ({}));
  if (!textRes.ok) {
    return { error: (textJson as { message?: string })?.message || "Failed to create match text channel" };
  }
  const textId = (textJson as { id: string }).id;

  // Voice A: only team A + staff (team B denied view)
  const voiceAOverwrites = [
    { id: guildId, type: 0 as const, deny: DENY_VIEW },
    { id: teamARoleId, type: 0 as const, allow: VOICE_TEAM },
    { id: teamBRoleId, type: 0 as const, deny: DENY_VIEW },
    { id: staffRoleId, type: 0 as const, allow: VOICE_TEAM }
  ];

  const vARes = await discordRequest(`/guilds/${guildId}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: vAName,
      type: 2,
      parent_id: categoryId,
      permission_overwrites: voiceAOverwrites
    })
  });
  const vAJson = await vARes.json().catch(() => ({}));
  if (!vARes.ok) {
    return { error: (vAJson as { message?: string })?.message || "Failed to create team A voice channel" };
  }
  const voiceAId = (vAJson as { id: string }).id;

  // Voice B: only team B + staff
  const voiceBOverwrites = [
    { id: guildId, type: 0 as const, deny: DENY_VIEW },
    { id: teamBRoleId, type: 0 as const, allow: VOICE_TEAM },
    { id: teamARoleId, type: 0 as const, deny: DENY_VIEW },
    { id: staffRoleId, type: 0 as const, allow: VOICE_TEAM }
  ];

  const vBRes = await discordRequest(`/guilds/${guildId}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: vBName,
      type: 2,
      parent_id: categoryId,
      permission_overwrites: voiceBOverwrites
    })
  });
  const vBJson = await vBRes.json().catch(() => ({}));
  if (!vBRes.ok) {
    return { error: (vBJson as { message?: string })?.message || "Failed to create team B voice channel" };
  }
  const voiceBId = (vBJson as { id: string }).id;

  return { textId, voiceAId, voiceBId };
}
