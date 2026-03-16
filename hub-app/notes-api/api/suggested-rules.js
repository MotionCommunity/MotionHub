// GET: return list of staff suggestions. POST: add a new suggestion (keeps last N).
const REPO = 'MotionCommunity/official-rules';
const BRANCH = 'main';
const FILE = 'suggested-rules.json';
const MAX_SUGGESTIONS = 30;
const API_BASE = `https://api.github.com/repos/${REPO}`;
const RAW_URL = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${FILE}`;

function getHeaders(token) {
  return {
    Accept: 'application/vnd.github.v3+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'Motion-Notes-API',
  };
}

function normalizeData(data) {
  if (Array.isArray(data.suggestions)) return data;
  if (data.html != null) {
    return {
      suggestions: [{
        id: String(Date.now()),
        submittedAt: data.submittedAt || new Date().toISOString(),
        submittedBy: data.submittedBy || '',
        html: data.html,
      }],
    };
  }
  return { suggestions: [] };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'GET') {
    try {
      const r = await fetch(RAW_URL);
      if (r.status === 404) return res.status(200).json({ list: [], items: [] });
      if (!r.ok) return res.status(r.status).json({ list: [], items: [], error: await r.text() });
      const text = await r.text();
      const data = normalizeData(JSON.parse(text || '{}'));
      const suggestions = (data.suggestions || []).slice(0, MAX_SUGGESTIONS);
      const list = suggestions.map((s) => ({ id: s.id, submittedAt: s.submittedAt, submittedBy: s.submittedBy || '' }));
      const items = suggestions.map((s) => ({ id: s.id, submittedAt: s.submittedAt, submittedBy: s.submittedBy || '', html: s.html || '' }));
      return res.status(200).json({ list, items });
    } catch (e) {
      return res.status(500).json({ list: [], items: [], error: e.message });
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
    const html = (body.html != null) ? String(body.html) : '';
    const submittedBy = (body.submittedBy != null) ? String(body.submittedBy).trim() : '';

    const headers = getHeaders(token);
    try {
      const getRes = await fetch(`${API_BASE}/contents/${FILE}?ref=${BRANCH}`, { headers });
      let sha;
      let suggestions = [];
      if (getRes.ok) {
        const json = await getRes.json();
        sha = json.sha;
        const decoded = Buffer.from(json.content || '', 'base64').toString('utf8');
        const data = normalizeData(JSON.parse(decoded || '{}'));
        suggestions = data.suggestions || [];
      }
      const newEntry = {
        id: String(Date.now()),
        submittedAt: new Date().toISOString(),
        submittedBy,
        html,
      };
      suggestions.unshift(newEntry);
      suggestions = suggestions.slice(0, MAX_SUGGESTIONS);
      const payload = { suggestions };
      const newContent = Buffer.from(JSON.stringify(payload, null, 2), 'utf8').toString('base64');
      const putBody = { message: 'Add suggested rules from Motion Hub', content: newContent, branch: BRANCH };
      if (sha) putBody.sha = sha;

      const putRes = await fetch(`${API_BASE}/contents/${FILE}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(putBody),
      });
      if (!putRes.ok) return res.status(putRes.status).json({ error: await putRes.text() });
      return res.status(200).json({ ok: true, id: newEntry.id });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
