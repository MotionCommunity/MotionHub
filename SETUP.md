# Motion setup — what you need to do

This checklist gets everything working so that:

- The **Discord bot** is always on (in the cloud).
- **Tournament data** (queue, verification, draft, staging) is **live** and **synced** to every Staff Hub and Master Hub — any edit made on one hub is visible to all.

---

## 1. Sync API (one place for all live data)

The **notes-api** project also serves **tournament sync**. When you deploy it, every hub that uses its URL will read and write the same data. No repo host is required beyond **GitHub** (for the API code and for storing the sync file) and **Vercel** (free) to run the API.

### 1.1 Deploy the API to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (e.g. with GitHub).
2. **Add New → Project** and import the repo that contains the **notes-api** (e.g. your MotionHub repo, with `hub-app/notes-api` as the root, or a repo that has the `notes-api` folder at the root).
   - If the API lives in `MotionHub/hub-app/notes-api`, in Vercel set **Root Directory** to `hub-app/notes-api`.
3. Add one **Environment Variable**:
   - **Name:** `GITHUB_TOKEN`  
   - **Value:** A GitHub Personal Access Token with `repo` scope (so the API can read/write `motion-tournament-sync.json` and other files in your `MotionCommunity/official-rules` repo).
4. Deploy. When it’s done, Vercel gives you a URL like `https://your-project-xyz.vercel.app`.  
   This is your **Sync URL**.

### 1.2 Use the same Sync URL everywhere

- In **every** Staff Hub and Master Hub install, go to **Staff Notes** and set **Notes sync URL** to that Vercel URL (e.g. `https://your-project-xyz.vercel.app`).
- Do **not** add a trailing slash.
- This single URL is used for:
  - Staff notes
  - Suggested rules
  - **Tournament sync** (queue, verified, draft snapshot, staging) — so all data is live and edits sync to all hubs.

Result: **Data is live at all times** because every hub talks to the same API; any edit is stored there and the next fetch on any hub shows it.

---

## 2. Discord bot (always on in the cloud)

So the bot runs 24/7 without your PC.

### 2.1 Put the bot code on GitHub

