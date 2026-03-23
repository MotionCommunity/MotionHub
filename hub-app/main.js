const { app, BrowserWindow, shell, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const tournamentDb = require('./tournament-db');
const googleSheets = require('./google-sheets');
const replayParser = require('./replay-parser');

// Check for updates: open this URL in the browser (e.g. Google Drive folder or file link).
// Example Google Drive folder: https://drive.google.com/drive/folders/YOUR_FOLDER_ID
// Example Google Drive file (direct to file): https://drive.google.com/file/d/YOUR_FILE_ID/view?usp=sharing
const CHECK_FOR_UPDATES_URL = 'https://drive.google.com/drive/folders/1RpXzhodnH1fvaBP5W2G9D6-UUdVZkvwz?usp=sharing';

const GITHUB_REPO = 'MotionCommunity/official-rules';
const GITHUB_BRANCH = 'main';
const RULES_PATH = 'index.html';
const RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}`;
const API_BASE = `https://api.github.com/repos/${GITHUB_REPO}`;

const GITHUB_STATS_REPO = 'MotionCommunity/stats';
const STATS_BRANCH = 'main';
const STATS_PATH = 'index.html';
const STATS_RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_STATS_REPO}/${STATS_BRANCH}`;
const STATS_API_BASE = `https://api.github.com/repos/${GITHUB_STATS_REPO}`;

// Built-in Notes/Tournament sync API (no config needed)
const DEFAULT_NOTES_SYNC_URL = 'https://motion-notes-api.vercel.app';

// MotionRL paths — preload Google credentials from here if hub config is empty
const MOTIONRL_DB_PATH = 'C:\\MotionRL\\motion_rl.db';
const DEFAULT_GOOGLE_CREDENTIALS_PATH = 'C:\\MotionRL\\Things to input\\.json\\motion-rl-forms-0eb56771d597.json';

/** Try to read Google credentials path + spreadsheet from MotionRL's SQLite. Returns object or null. */
async function loadMotionRLGoogleSettings() {
  try {
    if (!fs.existsSync(MOTIONRL_DB_PATH)) return null;
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const buf = fs.readFileSync(MOTIONRL_DB_PATH);
    const db = new SQL.Database(buf);
    const res = db.exec("SELECT Key, Value FROM Settings WHERE Key IN ('GoogleCredentialsPath','SpreadsheetId','SheetName')");
    db.close();
    if (!res[0] || !res[0].values) return null;
    const keyIdx = res[0].columns.indexOf('Key');
    const valIdx = res[0].columns.indexOf('Value');
    const out = {};
    for (const row of res[0].values) {
      out[row[keyIdx]] = row[valIdx] || '';
    }
    return {
      credentialsPath: out.GoogleCredentialsPath || '',
      spreadsheetId: out.SpreadsheetId || '',
      sheetName: (out.SheetName && out.SheetName.trim()) || 'Form_Responses',
    };
  } catch (_) {
    return null;
  }
}

/** Get effective Google config: hub config first, then MotionRL DB, then default credentials path. */
async function getEffectiveGoogleConfig() {
  const c = loadConfig();
  if (c.googleCredentialsPath && c.spreadsheetId) {
    return {
      credentialsPath: c.googleCredentialsPath,
      spreadsheetId: c.spreadsheetId,
      sheetName: (c.sheetName && c.sheetName.trim()) || 'Form_Responses',
    };
  }
  const mrl = await loadMotionRLGoogleSettings();
  if (mrl && (mrl.credentialsPath || mrl.spreadsheetId)) {
    return {
      credentialsPath: mrl.credentialsPath || DEFAULT_GOOGLE_CREDENTIALS_PATH,
      spreadsheetId: mrl.spreadsheetId || c.spreadsheetId || '',
      sheetName: mrl.sheetName || 'Form_Responses',
    };
  }
  return {
    credentialsPath: c.googleCredentialsPath || DEFAULT_GOOGLE_CREDENTIALS_PATH,
    spreadsheetId: c.spreadsheetId || '',
    sheetName: (c.sheetName && c.sheetName.trim()) || 'Form_Responses',
  };
}

function getConfigPath() {
  return path.join(app.getPath('userData'), 'motion-hub-config.json');
}

