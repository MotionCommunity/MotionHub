# Motion RL Discord Bot

Slash commands for match threads, replay timers, and (optionally) polling the Hub tournament sync API.

## Configure

1. Copy **`.env.example`** → **`.env`** in this folder.
2. Fill **TOKEN**, **CLIENT_ID**, **GUILD_ID**, **CHANNEL_***, **ROLE_STAFF** (registered / checked-in roles were removed).
3. Optional labels: **`MATCH_ROOM_1_LABEL`** / **`MATCH_ROOM_2_LABEL`** — two shared voice slots for all matchups.

IDs: Discord **Developer Mode** → right-click channel or role → **Copy ID**.

## Files

| File | Role |
|------|------|
| **`config.js`** | Loads `.env` → `channels`, `roles`, `labels`. |
| **`index.js`** | Bot login, slash registration, **15 min replay timer** (threads from `/match create` **or** pod text channels registered by the league site). |
| **`commands.js`** | `/match`, `/confirm`, `/dispute`. |
| **`schedule-poller.js`** | Polls tournament sync → `CHANNEL_MATCH_ANNOUNCE`. |

## Commands

- **`/match create`** — Ready-up in `CHANNEL_MATCH_ANNOUNCE`, thread under `CHANNEL_MATCH_RESULTS`. Pick **voice slot 1 or 2** (two shared VCs). Team pings use **Discord role names** matching `team1` / `team2` options (case-insensitive).
- **`/match close`** — In thread only; archives.
- **`/confirm`** / **`/dispute`** — In a match **thread** or a **pod replay text channel** registered via the site; confirm sends replays to `CHANNEL_PROCESSING_QUEUE` and pings `ROLE_STAFF`.

**Site:** Staff can use **Admin → Matches → Start match in Discord** with the same channel IDs as the bot (or **pod mode**: site creates text + voice under a category). For the **15‑minute replay timer** after the first `.replay` in that **thread or pod text channel**, set on the bot **`BOT_INTERNAL_SECRET`** (and optional **`BOT_HTTP_PORT`**), start the bot, then on the league site set **`MOTION_BOT_REGISTER_URL`** (e.g. `http://127.0.0.1:3849` locally, or your Railway URL) and **`MOTION_BOT_INTERNAL_SECRET`** to the **same** secret. The site POSTs to **`/internal/register-match-thread`** with **`channelId`** (or legacy **`threadId`**) so the channel is added to the same `matchTimers` map as `/match create`.

## Deploy

See **`DEPLOY-CLOUD.md`** and repo **`SETUP.md`**.
