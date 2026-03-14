// GET: return latest suggested stats HTML. POST: save suggested stats (overwrites).
// Same sync pattern as suggested-rules; uses MotionCommunity/stats repo.
const REPO = 'MotionCommunity/stats';
const BRANCH = 'main';
const FILE = 'suggested-stats.json';
const API_BASE = `https://api.github.com/repos/${REPO}`;
const RAW_URL = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${FILE}`;

function getHeaders(token) {
  return {
    Accept: 'application/vnd.github.v3+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'Motion-Notes-API',
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'GET') {
    try {
      const r = await fetch(RAW_URL);
      if (r.status === 404) return res.status(200).json({ html: '' });
      if (!r.ok) return res.status(r.status).json({ html: '', error: await r.text() });
      const text = await r.text();
      const data = JSON.parse(text || '{}');
      return res.status(200).json({ html: data.html || '' });
    } catch (e) {
      return res.status(500).json({ html: '', error: e.message });
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

    const headers = getHeaders(token);
    try {
      const getRes = await fetch(`${API_BASE}/contents/${FILE}?ref=${BRANCH}`, { headers });
      let sha;
      if (getRes.ok) {
        const json = await getRes.json();
        sha = json.sha;
      }
      const payload = { html, submittedAt: new Date().toISOString() };
      const newContent = Buffer.from(JSON.stringify(payload, null, 2), 'utf8').toString('base64');
      const putBody = { message: 'Update suggested stats from Motion Hub', content: newContent, branch: BRANCH };
      if (sha) putBody.sha = sha;

      const putRes = await fetch(`${API_BASE}/contents/${FILE}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(putBody),
      });
      if (!putRes.ok) return res.status(putRes.status).json({ error: await putRes.text() });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
