// POST /api/note - append a note to local staff-notes.json
const FILE = 'staff-notes.json';
const { readJson, writeJson } = require('../lib/localStore');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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

  try {
    const data = await readJson(FILE, { notes: [] });
    if (!Array.isArray(data.notes)) data.notes = [];

    data.notes.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      topic,
      body: noteBody,
      createdAt,
    });

    await writeJson(FILE, data);

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
