# Step-by-step: Run MotionBot on Railway (with schedule)

Follow these steps so the bot runs 24/7 on **Railway** and posts match calls from the Motion Hub Schedule tab.

---

## Step 1. Notes API (sync URL)

You need one place that serves the tournament sync (and notes). If you already did this, skip to Step 2.

1. Go to [vercel.com](https://vercel.com) and sign in (e.g. with GitHub).
2. **Add New → Project** → import the repo that has **notes-api** (e.g. your MotionHub repo).
3. Set **Root Directory** to `hub-app/notes-api` (if the API lives there).
4. Add **Environment Variable**:
   - **Name:** `GITHUB_TOKEN`  
   - **Value:** A GitHub Personal Access Token with `repo` scope.
5. Deploy. Copy the URL Vercel gives you (e.g. `https://your-project-xyz.vercel.app`).  
   This is your **Sync URL**. Do **not** add a trailing slash.

---

## Step 2. Discord bot application and token

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) and sign in.
2. **New Application** → name it (e.g. Motion Bot) → **Create**.
3. Open **Bot** in the left sidebar → **Add Bot**.
4. Under **Token**, click **Reset Token** and copy the token. Save it somewhere safe (you’ll add it to Railway).
5. Under **Privileged Gateway Intents**, enable:
   - **Presence Intent** (optional)
   - **Server Members Intent**
   - **Message Content Intent**
6. Open **OAuth2 → URL Generator**:
   - **Scopes:** `bot`, `applications.commands`
   - **Bot Permissions:** Manage Channels, Send Messages, Embed Links, Attach Files, Read Message History, Add Reactions, Use Slash Commands, Manage Threads. For role pings: **Mention @everyone, @here, and All Roles**.
7. Copy the **Generated URL**, open it in a browser, choose your server, and authorize. The bot will appear in your server (offline until you deploy).

---

## Step 3. Get Discord IDs (channels and roles)

1. In Discord: **User Settings → App Settings → Advanced** → turn **Developer Mode** ON.
2. Right‑click your server name → **Copy Server ID** → this is **GUILD_ID**.
3. In [discord.com/developers/applications](https://discord.com/developers/applications), open your app → **General Information** → copy **Application ID** → this is **CLIENT_ID**.
4. For each channel you use:
   - Right‑click the channel (e.g. #match-announcements) → **Copy channel ID**.
   - Use these for: **CHANNEL_MATCH_ANNOUNCE**, **CHANNEL_MATCH_RESULTS**, **CHANNEL_PROCESSING_QUEUE**, **CHANNEL_STAFF_CHAT**.
5. For staff role:
   - **Server Settings → Roles** → right‑click the role → **Copy role ID** → **ROLE_STAFF**.

---

## Step 4. Put MotionBot on GitHub

MotionBot now lives inside MotionHub (`MotionHub/MotionBot/`). You can either push only the bot, or the whole repo.

**Option A — Push only the MotionBot folder (separate repo):**

1. Create a new repo on GitHub (e.g. `MotionBot`).
2. On your PC, in a terminal:

```bash
cd C:\Users\Halep\MotionHub\MotionBot
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/MotionBot.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username. Use a [Personal Access Token](https://github.com/settings/tokens) as the password if prompted.

**Option B — Push the whole MotionHub repo:**

If your MotionHub is already a GitHub repo:

1. Make sure `MotionBot/` is committed (and that `MotionBot/.env` is **not** in the repo — it should be in `.gitignore`).
2. Push to GitHub: `git add MotionBot && git commit -m "Add MotionBot" && git push`.

Then in Railway you’ll set the **Root Directory** to `MotionBot` so it only builds/runs the bot (see Step 5).

---

## Step 5. Deploy MotionBot to Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. **New Project** → **Deploy from GitHub repo**.
3. Select the repo:
   - If you used **Option A**, select **MotionBot**.
   - If you used **Option B**, select **MotionHub** and then set **Root Directory** to `MotionBot`.
4. In the project, open **Variables** (or **Settings → Variables**). Add **every** variable below. Replace placeholder values with your real IDs and token.

| Variable | Example / description |
|----------|------------------------|
| `TOKEN` | Your Discord bot token (Step 2) |
| `CLIENT_ID` | Application ID (Step 3) |
| `GUILD_ID` | Server ID (Step 3) |
| `CHANNEL_MATCH_ANNOUNCE` | Channel ID for match announcements (schedule calls post here too) |
| `CHANNEL_MATCH_RESULTS` | Channel ID for match result threads |
| `CHANNEL_PROCESSING_QUEUE` | Channel ID for processing queue |
| `CHANNEL_STAFF_CHAT` | Channel ID for staff chat |
| `ROLE_STAFF` | Staff role ID |
| **`TOURNAMENT_SYNC_URL`** | **Your Notes API URL from Step 1** (e.g. `https://your-project-xyz.vercel.app`) — **no trailing slash** |

5. Save. Railway will rebuild and redeploy. Open **Deployments** → latest deployment → **View Logs**. You should see:
   - `✅ Motion RL Bot is online as YourBot#1234`
   - `[Schedule] Polling https://... every 60 s` (if `TOURNAMENT_SYNC_URL` is set)

The bot is now running on Railway.

---

## Step 6. Sync URL in the Motion Hub (usually no action needed)

The Hub uses a **built-in default** sync URL (`https://motion-notes-api.vercel.app`). Notes and tournament sync (Schedule, bracket, etc.) work without any setup.

- **If you use the default API:** Do nothing. Open **Staff Notes** once and you’ll see the URL already set to the default.
- **If you use a different API:** In the Hub, open **Staff Notes** → change the **Notes & tournament sync URL** field to your API URL (same as **TOURNAMENT_SYNC_URL** in Railway) → **Save URL**.

Now the Hub and the bot both talk to the same API; schedule changes in the Hub are visible to the bot.

---

## Step 7. Test the schedule flow

1. In the Motion Hub, open **Tournament → Schedule**.
2. Click **Add scheduled match**. Fill in round, slot, team A, team B, and (optional) Discord role IDs for each team. Set a time or leave default.
3. Click **Start now** for that match.
4. Within about a minute, the bot should post in your **CHANNEL_MATCH_ANNOUNCE** channel with the match and role pings.
5. In Railway **Logs** you should see something like: `[Schedule] Called match sched-... TeamA vs TeamB`.

If that works, the Railway bot is fully set up for schedule calls.

---

## Quick checklist

| Step | Done |
|------|------|
| 1. Notes API on Vercel + Sync URL written down | ☐ |
| 2. Discord app created, bot token and intents set, bot invited | ☐ |
| 3. GUILD_ID, CLIENT_ID, channel IDs, role IDs copied | ☐ |
| 4. MotionBot pushed to GitHub | ☐ |
| 5. Railway project created, all variables added (including TOURNAMENT_SYNC_URL), bot online in logs | ☐ |
| 6. Hub Notes sync URL set to same as TOURNAMENT_SYNC_URL | ☐ |
| 7. Test: Start now in Hub → message in Discord | ☐ |

---

## Optional: Poll interval

By default the bot polls the sync API every **60 seconds**. To change it, add in Railway:

- **Name:** `POLL_INTERVAL_MS`  
- **Value:** e.g. `30000` (30 seconds) or `60000` (60 seconds)

Then redeploy.
