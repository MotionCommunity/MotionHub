const express = require('express');
const { dataDir } = require('./lib/localStore');

const app = express();
const port = Number(process.env.PORT || 4001);

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  return next();
});

app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'motion-notes-api',
    dataDir: dataDir(),
    timestamp: new Date().toISOString(),
  });
});

const routes = [
  ['/api/notes', require('./api/notes')],
  ['/api/note', require('./api/note')],
  ['/api/suggested-rules', require('./api/suggested-rules')],
  ['/api/suggested-stats', require('./api/suggested-stats')],
  ['/api/suggested-bracket', require('./api/suggested-bracket')],
  ['/api/tournament-sync', require('./api/tournament-sync')],
];

for (const [routePath, handler] of routes) {
  app.all(routePath, async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      res.status(500).json({ error: err?.message || 'Unhandled server error' });
    }
  });
}

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`motion-notes-api listening on ${port}`);
});

