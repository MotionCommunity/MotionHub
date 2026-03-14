# Motion Hub – Notes Sync API

This small backend lets staff hubs **send** notes and the master hub **read** them, without staff needing GitHub.

- **POST /api/note** – Append a note (body: `{ "topic", "body", "createdAt" }`). Writes to `staff-notes.json` in the `MotionCommunity/official-rules` repo.
- **GET /api/notes** – Return all synced notes (from that file). No auth.
- **POST /api/suggested-rules** – Save suggested rules HTML from staff (body: `{ "html" }`). Writes to `suggested-rules.json` in the same repo.
- **GET /api/suggested-rules** – Return the latest suggested rules HTML (for master to load and publish). No auth.
- **POST /api/suggested-stats** – Save suggested stats HTML from staff (body: `{ "html" }`). Writes to `suggested-stats.json` in `MotionCommunity/stats`.
- **GET /api/suggested-stats** – Return the latest suggested stats HTML (for master to load and publish). No auth.

## Deploy once (e.g. Vercel)

1. Install Vercel CLI: `npm i -g vercel`
2. Go to this folder: `cd hub-app/notes-api`
3. Run: `vercel` and follow the prompts (link to your Vercel account).
4. In Vercel dashboard → Project → **Settings → Environment Variables**, add:
   - **Name:** `GITHUB_TOKEN`  
   - **Value:** a GitHub Personal Access Token with scope **repo** (or at least **public_repo** and write to `MotionCommunity/official-rules` and `MotionCommunity/stats`).

5. Redeploy so the env var is picked up (e.g. **Deployments** → … → **Redeploy**).

You’ll get a URL like `https://notes-api-xxx.vercel.app`.

## Use in the hub

- **Staff:** In the hub, open **Staff Notes** → set **Notes sync URL** to that URL (e.g. `https://notes-api-xxx.vercel.app`) → **Save sync URL**. From then on, when they click **Save Note**, the note is stored locally and sent to this API (and into the repo).
- **Master:** Set the same **Notes sync URL** in your hub. Use **Load synced notes** to fetch and review all staff notes.

The file `staff-notes.json` will be created in the repo on the first submitted note.

---

## Stats API setup (Submit suggested changes / Load staff suggestion)

The **suggested-stats** endpoints let staff submit stats edits and master load them, same pattern as suggested-rules but for the **MotionCommunity/stats** repo.

### 1. Deploy the notes-api (includes stats)

The stats API is part of this same notes-api. Deploy once; it serves both rules and stats.

1. **From the repo root:**  
   `cd hub-app/notes-api`

2. **Deploy to Vercel:**  
   `npx vercel` (or `vercel` if you have the CLI). Log in if needed and link/create the project.

3. **Add GitHub token** in Vercel:  
   **Project → Settings → Environment Variables**
   - **Name:** `GITHUB_TOKEN`
   - **Value:** A [GitHub Personal Access Token](https://github.com/settings/tokens) with:
     - Scope **repo** (or at least access to the repos you use)
     - Write access to **MotionCommunity/stats** (and **MotionCommunity/official-rules** if you use suggested-rules)
   - Apply to **Production** (and Preview if you use it).

4. **Redeploy** so the env var is used:  
   **Deployments** → latest deployment → **⋯** → **Redeploy**.

You’ll get a URL like `https://your-notes-api.vercel.app`.

### 2. Use in Motion Hub

1. In the hub, open **Staff Notes** (or wherever **Notes sync URL** is set).
2. Set **Notes sync URL** to your deployed API URL, e.g. `https://your-notes-api.vercel.app`.
3. Click **Save sync URL**.

After that:

- **Tournament Stats → Easy Edit → Submit suggested changes** → POSTs to `/api/suggested-stats` and stores HTML in `suggested-stats.json` in **MotionCommunity/stats**.
- **Load staff suggestion** → GETs from `/api/suggested-stats` and fills the editor.

### 3. If you already had the notes-api deployed

If you deployed before `api/suggested-stats.js` existed:

1. Pull the latest code (so `hub-app/notes-api/api/suggested-stats.js` is present).
2. Redeploy the same Vercel project (`vercel --prod` or push to the linked Git branch).
3. Ensure `GITHUB_TOKEN` has write access to **MotionCommunity/stats**.
4. Redeploy again if you changed the env var.

No separate “stats API” project is needed; it’s the same notes-api with the extra `/api/suggested-stats` route.