function loadConfig() {
  try {
    const p = getConfigPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (_) {}
  return {};
}

function saveConfig(updates) {
  const p = getConfigPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const data = { ...loadConfig(), ...updates };
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function getStoredToken() {
  return loadConfig().githubToken || null;
}

function setStoredToken(token) {
  saveConfig({ githubToken: token || null });
}

ipcMain.handle('app:getStaffHandle', () => loadConfig().staffHandle || '');
ipcMain.handle('app:setStaffHandle', (_event, handle) => {
  saveConfig({ staffHandle: (handle && handle.trim()) || '' });
  return true;
});

// Teams archive (all teams you can use in presets / drafts)
function makeTeamId() {
  return 't-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

ipcMain.handle('app:getTeamsArchive', () => {
  const list = loadConfig().teamsArchive;
  return Array.isArray(list) ? list : [];
});

ipcMain.handle('app:addTeamToArchive', (_event, { name, discordRoleId }) => {
  const list = loadConfig().teamsArchive;
  const archive = Array.isArray(list) ? [...list] : [];
  const id = makeTeamId();
  archive.push({
    id,
    name: (name && String(name).trim()) || 'Team',
    discordRoleId: (discordRoleId && String(discordRoleId).trim()) || undefined,
  });
  saveConfig({ teamsArchive: archive });
  return id;
});

ipcMain.handle('app:updateTeamInArchive', (_event, id, { name, discordRoleId }) => {
  const list = loadConfig().teamsArchive;
  const archive = Array.isArray(list) ? [...list] : [];
  const idx = archive.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  if (name !== undefined) archive[idx].name = (name && String(name).trim()) || 'Team';
  if (discordRoleId !== undefined) archive[idx].discordRoleId = (discordRoleId && String(discordRoleId).trim()) || undefined;
  saveConfig({ teamsArchive: archive });
  return true;
});

ipcMain.handle('app:deleteTeamFromArchive', (_event, id) => {
  const list = loadConfig().teamsArchive;
  const archive = (Array.isArray(list) ? list : []).filter((t) => t.id !== id);
  const presets = loadConfig().draftTeamPresets;
  const presetList = Array.isArray(presets) ? presets : [];
  const updatedPresets = presetList.map((p) => {
    if (p.teamIds && Array.isArray(p.teamIds)) {
      return { ...p, teamIds: p.teamIds.filter((tid) => tid !== id) };
    }
    return p;
  });
  saveConfig({ teamsArchive: archive, draftTeamPresets: updatedPresets });
  return true;
});

// Presets are profiles: name + list of team ids (from archive)
ipcMain.handle('app:getDraftTeamPresets', () => {
  const list = loadConfig().draftTeamPresets;
  return Array.isArray(list) ? list : [];
});

ipcMain.handle('app:saveDraftTeamPreset', (_event, { name, teamIds, salaryCap }) => {
  const list = loadConfig().draftTeamPresets;
  const presets = Array.isArray(list) ? [...list] : [];
  const cap = salaryCap != null && salaryCap !== '' ? Math.max(0, parseInt(salaryCap, 10) || 0) : null;
  presets.push({
    name: (name && String(name).trim()) || 'Preset',
    teamIds: Array.isArray(teamIds) ? teamIds : [],
    salaryCap: cap,
  });
  saveConfig({ draftTeamPresets: presets });
  return true;
});

ipcMain.handle('app:updateDraftTeamPreset', (_event, index, { name, teamIds, salaryCap }) => {
  const list = loadConfig().draftTeamPresets;
  const presets = Array.isArray(list) ? [...list] : [];
  if (index < 0 || index >= presets.length) return false;
  if (name !== undefined) presets[index].name = (name && String(name).trim()) || presets[index].name;
  if (teamIds !== undefined) presets[index].teamIds = Array.isArray(teamIds) ? teamIds : presets[index].teamIds || [];
  if (salaryCap !== undefined) presets[index].salaryCap = salaryCap != null && salaryCap !== '' ? Math.max(0, parseInt(salaryCap, 10) || 0) : null;
  saveConfig({ draftTeamPresets: presets });
  return true;
});

ipcMain.handle('app:deleteDraftTeamPreset', (_event, index) => {
  const list = loadConfig().draftTeamPresets;
  const presets = Array.isArray(list) ? [...list] : [];
  if (index < 0 || index >= presets.length) return false;
  presets.splice(index, 1);
  saveConfig({ draftTeamPresets: presets });
  return true;
});

async function fetchOptions(token) {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Motion-Staff-Hub',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return { headers };
}

// GET file content + sha (for editor and for update)
ipcMain.handle('github:getRulesFile', async (_event, token) => {
  const opts = await fetchOptions(token || getStoredToken());
  const res = await fetch(`${API_BASE}/contents/${RULES_PATH}?ref=${GITHUB_BRANCH}`, opts);
  if (!res.ok) throw new Error(res.status === 404 ? 'File not found' : `GitHub ${res.status}`);
  const json = await res.json();
  const content = Buffer.from(json.content, 'base64').toString('utf8');
  return { content, sha: json.sha };
});

// GET file content only (no auth, raw URL - for simple read)
ipcMain.handle('github:getRulesContent', async () => {
  const res = await fetch(`${RAW_BASE}/${RULES_PATH}`);
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return await res.text();
});

// PUT file (update) - requires token
ipcMain.handle('github:putRulesFile', async (_event, { content, message, sha, token }) => {
  const t = token || getStoredToken();
  if (!t) throw new Error('GitHub token required to publish');
  const opts = await fetchOptions(t);
  const body = {
    message: message || 'Update rules from Motion Hub',
    content: Buffer.from(content, 'utf8').toString('base64'),
    sha: sha || undefined,
    branch: GITHUB_BRANCH,
  };
  const res = await fetch(`${API_BASE}/contents/${RULES_PATH}`, {
    method: 'PUT',
    ...opts,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub ${res.status}`);
  }
  return await res.json();
});

// List commits for index.html (for rollback)
ipcMain.handle('github:getRulesCommits', async (_event, token) => {
  const opts = await fetchOptions(token || getStoredToken());
  const res = await fetch(
    `${API_BASE}/commits?path=${RULES_PATH}&per_page=30`,
    opts
  );
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const list = await res.json();
  return list.map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    date: c.commit.committer?.date,
    author: c.commit.author?.name,
  }));
});

// Get file content at a specific commit (for rollback preview / apply)
ipcMain.handle('github:getRulesFileAtRef', async (_event, ref) => {
  const opts = await fetchOptions(getStoredToken());
  const res = await fetch(`${API_BASE}/contents/${RULES_PATH}?ref=${ref}`, opts);
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const json = await res.json();
  return Buffer.from(json.content, 'base64').toString('utf8');
});

// Token management (for Master build – set token so Publish/Rollback work)
ipcMain.handle('github:setToken', (_event, token) => {
  setStoredToken(token);
  return true;
});
ipcMain.handle('github:hasToken', () => !!getStoredToken());

// Stats page (MotionCommunity/stats) – same token as rules
ipcMain.handle('github:getStatsFile', async (_event, token) => {
  const opts = await fetchOptions(token || getStoredToken());
  const res = await fetch(`${STATS_API_BASE}/contents/${STATS_PATH}?ref=${STATS_BRANCH}`, opts);
  if (!res.ok) throw new Error(res.status === 404 ? 'Stats file not found' : `GitHub ${res.status}`);
  const json = await res.json();
  const content = Buffer.from(json.content, 'base64').toString('utf8');
  return { content, sha: json.sha };
});

ipcMain.handle('github:putStatsFile', async (_event, { content, message, sha, token }) => {
  const t = token || getStoredToken();
  if (!t) throw new Error('GitHub token required to publish');
  const opts = await fetchOptions(t);
  const body = {
    message: message || 'Update stats page from Motion Hub',
    content: Buffer.from(content, 'utf8').toString('base64'),
    sha: sha || undefined,
    branch: STATS_BRANCH,
  };
  const res = await fetch(`${STATS_API_BASE}/contents/${STATS_PATH}`, {
    method: 'PUT',
    ...opts,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub ${res.status}`);
  }
  return await res.json();
});

// Open the “check for updates” URL in the default browser (set CHECK_FOR_UPDATES_URL in main.js)
ipcMain.handle('app:openUpdateUrl', () => {
  if (CHECK_FOR_UPDATES_URL && typeof shell.openExternal === 'function') {
    shell.openExternal(CHECK_FOR_UPDATES_URL);
  }
});
ipcMain.handle('app:getUpdateUrl', () => CHECK_FOR_UPDATES_URL || '');

// Replay parsing via boxcars (Rust) — full replay JSON for stats
ipcMain.handle('replay:parse', async (_event, replayFilePath, headerOnly = false) => {
  const appDir = __dirname;
  const parserPath = replayParser.getParserPath(appDir, loadConfig().replayParserPath);
  return replayParser.parseReplayFile(replayFilePath, {
    headerOnly: !!headerOnly,
    parserPath: parserPath || undefined,
    appDir,
  });
});

ipcMain.handle('replay:selectFiles', async () => {
  const { filePaths } = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
    title: 'Select .replay files',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Rocket League Replay', extensions: ['replay'] }],
  });
  return filePaths || [];
});

// Notes sync: staff POST to backend, master GET from backend (built-in URL)
function getNotesSyncBase() {
  const url = (loadConfig().notesSyncUrl || DEFAULT_NOTES_SYNC_URL).replace(/\/$/, '');
  return url || DEFAULT_NOTES_SYNC_URL;
}
ipcMain.handle('notes:getSyncUrl', () => getNotesSyncBase());
ipcMain.handle('notes:setSyncUrl', (_event, url) => {
  saveConfig({ notesSyncUrl: (url && url.trim()) || '' });
  return true;
});
ipcMain.handle('notes:submit', async (_event, payload) => {
  const base = getNotesSyncBase();
  const url = `${base}/api/note`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: text || res.statusText };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
ipcMain.handle('notes:fetch', async () => {
  const base = getNotesSyncBase();
  const url = `${base}/api/notes`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) return { ok: false, error: text || res.statusText, notes: [] };
    const data = JSON.parse(text || '{}');
    return { ok: true, notes: Array.isArray(data.notes) ? data.notes : [] };
  } catch (e) {
    return { ok: false, error: e.message, notes: [] };
  }
});