1. Create a new repo at [github.com/new](https://github.com/new) (e.g. `MotionBot`).
2. On your PC, in a terminal:

```bash
cd C:\Users\Halep\MotionBot
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/MotionBot.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username. Use a [Personal Access Token](https://github.com/settings/tokens) as the password if prompted.

### 2.2 Deploy the bot to Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. **New Project → Deploy from GitHub repo** → select **MotionBot**.
3. In the project, open **Variables** and add every variable from your `.env`:
   - `TOKEN` (Discord bot token)
   - `CLIENT_ID`
   - `GUILD_ID`
   - `CHANNEL_MATCH_ANNOUNCE`, `CHANNEL_MATCH_RESULTS`, `CHANNEL_PROCESSING_QUEUE`, `CHANNEL_STAFF_CHAT`
   - `ROLE_STAFF`
4. Railway will build and run the bot. In **Logs** you should see something like: `Motion RL Bot is online as …`.

You do **not** need to run the bot on your PC for production; the cloud instance keeps it online.

5. **League site (Vercel) + replay timer:** If you use **Admin → Matches → Start match in Discord** on the hosted site, set **`BOT_INTERNAL_SECRET`** on Railway (same value as **`MOTION_BOT_INTERNAL_SECRET`** on Vercel) and **`MOTION_BOT_REGISTER_URL`** on Vercel to your Railway service **public URL** (base only, e.g. `https://….up.railway.app`). See **`league-platform/docs/PRODUCTION-VERCEL-RAILWAY.md`**.

---

## 3. Staff Hub & Master Hub (same sync URL)

- **Build** the Staff and Master hubs as you normally do (e.g. from `hub-app` with `build-type.js` set to `'staff'` or `'master'`).
- **Distribute** the Staff build to your team.
- On **every** machine (Staff and Master):
  1. Open the hub.
  2. Go to **Staff Notes**.
  3. Set **Notes sync URL** to your Vercel API URL (from step 1).
  4. Click **Save sync URL**.

From then on:

- **Notes** and **suggested rules** sync through that URL.
- **Tournament sync** (queue, verified, draft, staging) uses the same URL, so all hubs see the same live data and any edit syncs to everyone.

---

## 4. Quick checklist

| Step | What to do |
|------|------------|
| 1 | Deploy **notes-api** (with tournament-sync) to **Vercel**; set **GITHUB_TOKEN**; note the Sync URL. |
| 2 | In **every** Staff Hub and Master Hub: set **Notes sync URL** to that Vercel URL. |
| 3 | Put **MotionBot** on **GitHub** (new repo, push code). |
| 4 | Deploy **MotionBot** to **Railway**; add all Discord env vars. |
| 5 | (Optional) In Master Hub, set **Tournament app** path and **Discord bot** path if you still want to run MotionRL or the bot locally for testing. |

---

## 5. How “live” and “sync” work

- **Sync URL** = your Vercel API base (e.g. `https://your-project.vercel.app`).
- The API stores tournament sync in the repo file **motion-tournament-sync.json** (same repo as notes/suggested-rules).
- **GET** `/api/tournament-sync` → any hub can read the latest state (queue, verified, draft, staging).
- **POST** `/api/tournament-sync` → any hub can update that state; the next GET from any hub sees the change.
- So: **all data is live** because it’s always read from/written to the same API, and **any edit syncs to all Staff and Master hubs** as soon as they load or refresh the sync data.

No need to run your computer at all times: the bot runs in the cloud, and the API runs on Vercel. You and your staff only need the hub open when you’re working, and you all see the same state.

---

## 6. Bracket config and per-round series format (Discord bot)

In **Motion Hub → Tournament → Bracket** you can set:

- **Default series format** (e.g. Bo3 for early rounds).
- **Per-round overrides** so that e.g. semi-finals are Bo5 and finals are Bo7.

When you click **Save format** or **Lock format**, the hub pushes the current format to the tournament-sync API as **bracketConfig**, so the Discord bot can GET `/api/tournament-sync` and use it.

- **bracketConfig** (object): `tournamentId`, `teamSize`, `seriesFormat`, `bracketType`, `roundSeriesFormats` (array of `{ round, seriesFormat }`), **teamConfig** (array of `{ name, discordRoleId }`), `updatedAt` (ISO). Round keys: `default`, `quarterfinals`, `semifinals`, `finals`.

**Team names and auto-roles:** In the Bracket tab you can add **team names** and optional **Discord role IDs**. When players are drafted to a team (their `DraftedToTeam` is set to that team name), the bot can assign the corresponding Discord role so they get pinged. **Subs** are in two places: **Tournament subs** (for the whole tournament; if they play in a replay they can be tracked on the stats page) and **subs per team** (subs for a specific team only). You can add tournament subs and team subs **after the tournament has started**.

**Auto-assign roles from the hub (no need to collect user IDs):** The registration form already collects **Discord username/handle**. When you push bracket config, the hub sends a **roster** with `discordUsername` (from the sheet) and `draftedToTeam`. The Discord bot can **GET** `/api/tournament-sync`, read **bracketConfig.teamConfig** (team name → role ID) and **bracketConfig.roster**, and auto-assign roles by **looking up each player in the guild by Discord username** and assigning the team’s role. So you don’t need to collect or store Discord user IDs—the bot uses the handle from the form. Optionally, the hub can store **Discord user ID** (Edit player) for edge cases where username lookup is ambiguous; the bot should prefer `discordUserId` when present, then fall back to resolving by `discordUsername`.

**Bot implementation (resolve by username):** For each roster entry with `draftedToTeam` set, get the role ID from `teamConfig`. If `discordUserId` is set, assign the role to that member by ID. Otherwise, find the guild member whose Discord username matches `discordUsername` (e.g. `guild.members.cache.find(m => m.user.username === value)` or compare `user.tag` / normalize format to match how the form stores it). Then assign the role to that member. If the form stores "username" without discriminator, match on `m.user.username`; you may need to trim and case-normalize.

**When the tournament is over (strip team roles):** When staff **Archive** the tournament in the hub, the hub pushes a **stripRolesRequest** to the sync API: `{ at: ISO, roster, teamConfig }`. The Discord bot should **GET** sync, and if **stripRolesRequest** is present: for each roster entry with `draftedToTeam` set, find the guild member (by `discordUserId` or `discordUsername`), find the role ID from `teamConfig` for that team name, and **remove** that role from the member. After stripping, the bot should **POST** back to the sync API with **stripRolesRequest: null** (or omit it so it stays until overwritten) to clear the request so it doesn’t strip again. That way team roles are freed for the next tournament.

**Override when format is locked:** You can still change the format (e.g. switch finals to Bo7) after locking. Click **Save format**; the hub will show **“Format is locked. Are you sure you want to override and change the format? The Discord bot will be updated with the new settings.”** Confirm to apply the change and push the new config to the bot.

When implementing in the bot: for a given match, determine its round (e.g. from bracket position or round index). Look up that round in `bracketConfig.roundSeriesFormats`; if found, use that `seriesFormat`; otherwise use `bracketConfig.seriesFormat`.

---

## 7. Match results: .replays + /confirm → Motion Hub

When players post `.replay` files in Discord and the **loser** runs **/confirm**, the Discord bot should record the result and push it so **Motion Hub** shows it and staff can override or mark for replay if needed.

### Sync API: `matchResults`

The tournament-sync API stores a **matchResults** array. Each item should look like:

- **id** (string) — Unique match id (e.g. from the bot’s bracket or channel id).
- **tournamentId** (number, optional) — Hub’s active tournament id so the hub can filter; bot can omit or set from config.
- **round** (string) — e.g. `"quarterfinals"`, `"semifinals"`, `"finals"`.
- **matchSlot** (string) — e.g. `"1"`, `"QF1"`.
- **teamA**, **teamB** (objects) — At least `{ name: "Team name" }`; can add `playerIds`, `discordRoleId` for stats later.
- **winner** (`"A"` \| `"B"` \| null) — Who won; null if pending.
- **score** (string) — e.g. `"3-1"`.
- **gamesPlayed** (number) — How many games were actually played (from .replay count).
- **status** (`"pending"` \| `"confirmed"` \| `"disputed"` \| `"overridden"` \| `"replay"`).
- **overrideNote** (string, optional) — Staff note when overridden.
- **lastUpdated** (string, ISO date).

### Bot flow

1. When a match is created (bracket generated), the bot knows **teamA** and **teamB** (and which Discord side is which).
2. Players post `.replay` files in the match thread; the bot counts them as **gamesPlayed**.
3. When the **loser** runs **/confirm**, the bot sets **winner** (the other team), **score** (e.g. from gamesPlayed), **status** `"confirmed"`, and **lastUpdated**.
4. Bot **GET**s `/api/tournament-sync`, appends or updates the match in **matchResults** (by **id**), then **POST**s the full payload back. Same sync URL as notes; use the same auth/env as for other tournament sync.

### Motion Hub: Match results tab

- **Tournament → Match results** shows all results (filtered by active tournament if **tournamentId** is set).
- **Override**: change winner, score, games played, or set status to **disputed** / **overridden** / **replay**, plus a staff note. Saves to the sync API so the bot and other hubs see the change.
- **Replay**: one-click sets status to **replay** so the match can be replayed (e.g. not enough games or dispute). Staff can later override again to **confirmed** with the correct result after the replay.

### Replay parsing (boxcars)

The hub uses **boxcars** (Rust) to parse Rocket League `.replay` files for full data (goals, demolitions, frames, player stats, etc.) instead of rrrocket. This gives you more data for stats and match results.

1. **Build the parser** (one-time, requires [Rust](https://rustup.rs/) — install from [rustup.rs](https://rustup.rs/) if you don’t have `cargo`):
   - **Windows:** When rustup asks for “Visual C++ prerequisites”, choose **option 1** (Quick install via Visual Studio installer) so the C++ build tools are installed. Then close and reopen your terminal.
   - From the **hub-app** folder (e.g. `C:\Users\Halep\MotionHub\hub-app`):
   ```bash
   cd replay-parser-boxcars
   cargo build --release
   ```
   The binary is at `hub-app/replay-parser-boxcars/target/release/motion_replay_parse.exe` (Windows) or `motion_replay_parse` (Mac/Linux).

2. **Optional:** In hub config you can set **replayParserPath** to a custom executable (e.g. a different boxcars-based CLI). If unset, the hub uses the built binary above.

3. **From code:** Use `replay:parse` IPC with a replay file path; you get the full boxcars JSON (header + network_frames). Use `replay:getParserPath` to check if the parser is available.

---

## 8. Match schedule: call matches and start from Hub or Discord

Motion Hub has a **Schedule** tab so staff can schedule when matches are **called** (bot pings teams and directs players to the match channel / voice). Matches can be started at the scheduled time, or **Start now** from the hub, or via a Discord command (e.g. `/start-match`).

### Sync API: `scheduledMatches`

The tournament-sync API stores a **scheduledMatches** array. Each item:

- **id** (string) — Unique id (hub generates e.g. `sched-1234567890-abc123`).
- **tournamentId** (number, optional) — Active tournament id for filtering in the hub.
- **round** (string) — e.g. `"Quarter-finals"`, `"Semi-finals"`.
- **matchSlot** (string) — e.g. `"1"`, `"QF1"`.
- **teamA**, **teamB** (objects) — `{ name: "Team name", discordRoleId?: "role id" }`. Names are used in the call message; **discordRoleId** is used by the bot to @ping that team’s role.
- **startAt** (string, ISO) — When the match is scheduled to be called.
- **status** (`"scheduled"` \| `"calling"` \| `"live"` \| `"completed"`).
- **startRequestedAt** (string, ISO, optional) — Set when staff click **Start now** in the hub or run `/start-match` in Discord; tells the bot to call the match immediately.
- **discordChannelId** (string, optional) — Discord channel id for the match thread (bot can set this when it creates the channel).
- **createdAt**, **lastUpdated** (string, ISO).

### Motion Hub: Schedule tab

- **Tournament → Schedule**: list of scheduled matches (Round, Slot, Team A, Team B, Scheduled time, Status). **Add scheduled match** opens a form: round, slot, team A name, team B name, date/time, optional Discord role IDs for each team. **Start now** sets `status` to `calling` and `startRequestedAt` to now, then POSTs to the sync API so the bot reacts. **Edit** / **Remove** update or delete the schedule entry.

### Discord bot behavior

1. **Poll** (e.g. every minute): GET `/api/tournament-sync`. For each entry in **scheduledMatches**:
   - If **startAt** ≤ now and **status** is `scheduled`, or **status** is `calling`, or **startRequestedAt** is set: treat as “call this match now”.
2. **Call the match**: In the match channel (or use **discordChannelId** if present), post a message that:
   - Names the match (e.g. “Match: Team Alpha vs Team Bravo”).
   - Pings the two teams (using **teamA.discordRoleId** and **teamB.discordRoleId** if set, e.g. `<@&roleId>`).
   - Tells players to join their voice channel and/or type in the match lobby.
3. After posting, update that schedule entry: set **status** to `live` (or `calling` → `live`), clear **startRequestedAt** if you use it as a one-shot trigger, and POST the updated **scheduledMatches** back so the hub and other clients stay in sync.
4. **Start from Discord**: Implement a slash command (e.g. `/start-match`) that lets staff pick a scheduled match (e.g. by round/slot or from a list). The command sets **startRequestedAt** (and optionally **status** to `calling`) for that match and POSTs to the sync API, then the bot’s poll logic (or the same handler) runs the “call the match” flow so the match is started from Discord as well.
