/**
 * Tournament + players SQLite DB for Motion Hub (replaces MotionRL app).
 * Uses sql.js (pure JS, no native addon). Schema mirrors MotionRL.
 */

const path = require('path');
const fs = require('fs');

let db = null;
let dbPath = null;

const PLAYER_STATUS = { Approved: 'Approved', Pending: 'Pending', Rejected: 'Rejected' };

function getDb() {
  if (!db) throw new Error('Tournament DB not initialized. Call init(dbPath) first.');
  return db;
}

function save() {
  if (!db || !dbPath) return;
  try {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch (_) {}
}

async function init(dbPathArg) {
  if (db) return;
  dbPath = dbPathArg;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }
  runSchema();
  migrateColumns();
  save();
}

function runSchema() {
  const d = getDb();
  d.run(`
    CREATE TABLE IF NOT EXISTS Tournaments (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      Name TEXT NOT NULL,
      SalaryCap INTEGER DEFAULT 300,
      Status TEXT DEFAULT 'Active',
      PrimaryColor TEXT DEFAULT '#0023F5',
      BracketType TEXT DEFAULT 'SingleElimination',
      TeamSize INTEGER DEFAULT 3,
      SeriesFormat TEXT DEFAULT 'BestOf5',
      RoundSeriesFormats TEXT,
      FormatLocked INTEGER DEFAULT 0,
      CreatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      ArchivedAt TEXT,
      Description TEXT
    )
  `);
  d.run(`
    CREATE TABLE IF NOT EXISTS RegisteredPlayers (
      Id INTEGER PRIMARY KEY AUTOINCREMENT,
      IGN TEXT NOT NULL,
      DiscordUsername TEXT DEFAULT '',
      EpicGamesId TEXT DEFAULT '',
      TrackerUrl TEXT DEFAULT '',
      Rank TEXT DEFAULT '',
      Region TEXT DEFAULT '',
      Status TEXT DEFAULT 'Pending',
      RegisteredAt TEXT,
      SyncedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      Salary INTEGER DEFAULT 10,
      DraftedToTeam TEXT,
      TournamentId INTEGER,
      Notes TEXT DEFAULT '',
      SmurfingSuspicious INTEGER DEFAULT 0
    )
  `);
}

function migrateColumns() {
  const d = getDb();
  try {
    d.run('ALTER TABLE RegisteredPlayers ADD COLUMN Notes TEXT DEFAULT ""');
    save();
  } catch (_) { /* already exists */ }
  try {
    d.run('ALTER TABLE RegisteredPlayers ADD COLUMN SmurfingSuspicious INTEGER DEFAULT 0');
    save();
  } catch (_) { /* already exists */ }
  try {
    d.run('ALTER TABLE Tournaments ADD COLUMN TeamSize INTEGER DEFAULT 3');
    save();
  } catch (_) { /* already exists */ }
  try {
    d.run('ALTER TABLE Tournaments ADD COLUMN SeriesFormat TEXT DEFAULT "BestOf5"');
    save();
  } catch (_) { /* already exists */ }
  try {
    d.run('ALTER TABLE Tournaments ADD COLUMN FormatLocked INTEGER DEFAULT 0');
    save();
  } catch (_) { /* already exists */ }
  try {
    d.run('ALTER TABLE Tournaments ADD COLUMN RoundSeriesFormats TEXT');
    save();
  } catch (_) { /* already exists */ }
  try {
    d.run('ALTER TABLE Tournaments ADD COLUMN TeamConfig TEXT');
    save();
  } catch (_) { /* already exists */ }
  try {
    d.run('ALTER TABLE RegisteredPlayers ADD COLUMN DiscordUserId TEXT');
    save();
  } catch (_) { /* already exists */ }
  d.run(`
    CREATE TABLE IF NOT EXISTS TournamentSubs (
      TournamentId INTEGER NOT NULL,
      PlayerId INTEGER NOT NULL,
      PRIMARY KEY (TournamentId, PlayerId)
    )
  `);
  d.run(`
    CREATE TABLE IF NOT EXISTS TournamentTeamSubs (
      TournamentId INTEGER NOT NULL,
      TeamName TEXT NOT NULL,
      PlayerId INTEGER NOT NULL,
      PRIMARY KEY (TournamentId, TeamName, PlayerId)
    )
  `);
  save();
}

function rowsFromExec(d, sql, params = []) {
  const stmt = d.prepare(sql);
  stmt.bind(params);
  const out = [];
  while (stmt.step()) {
    out.push(stmt.getAsObject());
  }
  stmt.free();
  return out;
}

function rowFromExec(d, sql, params = []) {
  const arr = rowsFromExec(d, sql, params);
  return arr[0] || null;
}

