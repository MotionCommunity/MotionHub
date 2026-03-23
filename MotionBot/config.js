/**
 * Single place for Discord IDs and labels used by the Motion bot.
 * Copy .env.example → .env and fill in your server’s IDs (Developer Mode → Copy ID).
 */
require('dotenv').config();

function req(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : '';
}

const config = {
  discord: {
    token: req('TOKEN'),
    clientId: req('CLIENT_ID'),
    guildId: req('GUILD_ID')
  },

  /**
   * Text channels the bot posts to (right-click channel → Copy ID).
   */
  channels: {
    /** Ready-up / match call posts (also used by schedule-poller as CHANNEL_MATCH_ANNOUNCE or DISCORD_MATCH_CHANNEL_ID) */
    matchAnnounce: req('CHANNEL_MATCH_ANNOUNCE') || req('DISCORD_MATCH_CHANNEL_ID'),
    /** Parent channel where match threads are created (#match-results style) */
    matchResults: req('CHANNEL_MATCH_RESULTS'),
    /** Staff processing / replay handoff */
    processingQueue: req('CHANNEL_PROCESSING_QUEUE'),
    /** Staff log / pings */
    staffChat: req('CHANNEL_STAFF_CHAT')
  },

  /**
   * Role IDs (Server Settings → Roles → … → Copy ID).
   */
  roles: {
    staff: req('ROLE_STAFF')
  },

  /**
   * Optional: text shown in embeds (not IDs). Change to match your channel names.
   */
  labels: {
    footer: process.env.EMBED_FOOTER_TEXT?.trim() || 'Motion RL Tournament',
    activity: process.env.BOT_ACTIVITY_TEXT?.trim() || 'Motion RL Tournaments',
    /** Voice room names in /match create (two shared VCs; assign teams to slot 1 or 2) */
    matchRoomNames: {
      '1': process.env.MATCH_ROOM_1_LABEL?.trim() || 'Match Voice A',
      '2': process.env.MATCH_ROOM_2_LABEL?.trim() || 'Match Voice B'
    }
  },

  tournamentSync: {
    url: (process.env.TOURNAMENT_SYNC_URL || 'https://motion-notes-api.vercel.app').replace(/\/$/, ''),
    pollIntervalMs: Math.max(15000, parseInt(process.env.POLL_INTERVAL_MS || '60000', 10))
  }
};

module.exports = { config };
