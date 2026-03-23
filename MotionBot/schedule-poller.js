/**
 * Schedule poller: reads Motion Hub tournament-sync API (scheduledMatches) and posts
 * match calls to CHANNEL_MATCH_ANNOUNCE when status is "calling", startRequestedAt is set, or startAt has passed.
 * See ../config.js and .env.example.
 */

const { config } = require('./config');

const calledMatchIds = new Set();

function getSyncUrl() {
  const base = config.tournamentSync.url;
  return `${base}/api/tournament-sync`;
}

function getMatchChannelId() {
  return config.channels.matchAnnounce || null;
}

function shouldCallMatch(match) {
  const status = (match.status || '').toLowerCase();
  const startRequestedAt = match.startRequestedAt;
  const startAt = match.startAt ? new Date(match.startAt) : null;
  const now = new Date();
  if (status === 'calling' || (startRequestedAt && startRequestedAt.length > 0)) return true;
  if (status === 'scheduled' && startAt && now >= startAt) return true;
  return false;
}

function buildMessage(match) {
  const teamAName = (match.teamA && match.teamA.name) || 'Team A';
  const teamBName = (match.teamB && match.teamB.name) || 'Team B';
  const round = match.round || '—';
  const slot = match.matchSlot || '—';
  const roleA = (match.teamA && match.teamA.discordRoleId) ? `<@&${match.teamA.discordRoleId}>` : teamAName;
  const roleB = (match.teamB && match.teamB.discordRoleId) ? `<@&${match.teamB.discordRoleId}>` : teamBName;
  return [
    `**Match: ${teamAName} vs ${teamBName}**`,
    `**Round:** ${round} · **Slot:** ${slot}`,
    `${roleA} vs ${roleB}`,
    'Head to the match channel / voice.',
  ].join('\n');
}

async function fetchScheduledMatches() {
  const url = getSyncUrl();
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.scheduledMatches) ? data.scheduledMatches : [];
}

async function pollAndPost(client) {
  const channelId = getMatchChannelId();
  if (!channelId) return;

  let matches;
  try {
    matches = await fetchScheduledMatches();
  } catch (e) {
    console.error('[Schedule] Failed to fetch tournament sync:', e.message);
    return;
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    console.error('[Schedule] Could not find channel', channelId);
    return;
  }

  for (const match of matches) {
    const id = match.id;
    if (!id || calledMatchIds.has(id)) continue;
    if (!shouldCallMatch(match)) continue;

    const text = buildMessage(match);
    try {
      await channel.send({ content: text });
      calledMatchIds.add(id);
      console.log('[Schedule] Called match', id, (match.teamA && match.teamA.name) || '', 'vs', (match.teamB && match.teamB.name) || '');
    } catch (e) {
      console.error('[Schedule] Failed to send for', id, e.message);
    }
  }
}

/**
 * Call from index.js when client is ready.
 * @param {import('discord.js').Client} client
 */
function startSchedulePoller(client) {
  const channelId = getMatchChannelId();
  if (!channelId) {
    console.log('[Schedule] CHANNEL_MATCH_ANNOUNCE (or DISCORD_MATCH_CHANNEL_ID) not set; schedule poller disabled.');
    return;
  }
  const ms = config.tournamentSync.pollIntervalMs;
  console.log('[Schedule] Polling', getSyncUrl(), 'every', ms / 1000, 's');
  pollAndPost(client);
  setInterval(() => pollAndPost(client), ms);
}

module.exports = { startSchedulePoller };