// —— Tournaments ——
function getTournaments(status = null) {
  const d = getDb();
  const sql = status
    ? 'SELECT * FROM Tournaments WHERE Status = ? ORDER BY CreatedAt DESC'
    : 'SELECT * FROM Tournaments ORDER BY CreatedAt DESC';
  const rows = status ? rowsFromExec(d, sql, [status]) : rowsFromExec(d, sql);
  return rows.map((row) => mapTournamentRow(row));
}

function mapTournamentRow(row) {
  let roundSeriesFormats = [];
  if (row.RoundSeriesFormats) {
    try {
      const parsed = JSON.parse(row.RoundSeriesFormats);
      if (Array.isArray(parsed)) roundSeriesFormats = parsed.filter((e) => e && typeof e.round === 'string' && e.seriesFormat);
    } catch (_) { /* ignore */ }
  }
  let teamConfig = [];
  if (row.TeamConfig) {
    try {
      const parsed = JSON.parse(row.TeamConfig);
      if (Array.isArray(parsed)) teamConfig = parsed.filter((e) => e && typeof e.name === 'string');
    } catch (_) { /* ignore */ }
  }
  return {
    id: row.Id,
    name: row.Name,
    salaryCap: row.SalaryCap ?? 300,
    status: row.Status ?? 'Active',
    primaryColor: row.PrimaryColor ?? '#0023F5',
    bracketType: row.BracketType ?? 'SingleElimination',
    teamSize: row.TeamSize != null ? row.TeamSize : 3,
    seriesFormat: row.SeriesFormat ?? 'BestOf5',
    roundSeriesFormats,
    teamConfig,
    formatLocked: !!(row.FormatLocked),
    createdAt: row.CreatedAt,
    archivedAt: row.ArchivedAt,
    description: row.Description,
  };
}

function getTournament(id) {
  const d = getDb();
  const row = rowFromExec(d, 'SELECT * FROM Tournaments WHERE Id = ?', [id]);
  if (!row) return null;
  return mapTournamentRow(row);
}

function updateTournamentSettings(id, { teamSize, seriesFormat, bracketType, roundSeriesFormats, formatLocked, overrideLock }) {
  const d = getDb();
  const t = getTournament(id);
  if (!t) return;
  if (t.formatLocked && !overrideLock) return; // no change if locked unless staff overrides
  const size = teamSize != null ? teamSize : t.teamSize;
  const fmt = seriesFormat != null ? seriesFormat : t.seriesFormat;
  const bracket = bracketType != null ? bracketType : t.bracketType;
  const rounds = roundSeriesFormats != null ? roundSeriesFormats : t.roundSeriesFormats;
  const roundsJson = Array.isArray(rounds) && rounds.length > 0 ? JSON.stringify(rounds) : null;
  const locked = formatLocked != null ? (formatLocked ? 1 : 0) : (t.formatLocked ? 1 : 0);
  d.run('UPDATE Tournaments SET TeamSize = ?, SeriesFormat = ?, BracketType = ?, RoundSeriesFormats = ?, FormatLocked = ? WHERE Id = ?', [size, fmt, bracket, roundsJson, locked, id]);
  save();
}

function getTournamentSubs(tournamentId) {
  const d = getDb();
  const rows = rowsFromExec(d, 'SELECT PlayerId FROM TournamentSubs WHERE TournamentId = ? ORDER BY PlayerId', [tournamentId]);
  return rows.map((r) => r.PlayerId);
}

function addTournamentSub(tournamentId, playerId) {
  const d = getDb();
  try {
    d.run('INSERT OR IGNORE INTO TournamentSubs (TournamentId, PlayerId) VALUES (?, ?)', [tournamentId, playerId]);
    save();
  } catch (_) {}
}

function removeTournamentSub(tournamentId, playerId) {
  getDb().run('DELETE FROM TournamentSubs WHERE TournamentId = ? AND PlayerId = ?', [tournamentId, playerId]);
  save();
}

function updateTournamentTeams(id, teams) {
  const d = getDb();
  const t = getTournament(id);
  if (!t) return;
  const arr = Array.isArray(teams) ? teams.filter((e) => e && typeof e.name === 'string') : [];
  const json = arr.length > 0 ? JSON.stringify(arr) : null;
  d.run('UPDATE Tournaments SET TeamConfig = ? WHERE Id = ?', [json, id]);
  save();
}

function getTeamSubs(tournamentId, teamName) {
  const d = getDb();
  const rows = rowsFromExec(d, 'SELECT PlayerId FROM TournamentTeamSubs WHERE TournamentId = ? AND TeamName = ? ORDER BY PlayerId', [tournamentId, teamName]);
  return rows.map((r) => r.PlayerId);
}

