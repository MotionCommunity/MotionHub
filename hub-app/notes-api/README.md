# Motion Hub – Notes Sync API

This small backend lets staff hubs **send** notes and the master hub **read** them, without staff needing GitHub.

- **POST /api/note** – Append a note (body: `{ "topic", "body", "createdAt" }`). Writes to `staff-notes.json` in the `MotionCommunity/official-rules` repo.
- **GET /api/notes** – Return all synced notes (from that file). No auth.
- **POST /api/suggested-rules** – Save suggested rules HTML from staff (body: `{ "html" }`). Writes to `suggested-rules.json` in the same repo.
- **GET /api/suggested-rules** – Return the latest suggested rules HTML (for master to load and publish). No auth.

## Deploy once (e.g. Vercel)

1. Install Vercel CLI: `npm i -g vercel`
2. Go to this folder: `cd hub-app/notes-api`
3. Run: `vercel` and follow the prompts (link to your Vercel account).
4. In Vercel dashboard → Project → **Settings → Environment Variables**, add:
   - **Name:** `GITHUB_TOKEN`  
   - **Value:** a GitHub Personal Access Token with scope **repo** (or at least **public_repo** and write to `MotionCommunity/official-rules`).

5. Redeploy so the env var is picked up (e.g. **Deployments** → … → **Redeploy**).

You’ll get a URL like `https://notes-api-xxx.vercel.app`.

## Use in the hub

- **Staff:** In the hub, open **Staff Notes** → set **Notes sync URL** to that URL (e.g. `https://notes-api-xxx.vercel.app`) → **Save sync URL**. From then on, when they click **Save Note**, the note is stored locally and sent to this API (and into the repo).
- **Master:** Set the same **Notes sync URL** in your hub. Use **Load synced notes** to fetch and review all staff notes.

The file `staff-notes.json` will be created in the repo on the first submitted note.
