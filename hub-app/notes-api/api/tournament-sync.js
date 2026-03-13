// GET: return current tournament sync state (live for all Staff + Master hubs).
// POST: update state (any hub can push; everyone reads the same data).
// Storage: motion-tournament-sync.json in the same GitHub repo as notes.
const REPO = 'MotionCommunity/official-rules';
const BRANCH = 'main';
const FILE = 'motion-tournament-sync.json';
const API_BASE = `https://api.github.com/repos/${REPO}`;
const RAW_URL = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${FILE}`;

const DEFAULT_STATE = {
  queue: [],
  verified: [],
  draftSnapshot: null,
  stagingApproved: [],
  lastUpdated: null,
};

function getHeaders(token) {
  return {
    Accept: 'application/vnd.github.v3+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'Motion-Tournament-Sync-API',
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'GET') {
    try {
      const r = await fetch(RAW_URL);
      if (r.status === 404) return res.status(200).json(DEFAULT_STATE);
      if (!r.ok) return res.status(r.status).json({ ...DEFAULT_STATE, error: await r.text() });
      const data = await r.json();
      return res.status(200).json({
        queue: Array.isArray(data.queue) ? data.queue : DEFAULT_STATE.queue,
        verified: Array.isArray(data.verified) ? data.verified : DEFAULT_STATE.verified,
        draftSnapshot: data.draftSnapshot ?? DEFAULT_STATE.draftSnapshot,
        stagingApproved: Array.isArray(data.stagingApproved) ? data.stagingApproved : DEFAULT_STATE.stagingApproved,
        lastUpdated: data.lastUpdated ?? DEFAULT_STATE.lastUpdated,
      });
    } catch (e) {
      return res.status(500).json({ ...DEFAULT_STATE, error: e.message });
    }
  }

  if (req.method === 'POST') {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return res.status(500).json({ error: 'Server missing GITHUB_TOKEN' });

    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    const headers = getHeaders(token);
    try {
      const getRes = await fetch(`${API_BASE}/contents/${FILE}?ref=${BRANCH}`, { headers });
      let sha;
      let current = { ...DEFAULT_STATE };
      if (getRes.ok) {
        const json = await getRes.json();
        sha = json.sha;
        try {
          current = JSON.parse(Buffer.from(json.content, 'base64').toString('utf8'));
        } catch (_) {}
      }
      if (!Array.isArray(current.queue)) current.queue = [];
      if (!Array.isArray(current.verified)) current.verified = [];
      if (!Array.isArray(current.stagingApproved)) current.stagingApproved = [];

      const next = {
        queue: Array.isArray(body.queue) ? body.queue : current.queue,
        verified: Array.isArray(body.verified) ? body.verified : current.verified,
        draftSnapshot: body.draftSnapshot !== undefined ? body.draftSnapshot : current.draftSnapshot,
        stagingApproved: Array.isArray(body.stagingApproved) ? body.stagingApproved : current.stagingApproved,
        lastUpdated: new Date().toISOString(),
      };

      const newContent = Buffer.from(JSON.stringify(next, null, 2), 'utf8').toString('base64');
      const putBody = { message: 'Update tournament sync from Motion Hub', content: newContent, branch: BRANCH };
      if (sha) putBody.sha = sha;

      const putRes = await fetch(`${API_BASE}/contents/${FILE}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(putBody),
      });
      if (!putRes.ok) return res.status(putRes.status).json({ error: await putRes.text() });
      return res.status(200).json({ ok: true, lastUpdated: next.lastUpdated });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