function getAllTeamSubsByTeam(tournamentId) {
  const d = getDb();
  const rows = rowsFromExec(d, 'SELECT TeamName, PlayerId FROM TournamentTeamSubs WHERE TournamentId = ? ORDER BY TeamName, PlayerId', [tournamentId]);
  const out = {};
  rows.forEach((r) => {
    if (!out[r.TeamName]) out[r.TeamName] = [];
    out[r.TeamName].push(r.PlayerId);
  });
  return out;
}

function addTeamSub(tournamentId, teamName, playerId) {
  const d = getDb();
  try {
    d.run('INSERT OR IGNORE INTO TournamentTeamSubs (TournamentId, TeamName, PlayerId) VALUES (?, ?, ?)', [tournamentId, teamName, playerId]);
    save();
  } catch (_) {}
}

function removeTeamSub(tournamentId, teamName, playerId) {
  getDb().run('DELETE FROM TournamentTeamSubs WHERE TournamentId = ? AND TeamName = ? AND PlayerId = ?', [tournamentId, teamName, playerId]);
  save();
}

function createTournament(name, salaryCap = 300, description = null) {
  const d = getDb();
  d.run(
    'INSERT INTO Tournaments (Name, SalaryCap, Description) VALUES (?, ?, ?)',
    [name, salaryCap, description || null]
  );
  const row = rowFromExec(d, 'SELECT last_insert_rowid() as id');
  save();
  return row ? row.id : null;
}

function archiveTournament(id) {
  const d = getDb();
  d.run('UPDATE Tournaments SET Status = ?, ArchivedAt = ? WHERE Id = ?', [
    'Archived',
    new Date().toISOString(),
    id,
  ]);
  save();
}

function deleteTournament(id) {
  const d = getDb();
  d.run('UPDATE RegisteredPlayers SET TournamentId = NULL, DraftedToTeam = NULL WHERE TournamentId = ?', [id]);
  d.run('DELETE FROM TournamentTeamSubs WHERE TournamentId = ?', [id]);
  d.run('DELETE FROM TournamentSubs WHERE TournamentId = ?', [id]);
  d.run('DELETE FROM Tournaments WHERE Id = ?', [id]);
  save();
}

// —— Players ——
function getPlayers(options = {}) {
  const d = getDb();
  const { status = null, tournamentId = null } = options;
  let sql = 'SELECT * FROM RegisteredPlayers';
  const params = [];
  const conditions = [];
  if (status) {
    conditions.push('Status = ?');
    params.push(status);
  }
  if (tournamentId != null) {
    conditions.push('TournamentId = ?');
    params.push(tournamentId);
  }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY IGN';
  const rows = rowsFromExec(d, sql, params);
  return rows.map((row) => ({
    id: row.Id,
    ign: row.IGN,
    discordUsername: row.DiscordUsername ?? '',
    discordUserId: row.DiscordUserId ?? null,
    epicGamesId: row.EpicGamesId ?? '',
    trackerUrl: row.TrackerUrl ?? '',
    rank: row.Rank ?? '',
    region: row.Region ?? '',
    status: row.Status ?? 'Pending',
    registeredAt: row.RegisteredAt,
    syncedAt: row.SyncedAt,
    salary: row.Salary ?? 10,
    draftedToTeam: row.DraftedToTeam,
    tournamentId: row.TournamentId,
    notes: row.Notes ?? '',
    smurfingSuspicious: !!(row.SmurfingSuspicious),
  }));
}

function getPlayer(id) {
  const d = getDb();
  const row = rowFromExec(d, 'SELECT * FROM RegisteredPlayers WHERE Id = ?', [id]);
  if (!row) return null;
  return {
    id: row.Id,
    ign: row.IGN,
    discordUsername: row.DiscordUsername ?? '',
    discordUserId: row.DiscordUserId ?? null,
    epicGamesId: row.EpicGamesId ?? '',
    trackerUrl: row.TrackerUrl ?? '',
    rank: row.Rank ?? '',
    region: row.Region ?? '',
    status: row.Status ?? 'Pending',
    registeredAt: row.RegisteredAt,
    syncedAt: row.SyncedAt,
    salary: row.Salary ?? 10,
    draftedToTeam: row.DraftedToTeam,
    tournamentId: row.TournamentId,
    notes: row.Notes ?? '',
    smurfingSuspicious: !!(row.SmurfingSuspicious),
  };
}

function updatePlayerDiscordUserId(id, discordUserId) {
  getDb().run('UPDATE RegisteredPlayers SET DiscordUserId = ? WHERE Id = ?', [discordUserId && String(discordUserId).trim() ? String(discordUserId).trim() : null, id]);
  save();
}

