# Motion League Platform

Initial scaffold for league data services and public analytics.

## Workspace layout

- `apps/league-api` - REST API for league data
- `apps/league-worker` - replay ingest and background jobs
- `apps/league-site` - public web app (to be scaffolded in Phase 2)
- `packages/db` - Prisma schema and DB client package
- `packages/shared-types` - shared DTO/types
- `packages/replay-parser-client` - wrapper around replay parser binary
- `infra` - local infrastructure (Postgres/Redis/MinIO)

## Quick start

1. Install dependencies
   - `npm install`
2. Start local infra
   - `docker compose -f infra/docker-compose.yml up -d`
3. Generate Prisma client
   - `npm run db:generate`
4. Run dev services
   - API: `npm run dev:api`
   - Worker: `npm run dev:worker`

## Simple Windows workflow

If you want a one-click flow (recommended):

1. Double-click `run-local.cmd`
   - Starts Docker services (Postgres/Redis/MinIO)
   - Ensures npm deps are installed
   - Runs Prisma `db push`
   - Opens API + Worker terminals
2. Double-click `open-studio.cmd` (optional)
   - Opens Prisma Studio (DB browser)
3. Drag one or more `.replay` files onto `ingest-replay.cmd`
   - Queues replay ingest
   - Prevents duplicate replay ingestion (SHA/path dedupe)
   - Shows replay id
   - Polls parse status (`parsed` / `failed`) with reason
   - Prints a post-parse validation summary (missing variables / suspicious zeroed frame stats)
4. Review recently added replays before posting
   - Double-click `review-recent.cmd`
   - Optional args: `review-recent.cmd 15 parsed today` (limit + status + since)
   - Status filter values: `parsed`, `pending`, `failed`, `all`
   - Since filter values: `today` or ISO datetime (example `2026-03-19T00:00:00Z`)
   - Prints recent replay rows and a compact per-player stats preview
5. Double-click `stop-local.cmd` when done
   - Stops Docker containers

## Cloud deploy (no PC required)

- **league-site** → **Vercel**; **Motion bot** → **Railway**; set `MOTION_BOT_REGISTER_URL` to your Railway URL. See **`docs/PRODUCTION-VERCEL-RAILWAY.md`**.
- **Discord channels + env mapping:** **`docs/DISCORD-SERVER-PLAYBOOK.md`**

## Discord teams & channels

- **Admin → Teams** (in `league-site`): per-tournament teams with **Discord role ID**, **text channel ID**, and **voice channel ID** stored in the database. Edit any row and click **Save** on that row.
- **Admin → Matches**: pick teams from the dropdown; use **Apply saved roles from teams** to copy role IDs from Teams into the match check-in fields.
- Server-side channel permissions (only team roles see their channels) are configured in Discord; see `docs/discord-team-channels.md`.

## Replays → database (stats)

- **Admin → Matches → Games & .replays**: add a **game** row per map, then upload the `.replay`. The worker parses it and stores stats in Postgres for that game.
- Set **`REPLAY_UPLOADS_DIR`** to the same absolute folder on `league-site` and `league-worker`. See `docs/replay-ingest.md`.

## Notes

- This is the Phase 1 starter structure.
- `apps/league-site` is intentionally a placeholder and can be scaffolded with Next.js later.