// Suggested rules (staff submit; master fetches to confirm and publish)
ipcMain.handle('notes:submitSuggestedRules', async (_event, payload) => {
  const base = getNotesSyncBase();
  const url = `${base}/api/suggested-rules`;
  try {
    const html = typeof payload === 'string' ? payload : (payload && payload.html);
    const submittedBy = typeof payload === 'object' && payload && payload.submittedBy != null ? String(payload.submittedBy) : '';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: html || '', submittedBy: submittedBy || '' }),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: text || res.statusText };
    const data = text ? JSON.parse(text) : {};
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
ipcMain.handle('notes:fetchSuggestedRules', async () => {
  const base = getNotesSyncBase();
  const url = `${base}/api/suggested-rules`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) return { ok: false, error: text || res.statusText, list: [], items: [] };
    const data = JSON.parse(text || '{}');
    const list = data.list || [];
    const items = data.items || [];
    return { ok: true, list, items };
  } catch (e) {
    return { ok: false, error: e.message, list: [], items: [] };
  }
});

// Suggested stats (staff submit; master fetches to confirm and publish)
ipcMain.handle('notes:submitSuggestedStats', async (_event, payload) => {
  const base = getNotesSyncBase();
  const url = `${base}/api/suggested-stats`;
  try {
    const html = typeof payload === 'string' ? payload : (payload && payload.html);
    const submittedBy = typeof payload === 'object' && payload && payload.submittedBy != null ? String(payload.submittedBy) : '';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: html || '', submittedBy: submittedBy || '' }),
    });
    const text = await res.text();
    if (!res.ok) {
      const msg = res.status === 404
        ? 'Suggested stats API not found (404). Redeploy the notes-api (hub-app/notes-api) so it includes /api/suggested-stats.'
        : (text || res.statusText);
      return { ok: false, error: msg };
    }
    const data = text ? JSON.parse(text) : {};
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
ipcMain.handle('notes:fetchSuggestedStats', async () => {
  const base = getNotesSyncBase();
  const url = `${base}/api/suggested-stats`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) {
      const msg = res.status === 404
        ? 'Suggested stats API not found (404). Redeploy the notes-api so it includes /api/suggested-stats.'
        : (text || res.statusText);
      return { ok: false, error: msg, list: [], items: [] };
    }
    const data = JSON.parse(text || '{}');
    const list = data.list || [];
    const items = data.items || [];
    return { ok: true, list, items };
  } catch (e) {
    return { ok: false, error: e.message, list: [], items: [] };
  }
});