function assignPlayerToTeam(tournamentId, playerId, teamName) {
  const d = getDb();
  const t = getTournament(tournamentId);
  if (!t || !teamName) return;
  d.run('UPDATE RegisteredPlayers SET TournamentId = ?, DraftedToTeam = ? WHERE Id = ?', [tournamentId, teamName, playerId]);
  save();
}

function unassignPlayerFromTeam(playerId) {
  getDb().run('UPDATE RegisteredPlayers SET TournamentId = NULL, DraftedToTeam = NULL WHERE Id = ?', [playerId]);
  save();
}

function upsertPlayer(p, tournamentId = null) {
  const d = getDb();
  const existing = rowFromExec(d, 'SELECT Id FROM RegisteredPlayers WHERE IGN = ?', [p.ign]);
  const now = new Date().toISOString();
  if (existing) {
    d.run(
      `UPDATE RegisteredPlayers SET
        DiscordUsername = ?, EpicGamesId = ?, TrackerUrl = ?, Rank = ?, Region = ?,
        Status = ?, SyncedAt = ?
      WHERE IGN = ?`,
      [
        p.discordUsername ?? '',
        p.epicGamesId ?? '',
        p.trackerUrl ?? '',
        p.rank ?? '',
        p.region ?? '',
        p.status ?? 'Pending',
        now,
        p.ign,
      ]
    );
    save();
    return { updated: true };
  }
  d.run(
    `INSERT INTO RegisteredPlayers (
      IGN, DiscordUsername, EpicGamesId, TrackerUrl, Rank, Region, Status,
      RegisteredAt, SyncedAt, Salary, TournamentId, Notes, SmurfingSuspicious
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.ign,
      p.discordUsername ?? '',
      p.epicGamesId ?? '',
      p.trackerUrl ?? '',
      p.rank ?? '',
      p.region ?? '',
      p.status ?? 'Pending',
      p.registeredAt || now,
      now,
      p.salary ?? 10,
      tournamentId,
      p.notes ?? '',
      p.smurfingSuspicious ? 1 : 0,
    ]
  );
  save();
  return { added: true };
}

function updatePlayerSalary(id, salary) {
  getDb().run('UPDATE RegisteredPlayers SET Salary = ? WHERE Id = ?', [salary, id]);
  save();
}

function updatePlayerNotesAndSmurfing(id, notes, smurfingSuspicious) {
  getDb()
    .run('UPDATE RegisteredPlayers SET Notes = ?, SmurfingSuspicious = ? WHERE Id = ?', [
      notes ?? '',
      smurfingSuspicious ? 1 : 0,
      id,
    ]);
  save();
}

function deletePlayer(id) {
  getDb().run('DELETE FROM RegisteredPlayers WHERE Id = ?', [id]);
  save();
}

// Default salary by rank (mirror MotionRL RankSalary)
const RANK_SALARY = {
  'Supersonic Legend': 100,
  'Grand Champion III': 90,
  'Grand Champion II': 80,
  'Grand Champion I': 70,
  'Champion III': 60,
  'Champion II': 55,
  'Champion I': 50,
  'Diamond III': 45,
  'Diamond II': 40,
  'Diamond I': 35,
  'Platinum III': 30,
  'Platinum II': 25,
  'Platinum I': 20,
  'Gold III': 15,
  'Gold II': 12,
  'Gold I': 10,
  'Silver III': 8,
  'Silver II': 6,
  'Silver I': 5,
  'Bronze III': 4,
  'Bronze II': 3,
  'Bronze I': 2,
};

function getSalaryForRank(rank) {
  if (!rank) return 10;
  const r = rank.toString();
  for (const [key, value] of Object.entries(RANK_SALARY)) {
    if (r.toLowerCase().includes(key.toLowerCase())) return value;
  }
  return 10;
}

module.exports = {
  init,
  getDb,
  PLAYER_STATUS,
  getTournaments,
  getTournament,
  createTournament,
  archiveTournament,
  deleteTournament,
  updateTournamentSettings,
  getTournamentSubs,
  addTournamentSub,
  removeTournamentSub,
  updateTournamentTeams,
  getTeamSubs,
  getAllTeamSubsByTeam,
  addTeamSub,
  removeTeamSub,
  getPlayers,
  getPlayer,
  upsertPlayer,
  updatePlayerSalary,
  updatePlayerNotesAndSmurfing,
  updatePlayerDiscordUserId,
  assignPlayerToTeam,
  unassignPlayerFromTeam,
  deletePlayer,
  getSalaryForRank,
};
