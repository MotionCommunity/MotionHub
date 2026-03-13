const { app, BrowserWindow, shell, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Check for updates: open this URL in the browser (e.g. Google Drive folder or file link).
// Example Google Drive folder: https://drive.google.com/drive/folders/YOUR_FOLDER_ID
// Example Google Drive file (direct to file): https://drive.google.com/file/d/YOUR_FILE_ID/view?usp=sharing
const CHECK_FOR_UPDATES_URL = 'https://drive.google.com/drive/folders/1RpXzhodnH1fvaBP5W2G9D6-UUdVZkvwz?usp=sharing';

const GITHUB_REPO = 'MotionCommunity/official-rules';
const GITHUB_BRANCH = 'main';
const RULES_PATH = 'index.html';
const RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}`;
const API_BASE = `https://api.github.com/repos/${GITHUB_REPO}`;

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

// Open the “check for updates” URL in the default browser (set CHECK_FOR_UPDATES_URL in main.js)
ipcMain.handle('app:openUpdateUrl', () => {
  if (CHECK_FOR_UPDATES_URL && typeof shell.openExternal === 'function') {
    shell.openExternal(CHECK_FOR_UPDATES_URL);
  }
});
ipcMain.handle('app:getUpdateUrl', () => CHECK_FOR_UPDATES_URL || '');

// Tournament app (Windows .exe) — path stored in config, launch from hub
ipcMain.handle('app:getTournamentAppPath', () => loadConfig().tournamentAppPath || '');
ipcMain.handle('app:setTournamentAppPath', (_event, exePath) => {
  saveConfig({ tournamentAppPath: (exePath && exePath.trim()) || '' });
  return true;
});
ipcMain.handle('app:pickTournamentAppPath', async () => {
  const { filePaths } = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
    title: 'Select Tournament application',
    properties: ['openFile'],
    filters: [{ name: 'Executable', extensions: ['exe'] }],
  });
  return filePaths && filePaths[0] ? filePaths[0] : '';
});
ipcMain.handle('app:launchTournamentApp', async () => {
  const exePath = (loadConfig().tournamentAppPath || '').trim();
  if (!exePath) throw new Error('Tournament app path not set. Set it in the Tournament section.');
  if (!fs.existsSync(exePath)) throw new Error('Tournament app not found at that path.');
  const child = spawn(exePath, [], { detached: true, stdio: 'ignore', windowsHide: false });
  child.unref();
  return true;
});

// Discord bot (Master only) — path to bot folder, run "node index.js" there so bot stays online
ipcMain.handle('app:getBotPath', () => loadConfig().discordBotPath || '');
ipcMain.handle('app:setBotPath', (_event, dirPath) => {
  saveConfig({ discordBotPath: (dirPath && dirPath.trim()) || '' });
  return true;
});
ipcMain.handle('app:pickBotFolder', async () => {
  const { filePaths } = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
    title: 'Select Motion Bot folder (contains index.js)',
    properties: ['openDirectory'],
  });
  return filePaths && filePaths[0] ? filePaths[0] : '';
});
ipcMain.handle('app:launchBot', async () => {
  const botPath = (loadConfig().discordBotPath || '').trim();
  if (!botPath) throw new Error('Discord bot path not set. Set it in the Tournament section.');
  if (!fs.existsSync(botPath)) throw new Error('Bot folder not found at that path.');
  const indexJs = path.join(botPath, 'index.js');
  if (!fs.existsSync(indexJs)) throw new Error('index.js not found in that folder.');
  if (process.platform === 'win32') {
    const child = spawn('cmd.exe', ['/c', 'cd /d "' + botPath + '" && node index.js'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    child.unref();
  } else {
    const child = spawn('node', [indexJs], { cwd: botPath, detached: true, stdio: 'ignore' });
    child.unref();
  }
  return true;
});

// Notes sync: staff POST to backend, master GET from backend (no GitHub for staff)
ipcMain.handle('notes:getSyncUrl', () => loadConfig().notesSyncUrl || '');
ipcMain.handle('notes:setSyncUrl', (_event, url) => {
  saveConfig({ notesSyncUrl: (url && url.trim()) || '' });
  return true;
});
ipcMain.handle('notes:submit', async (_event, payload) => {
  const base = (loadConfig().notesSyncUrl || '').replace(/\/$/, '');
  if (!base) return { ok: false, error: 'No sync URL configured' };
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
  const base = (loadConfig().notesSyncUrl || '').replace(/\/$/, '');
  if (!base) return { ok: false, error: 'No sync URL configured', notes: [] };
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
ipcMain.handle('notes:submitSuggestedRules', async (_event, html) => {
  const base = (loadConfig().notesSyncUrl || '').replace(/\/$/, '');
  if (!base) return { ok: false, error: 'No sync URL configured' };
  const url = `${base}/api/suggested-rules`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: html || '' }),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: text || res.statusText };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
ipcMain.handle('notes:fetchSuggestedRules', async () => {
  const base = (loadConfig().notesSyncUrl || '').replace(/\/$/, '');
  if (!base) return { ok: false, error: 'No sync URL configured', html: '' };
  const url = `${base}/api/suggested-rules`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) return { ok: false, error: text || res.statusText, html: '' };
    const data = JSON.parse(text || '{}');
    return { ok: true, html: data.html || '' };
  } catch (e) {
    return { ok: false, error: e.message, html: '' };
  }
});

// Tournament sync — same base URL as notes; live data for all Staff + Master hubs
ipcMain.handle('tournamentSync:fetch', async () => {
  const base = (loadConfig().notesSyncUrl || '').replace(/\/$/, '');
  if (!base) return { ok: false, error: 'No sync URL configured', data: null };
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
  const base = (loadConfig().notesSyncUrl || '').replace(/\/$/, '');
  if (!base) return { ok: false, error: 'No sync URL configured' };
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

app.whenReady().then(() => {
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

