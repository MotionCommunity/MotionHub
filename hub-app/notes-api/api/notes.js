// GET /api/notes - returns local staff-notes.json
const FILE = 'staff-notes.json';
const { readJson } = require('../lib/localStore');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const data = await readJson(FILE, { notes: [] });
    return res.status(200).json({ notes: Array.isArray(data.notes) ? data.notes : [] });
  } catch (e) {
    return res.status(500).json({ error: e.message, notes: [] });
  }
}
