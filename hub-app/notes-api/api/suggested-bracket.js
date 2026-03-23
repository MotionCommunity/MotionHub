// GET: return list of staff bracket suggestions. POST: add a new suggestion (keeps last N).
// Local storage (no GitHub dependency).
const FILE = 'suggested-bracket.json';
const MAX_SUGGESTIONS = 30;
const { readJson, writeJson } = require('../lib/localStore');

function normalizeData(data) {
  if (Array.isArray(data.suggestions)) return data;
  if (data.bracketDraft != null) {
    return {
      suggestions: [{
        id: String(Date.now()),
        submittedAt: data.submittedAt || new Date().toISOString(),
        submittedBy: data.submittedBy || '',
        bracketDraft: data.bracketDraft,
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
      const data = normalizeData(await readJson(FILE, { suggestions: [] }));
      const suggestions = (data.suggestions || []).slice(0, MAX_SUGGESTIONS);
      const list = suggestions.map((s) => ({ id: s.id, submittedAt: s.submittedAt, submittedBy: s.submittedBy || '' }));
      const items = suggestions.map((s) => ({ id: s.id, submittedAt: s.submittedAt, submittedBy: s.submittedBy || '', bracketDraft: s.bracketDraft ?? null }));
      return res.status(200).json({ list, items });
    } catch (e) {
      return res.status(500).json({ list: [], items: [], error: e.message });
    }
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
    const bracketDraft = body.bracketDraft != null ? body.bracketDraft : null;
    const submittedBy = (body.submittedBy != null) ? String(body.submittedBy).trim() : '';

    try {
      const data = normalizeData(await readJson(FILE, { suggestions: [] }));
      let suggestions = data.suggestions || [];
      const newEntry = {
        id: String(Date.now()),
        submittedAt: new Date().toISOString(),
        submittedBy,
        bracketDraft,
      };
      suggestions.unshift(newEntry);
      suggestions = suggestions.slice(0, MAX_SUGGESTIONS);
      await writeJson(FILE, { suggestions });
      return res.status(200).json({ ok: true, id: newEntry.id });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
