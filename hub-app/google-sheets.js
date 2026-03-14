/**
 * Fetch registered players from Google Sheet (Form responses).
 * Columns A:K: Timestamp, Discord, IGN, Epic, Tracker, Rank, Region, Anti-Smurf, Rules, Optional, Validation
 * Validation (col 10) = APPROVED | REJECTED | PENDING.
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { getSalaryForRank } = require('./tournament-db');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

function getAuthClient(credentialsPath) {
  const abs = path.isAbsolute(credentialsPath) ? credentialsPath : path.resolve(credentialsPath);
  if (!fs.existsSync(abs)) throw new Error('Credentials file not found: ' + credentialsPath);
  const content = fs.readFileSync(abs, 'utf8');
  const key = JSON.parse(content);
  const jwt = new google.auth.JWT(
    key.client_email,
    null,
    key.private_key,
    SCOPES,
    null
  );
  return jwt;
}

/**
 * Fetch all player rows from the sheet.
 * @param {{ credentialsPath: string, spreadsheetId: string, sheetName?: string }} options
 * @returns {Promise<Array<{ ign, discordUsername, epicGamesId, trackerUrl, rank, region, status, registeredAt, salary }>>}
 */
async function fetchPlayers(options) {
  const { credentialsPath, spreadsheetId, sheetName = 'Form_Responses' } = options;
  if (!credentialsPath || !spreadsheetId) {
    throw new Error('Google credentials path and spreadsheet ID are required');
  }
  const auth = getAuthClient(credentialsPath);
  await auth.authorize();
  const sheets = google.sheets({ version: 'v4', auth });
  const range = `${sheetName}!A:K`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  const rows = res.data.values || [];
  if (rows.length <= 1) return [];

  const players = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;
    const get = (idx) => (row[idx] != null ? String(row[idx]).trim() : '');
    const validation = get(10).toUpperCase();
    const status = validation === 'APPROVED' ? 'Approved' : validation === 'REJECTED' ? 'Rejected' : 'Pending';
    const ign = get(2);
    if (!ign) continue;
    let registeredAt = new Date().toISOString();
    try {
      const ts = get(0);
      if (ts) registeredAt = new Date(ts).toISOString();
    } catch (_) {}
    const rank = get(5);
    players.push({
      ign,
      discordUsername: get(1),
      epicGamesId: get(3),
      trackerUrl: get(4),
      rank,
      region: get(6),
      status,
      registeredAt,
      salary: getSalaryForRank(rank),
    });
  }
  return players;
}

function validateCredentials(credentialsPath) {
  try {
    const abs = path.isAbsolute(credentialsPath) ? credentialsPath : path.resolve(credentialsPath);
    if (!fs.existsSync(abs)) return false;
    const json = fs.readFileSync(abs, 'utf8');
    return json.includes('client_email') || json.includes('"type"');
  } catch {
    return false;
  }
}

module.exports = {
  fetchPlayers,
  validateCredentials,
};
