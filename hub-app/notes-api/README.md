# Motion Hub - Notes Sync API (GitHub-free)

This backend is now **GitHub-free**.  
All sync data is stored as local JSON files on your server.

## Endpoints

- `POST /api/note` - Append note `{ topic, body, createdAt }`
- `GET /api/notes` - Read all notes
- `POST /api/suggested-rules` - Save rules suggestion `{ html, submittedBy }`
- `GET /api/suggested-rules` - List/load rules suggestions
- `POST /api/suggested-stats` - Save stats suggestion `{ html, submittedBy }`
- `GET /api/suggested-stats` - List/load stats suggestions
- `POST /api/suggested-bracket` - Save bracket suggestion `{ bracketDraft, submittedBy }`
- `GET /api/suggested-bracket` - List/load bracket suggestions
- `GET /api/tournament-sync` - Read tournament sync state
- `POST /api/tournament-sync` - Update tournament sync state

## Data storage

By default, files are written to:

- `hub-app/notes-api/data/`

You can override with env var:

- `NOTES_DATA_DIR=/absolute/path/to/persistent/data`

For Docker/production, mount this path as a persistent volume.

## Deploy/use

### DigitalOcean + Docker (recommended)

1. From your Windows PC, run `deploy.bat` in the `MotionHub` root.
2. On first run, ensure SSH key auth is set up (the batch script checks this).
3. In Cloudflare DNS, add:
   - `A` record: `sync` -> your server IP
   - Start with **DNS only** (gray cloud) so origin certificate issuance works.
4. Verify:
   - `https://sync.motioncommunity.gg/health`
5. In Motion Hub, set **Notes sync URL** to:
   - `https://sync.motioncommunity.gg`

### Manual fallback

You can also deploy this API manually on any Node/Docker host and point Hub to that base URL.

## Notes

- Existing GitHub-based payload formats are preserved for compatibility.
- If you previously relied on GitHub repo history, use regular backups of the data directory instead.
