# MotionHub

Monorepo for Motion tools: **Staff/Master Hub** (Electron), **league platform** (site + API + worker), **Discord bot**, and **notes / sync API**.

See **`MONOREPO-AND-DEPLOY.md`** for using **one GitHub repo** and wiring **Vercel + Railway** (and hosted Postgres).  
**`.env.example`** (repo root) lists env **names** for each service — copy values into Vercel/Railway/Neon, not into git.

---

## Staff Hub (Electron)

Notes, rules, stats, tournament tools.

### Run (dev)

```powershell
cd C:\Users\Halep\MotionHub\hub-app
npm start
```

## Build

```powershell
cd hub-app
npm run build
```

The built app is in `hub-app/dist/` (e.g. portable `.exe` or installer).

## Docs

- **MONOREPO-AND-DEPLOY.md** — Single GitHub repo, deploy roots, fresh start.
- **SETUP.md** — Discord bot, sync API (Vercel), and hub configuration.
- **league-platform/docs/PRODUCTION-VERCEL-RAILWAY.md** — Site + bot in production.
- **hub-app/notes-api/README.md** — Notes API endpoints and deploy.
- **hub-app/notes-api/STATS-SYNC-SETUP.md** — Stats sync (Submit suggested changes / Load staff suggestion).
