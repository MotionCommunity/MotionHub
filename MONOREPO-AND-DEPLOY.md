# One repo for everything (monorepo)

This workspace is designed to live in **a single GitHub repository**: league platform, Discord bot, Hub app, and notes API can all share code, docs, and versioning.

## What goes in the repo

| Folder | What it is | Typical cloud target |
|--------|------------|----------------------|
| **`league-platform/`** | API, site, worker, Prisma (`packages/db`) | Vercel (site), Railway/Fly (API + worker), managed Postgres |
| **`MotionBot/`** | Discord bot (Node) | **Railway** (24/7 process + replay timer HTTP) |
| **`hub-app/`** | Electron Staff/Master Hub | Built locally or in CI; not usually “hosted” |
| **`hub-app/notes-api/`** | Small sync API (Vercel serverless) | **Vercel** (set **Root Directory** = `hub-app/notes-api`) |

Secrets (**`.env`**, tokens) are **never** committed — set them in Vercel / Railway / Neon dashboards.

**Variable names only (no secrets):** see the repo root **`.env.example`**. Copy the sections you need into each service’s dashboard or local `.env`.

## Should I create a new GitHub repo?

**Yes, if** you want a clean history and a single place for “everything” — create an **empty** repo (e.g. `MotionHub`), then push this monorepo as the first commit.

**No need**, if you already have a repo that contains this folder — you can keep using it and point Vercel/Railway at the right **root directories** (see below).

Either way, keep **`.env.example`** in git and real **`.env`** / dashboard values out of git.

## Starting a fresh GitHub repo (recommended flow)

1. **Create** an empty repo on GitHub (e.g. `MotionHub` or `motion-league`) — no README/license if you’ll push existing code first.

2. **From your PC** (in the folder that contains `league-platform`, `MotionBot`, `hub-app`):

   ```powershell
   cd C:\Users\Halep\MotionHub
   git init
   git add .
   git commit -m "Initial monorepo import"
   git branch -M main
   git remote add origin https://github.com/YOUR_ORG/YOUR_REPO.git
   git push -u origin main
   ```

3. **Connect deploys** to **this one repo**, each with a **different root directory**:
   - **Vercel – league site:** Root Directory = `league-platform/apps/league-site` (or deploy from monorepo root with that setting).
   - **Vercel – notes-api:** Root Directory = `hub-app/notes-api`.
   - **Railway – bot:** Root Directory = `MotionBot` (or Dockerfile if you add one).
   - **Railway / Render – league-api:** Root Directory = `league-platform/apps/league-api` (or your chosen host).

4. **Database:** Use **Neon**, **Supabase**, or **Railway Postgres** — paste `DATABASE_URL` into API/worker env, not into the repo.

## Why one repo helps

- One **issue tracker** and **history** for bot + site + API.
- Shared **docs** (`league-platform/docs`, `SETUP.md`, this file).
- Easier to keep **env variable names** and **Discord channel IDs** consistent across services.

## Old separate repos

If you previously had **only** `MotionBot` or **only** `league-platform` on GitHub, you can **archive** those repos after this monorepo is pushed and deploys are pointed here. No need to delete history unless you want to.