// Suggested bracket (staff submit; master fetches to confirm and publish)
ipcMain.handle('notes:submitSuggestedBracket', async (_event, payload) => {
  const base = getNotesSyncBase();
  const url = `${base}/api/suggested-bracket`;
  try {
    const bracketDraft = typeof payload === 'object' && payload && payload.bracketDraft !== undefined ? payload.bracketDraft : payload;
    const submittedBy = typeof payload === 'object' && payload && payload.submittedBy != null ? String(payload.submittedBy) : '';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bracketDraft: bracketDraft || null, submittedBy: submittedBy || '' }),
    });
    const text = await res.text();
    if (!res.ok) {
      const msg = res.status === 404
        ? 'Suggested bracket API not found (404). Redeploy the notes-api so it includes /api/suggested-bracket.'
        : (text || res.statusText);
      return { ok: false, error: msg };
    }
    const data = text ? JSON.parse(text) : {};
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
ipcMain.handle('notes:fetchSuggestedBracket', async () => {
  const base = getNotesSyncBase();
  const url = `${base}/api/suggested-bracket`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) {
      const msg = res.status === 404
        ? 'Suggested bracket API not found (404). Redeploy the notes-api so it includes /api/suggested-bracket.'
        : (text || res.statusText);
      return { ok: false, error: msg, list: [], items: [] };
    }
    const data = JSON.parse(text || '{}');
    const list = data.list || [];
    const items = data.items || [];
    return { ok: true, list, items };
  } catch (e) {
    return { ok: false, error: e.message, list: [], items: [] };
  }
});

