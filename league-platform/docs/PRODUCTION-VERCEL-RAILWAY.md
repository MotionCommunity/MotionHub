# Production: Vercel (site) + Railway (bot) — no PC required

Your **PC does not need to stay on**. Use the same cloud services you already use:

| Service | What it runs |
|--------|----------------|
| **Vercel** | **league-site** (staff portal, `/admin/matches`, Discord OAuth) and/or **notes-api** (tournament sync for the Hub) |
| **Railway** | **Motion Discord bot** (`MotionBot/`) 24/7 |

Localhost URLs in `.env` examples are **only for development** on your machine.

---

## 1. Bot on Railway (already typical)

1. Deploy **MotionBot** from GitHub → Railway.
2. In **Railway → Variables**, set all Discord vars (`TOKEN`, `CLIENT_ID`, `GUILD_ID`, channels, `ROLE_STAFF`, etc.).
3. For **replay timer registration** from the staff site, also set:
   - **`BOT_INTERNAL_SECRET`** — long random string (same value you’ll put on Vercel).
   - **`PORT`** — Railway usually injects this automatically; the bot listens on `BOT_HTTP_PORT || PORT` for the small HTTP API.
4. In **Railway → Networking**, generate a **public URL** (e.g. `https://motion-bot-production-xxxx.up.railway.app`).  
   - The staff site will call:  
     `https://…up.railway.app/internal/register-match-thread`  
   - Ensure the service is **publicly reachable** (not only private networking) so Vercel can POST to it.

You should see in logs:  
`[Timer API] POST /internal/register-match-thread on port …`  
and  
`Motion RL Bot is online as …`

---

## 2. League site on Vercel

1. Deploy **league-site** (`apps/league-site`) to Vercel.
2. In **Vercel → Project → Environment Variables**, set at least:
   - **`LEAGUE_API_BASE_URL`** — your hosted **league-api** URL (if API is on Railway/Fly/etc.).
   - **`DISCORD_*`** — OAuth + bot token + role IDs (same Discord app as the bot).
   - **`DISCORD_MATCH_ANNOUNCE_CHANNEL_ID`** / **`DISCORD_MATCH_RESULTS_CHANNEL_ID`** — same channel IDs as in the bot’s `CHANNEL_MATCH_*` env.
   - **`MOTION_BOT_REGISTER_URL`** — **only the base URL of your Railway bot**, no path, no trailing slash:  
     `https://motion-bot-production-xxxx.up.railway.app`
   - **`MOTION_BOT_INTERNAL_SECRET`** — **exactly the same** as **`BOT_INTERNAL_SECRET`** on Railway.
   - **`DISCORD_GUILD_ID`** — your server ID (needed for timer registration payload).

After deploy, **Admin → Matches → Start match in Discord** will call your **Railway** bot over the public internet, not your PC.

---

## 3. Vercel “sync” (notes-api / tournament sync)

That is **separate** from the league site:

- **Hub apps** use the **Notes / tournament sync URL** (often another Vercel project: `hub-app/notes-api`).
- **`TOURNAMENT_SYNC_URL`** on the **Motion bot** (Railway) should point to that same sync API base if you use the schedule poller.

So you can have:

- **Vercel project A** — notes-api (sync)  
- **Vercel project B** — league-site (staff portal)  
- **Railway** — Motion bot (+ optionally league-api / worker elsewhere)

No conflict; each has its own env vars.

---

## 4. Quick checklist (production)

- [ ] Railway bot online; `BOT_INTERNAL_SECRET` set; public URL works.
- [ ] Vercel league-site: `MOTION_BOT_REGISTER_URL` = Railway base URL, `MOTION_BOT_INTERNAL_SECRET` matches bot.
- [ ] Test **Start match in Discord** from production admin; amber message should say replay timer registered (or show a clear env error).

If the timer warning appears, compare secrets character-for-character and confirm Railway **Networking** exposes HTTPS to your bot process.
