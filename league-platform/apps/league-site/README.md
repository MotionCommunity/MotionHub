# Motion Community Site (`league-site`)

Next.js app for public pages + staff portal.

## Production (Vercel + Railway — PC not required)

Deploy **league-site** to **Vercel** and run the **Motion bot** on **Railway**. Configure `MOTION_BOT_REGISTER_URL` to your **Railway app URL** (not `localhost`) and share the same `BOT_INTERNAL_SECRET` / `MOTION_BOT_INTERNAL_SECRET` between them.

See **`../../docs/PRODUCTION-VERCEL-RAILWAY.md`** for the full checklist (sync API vs league site vs bot).

## Local dev

```bash
npm run dev
```

Open `http://localhost:3000`.

## Discord OAuth setup

Copy `.env.local.example` to `.env.local` and fill:

- `NEXT_PUBLIC_APP_URL`
- `LEAGUE_API_BASE_URL`
- `AUTH_SESSION_SECRET`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`
- `DISCORD_GUILD_ID`
- `DISCORD_BOT_TOKEN`
- `DISCORD_ROLE_FOUNDER_ID`
- `DISCORD_ROLE_STAFF_ID`
- `DISCORD_ROLE_PARTNER_ID`
- `DISCORD_TEAM_ROLE_OPTIONS` (optional JSON for match role dropdowns)
- `PLAYERS_SHEET_ID` (private Google Sheet ID)
- `PLAYERS_SHEET_RANGE` (default: `Form Responses 1!A:Z`)
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_TOKEN_URI` (default: `https://oauth2.googleapis.com/token`)
- `PLAYERS_SHEET_CSV_URL` (optional fallback, published CSV URL)
- `PLAYERS_SHEET_IGN_COLUMN` (default: `ign`)
- `PLAYERS_SHEET_REGION_COLUMN` (default: `region`)
- `PLAYERS_SHEET_DISCORD_USERNAME_COLUMN` (default: `discordUsername`)
- `PLAYERS_SHEET_DISCORD_USER_ID_COLUMN` (default: `discordUserId`)
- `PLAYERS_SHEET_EPIC_GAMES_ID_COLUMN` (default: `epicGamesId`)
- `PLAYERS_SHEET_TRACKER_URL_COLUMN` (default: `trackerUrl`)
- `PLAYERS_SHEET_VALIDATION_COLUMN` (default: `validation`)
- `PLAYERS_SHEET_ONLY_APPROVED` (default: `true`)
- `PLAYERS_SHEET_PRUNE_NON_APPROVED` (default: `true`)

### Required redirect URI in Discord app

Set Discord OAuth redirect URI to:

- `http://localhost:3000/api/auth/callback` (dev)
- your production URL `/api/auth/callback` later

## Auth routes

- `/login` - Discord login entry
- `/api/auth/login`
- `/api/auth/callback`
- `/api/auth/logout`
- `/api/auth/me`
- `/unauthorized`

`/admin/*` routes are protected by proxy role checks (Founder/Staff allowed).

## Google Sheet player sync

Private mode (recommended):
1. Create a Google Cloud service account with Sheets read access.
2. Share the Google Sheet with that service account email as Viewer.
3. Set `PLAYERS_SHEET_ID`, `PLAYERS_SHEET_RANGE`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`.
4. In `/admin/players`, click `Sync From Google Sheet`.

Fallback mode (not private):
1. Publish the sheet tab as CSV and set `PLAYERS_SHEET_CSV_URL`.

Sync upserts by IGN:
- new IGN -> creates player
- existing IGN -> updates region/discord fields
- non-approved / not-in-sheet players -> removed when prune is enabled

Notes:
- Header matching is flexible (spaces/case are ignored), so `Discord Username` and `discordUsername` both work.
- If `PLAYERS_SHEET_ONLY_APPROVED=true`, only rows marked approved in the validation/status column are synced.