// Tournament sync — same base URL as notes; live data for all Staff + Master hubs
ipcMain.handle('tournamentSync:fetch', async () => {
  const base = getNotesSyncBase();
  try {
    const res = await fetch(`${base}/api/tournament-sync`);
    const text = await res.text();
    if (!res.ok) return { ok: false, error: text || res.statusText, data: null };
    const data = JSON.parse(text || '{}');
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message, data: null };
  }
});
ipcMain.handle('tournamentSync:update', async (_event, payload) => {
  const base = getNotesSyncBase();
  try {
    const res = await fetch(`${base}/api/tournament-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: text || res.statusText };
    const data = text ? JSON.parse(text) : {};
    return { ok: true, lastUpdated: data.lastUpdated };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// —— Tournament (in-hub: DB + Google Sheet sync) ——
ipcMain.handle('tournament:getList', (_event, status) => {
  return tournamentDb.getTournaments(status);
});

ipcMain.handle('tournament:get', (_event, id) => {
  return tournamentDb.getTournament(id);
});

ipcMain.handle('tournament:create', (_event, { name, salaryCap, description }) => {
  return tournamentDb.createTournament(name, salaryCap ?? 300, description);
});

ipcMain.handle('tournament:archive', (_event, id) => {
  tournamentDb.archiveTournament(id);
  return true;
});

ipcMain.handle('tournament:delete', (_event, id) => {
  tournamentDb.deleteTournament(id);
  return true;
});

ipcMain.handle('tournament:updateSettings', (_event, id, { teamSize, seriesFormat, bracketType, roundSeriesFormats, formatLocked, overrideLock }) => {
  tournamentDb.updateTournamentSettings(id, { teamSize, seriesFormat, bracketType, roundSeriesFormats, formatLocked, overrideLock });
  return true;
});

ipcMain.handle('tournament:updateSalaryCap', (_event, id, salaryCap) => {
  tournamentDb.updateTournamentSalaryCap(id, salaryCap);
  return true;
});

ipcMain.handle('tournament:getSubs', (_event, tournamentId) => {
  return tournamentDb.getTournamentSubs(tournamentId);
});

ipcMain.handle('tournament:addSub', (_event, tournamentId, playerId) => {
  tournamentDb.addTournamentSub(tournamentId, playerId);
  return true;
});

ipcMain.handle('tournament:removeSub', (_event, tournamentId, playerId) => {
  tournamentDb.removeTournamentSub(tournamentId, playerId);
  return true;
});

ipcMain.handle('tournament:updateTeams', (_event, tournamentId, teams) => {
  tournamentDb.updateTournamentTeams(tournamentId, teams);
  return true;
});

ipcMain.handle('tournament:getTeamSubs', (_event, tournamentId, teamName) => {
  return tournamentDb.getTeamSubs(tournamentId, teamName);
});

ipcMain.handle('tournament:getAllTeamSubsByTeam', (_event, tournamentId) => {
  return tournamentDb.getAllTeamSubsByTeam(tournamentId);
});

ipcMain.handle('tournament:addTeamSub', (_event, tournamentId, teamName, playerId) => {
  tournamentDb.addTeamSub(tournamentId, teamName, playerId);
  return true;
});

ipcMain.handle('tournament:removeTeamSub', (_event, tournamentId, teamName, playerId) => {
  tournamentDb.removeTeamSub(tournamentId, teamName, playerId);
  return true;
});

ipcMain.handle('tournament:assignPlayerToTeam', (_event, tournamentId, playerId, teamName) => {
  tournamentDb.assignPlayerToTeam(tournamentId, playerId, teamName);
  return true;
});

ipcMain.handle('tournament:unassignPlayerFromTeam', (_event, playerId) => {
  tournamentDb.unassignPlayerFromTeam(playerId);
  return true;
});

ipcMain.handle('tournament:getGoogleConfig', async () => {
  return getEffectiveGoogleConfig();
});

ipcMain.handle('tournament:setGoogleConfig', (_event, { credentialsPath, spreadsheetId, sheetName }) => {
  saveConfig({
    googleCredentialsPath: credentialsPath || '',
    spreadsheetId: spreadsheetId || '',
    sheetName: (sheetName && sheetName.trim()) || 'Form_Responses',
  });
  return true;
});

ipcMain.handle('tournament:pickCredentialsFile', async () => {
  const { filePaths } = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
    title: 'Select Google service account JSON',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  return filePaths && filePaths[0] ? filePaths[0] : '';
});

ipcMain.handle('tournament:syncFromSheet', async (_event, tournamentId) => {
  const c = await getEffectiveGoogleConfig();
  if (!c.credentialsPath || !c.spreadsheetId) {
    throw new Error('Set Google credentials and spreadsheet ID in Tournament settings first.');
  }
  const sheetPlayers = await googleSheets.fetchPlayers({
    credentialsPath: c.credentialsPath,
    spreadsheetId: c.spreadsheetId,
    sheetName: c.sheetName || 'Form_Responses',
  });
  const existing = tournamentDb.getPlayers({});
  let added = 0;
  let updated = 0;
  for (const p of sheetPlayers) {
    const wasNew = !existing.some((e) => e.ign === p.ign);
    tournamentDb.upsertPlayer(p, tournamentId || null);
    if (wasNew) added++; else updated++;
  }
  for (const ep of existing.filter((e) => e.status === 'Approved')) {
    const inSheet = sheetPlayers.find((s) => s.ign === ep.ign);
    if (!inSheet || inSheet.status !== 'Approved') {
      tournamentDb.upsertPlayer({
        ...ep,
        status: inSheet ? inSheet.status : 'Rejected',
      }, ep.tournamentId);
    }
  }
  return { added, updated };
});

ipcMain.handle('players:getAll', (_event, { status, tournamentId }) => {
  return tournamentDb.getPlayers({ status: status || null, tournamentId: tournamentId ?? null });
});

ipcMain.handle('players:getOne', (_event, id) => {
  return tournamentDb.getPlayer(id);
});

ipcMain.handle('players:updateSalary', (_event, { id, salary }) => {
  tournamentDb.updatePlayerSalary(id, salary);
  return true;
});

ipcMain.handle('players:updateNotesAndSmurfing', (_event, { id, notes, smurfingSuspicious }) => {
  tournamentDb.updatePlayerNotesAndSmurfing(id, notes, !!smurfingSuspicious);
  return true;
});

ipcMain.handle('players:updateDiscordUserId', (_event, { id, discordUserId }) => {
  tournamentDb.updatePlayerDiscordUserId(id, discordUserId);
  return true;
});

ipcMain.handle('players:delete', (_event, id) => {
  tournamentDb.deletePlayer(id);
  return true;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#050712',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: 'Motion Hub',
  });

  win.loadFile('index.html');

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function setAppMenu() {
  const template = [
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for updates',
          click: () => {
            if (CHECK_FOR_UPDATES_URL) shell.openExternal(CHECK_FOR_UPDATES_URL);
          },
        },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  const dbPath = path.join(app.getPath('userData'), 'motion-tournament.db');
  await tournamentDb.init(dbPath);
  setAppMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

