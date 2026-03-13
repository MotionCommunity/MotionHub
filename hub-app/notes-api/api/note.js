// POST /api/note - append a note to staff-notes.json in GitHub (uses GITHUB_TOKEN)
const REPO = 'MotionCommunity/official-rules';
const BRANCH = 'main';
const FILE = 'staff-notes.json';
const API_BASE = `https://api.github.com/repos/${REPO}`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Server missing GITHUB_TOKEN' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const topic = (body.topic || '').toString().trim();
  const noteBody = (body.body || '').toString().trim();
  const createdAt = body.createdAt || new Date().toISOString();

  if (!topic || !noteBody) {
    return res.status(400).json({ error: 'topic and body required' });
  }

  const headers = {
    Accept: 'application/vnd.github.v3+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'Motion-Notes-API',
  };

  try {
    const getRes = await fetch(`${API_BASE}/contents/${FILE}?ref=${BRANCH}`, { headers });
    let content;
    let sha;

    if (getRes.ok) {
      const json = await getRes.json();
      content = Buffer.from(json.content, 'base64').toString('utf8');
      sha = json.sha;
    } else if (getRes.status === 404) {
      content = JSON.stringify({ notes: [] }, null, 2);
      sha = undefined;
    } else {
      const err = await getRes.text();
      return res.status(getRes.status).json({ error: err || 'Failed to get file' });
    }

    let data;
    try {
      data = JSON.parse(content);
    } catch {
      data = { notes: [] };
    }
    if (!Array.isArray(data.notes)) data.notes = [];

    data.notes.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      topic,
      body: noteBody,
      createdAt,
    });

    const newContent = Buffer.from(JSON.stringify(data, null, 2), 'utf8').toString('base64');
    const putBody = {
      message: 'Add staff note from Motion Hub',
      content: newContent,
      branch: BRANCH,
    };
    if (sha) putBody.sha = sha;

    const putRes = await fetch(`${API_BASE}/contents/${FILE}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(putBody),
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      return res.status(putRes.status).json({ error: errText || 'Failed to update file' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
