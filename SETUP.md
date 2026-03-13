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
   - `ROLE_STAFF`, `ROLE_REGISTERED`, `ROLE_CHECKED_IN`
4. Railway will build and run the bot. In **Logs** you should see something like: `Motion RL Bot is online as …`.

You do **not** need to run the bot on your PC for production; the cloud instance keeps it online.

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
