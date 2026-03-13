// GET /api/notes - returns staff-notes.json from GitHub (no auth)
const REPO = 'MotionCommunity/official-rules';
const BRANCH = 'main';
const FILE = 'staff-notes.json';
const RAW_URL = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${FILE}`;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const r = await fetch(RAW_URL);
    if (r.status === 404) {
      return res.status(200).json({ notes: [] });
    }
    if (!r.ok) {
      return res.status(r.status).json({ error: 'Failed to fetch notes', notes: [] });
    }
    const data = await r.json();
    return res.status(200).json({ notes: Array.isArray(data.notes) ? data.notes : [] });
  } catch (e) {
    return res.status(500).json({ error: e.message, notes: [] });
  }
}
