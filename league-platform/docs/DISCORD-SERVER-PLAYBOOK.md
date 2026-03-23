# Discord server playbook — channels, roles & how it all connects

Use this when **setting up the server** and when **copying IDs into Railway + Vercel**.  
Developer Mode must be **on** (Discord → User Settings → App Settings → Advanced → Developer Mode).  
Right‑click a channel or role → **Copy ID**.

---

## Big picture

```
Staff (site or /match)  →  posts ready-up + creates thread
         ↓
#match-announcements     →  teams pinged, react ✅
#match-results (parent)  →  thread per series (replays, /confirm, /dispute)
#processing-queue        →  after /confirm, replays forwarded for staff tools
#staff-chat              →  logs, timer alerts, disputes
Two voice channels       →  “slot 1 / slot 2” for concurrent matches (you pick per match)
```

Your **PC is not required** in production: **bot = Railway**, **site = Vercel** (see `PRODUCTION-VERCEL-RAILWAY.md`).

---

## Roles to create (minimum)

| Role | Why |
|------|-----|
| **Staff** | Can use `/match`, sees staff channels, gets pings. → `ROLE_STAFF` (bot) / `DISCORD_ROLE_STAFF_ID` (site OAuth). |
| **One role per team** | Pings + channel locks for team lounges. Stored in **Admin → Teams** as `discordRoleId`. |
| **@everyone** | Default; you’ll **deny View** on private channels where needed. |

Optional: Referee, Partner, Founder — only if you use them in Discord permissions or site login.

---

## Text channels the bot + site require (4)

Create these **text channels** (names are suggestions — IDs go in env):

| Suggested name | Purpose | Bot env (Railway) | Site env (Vercel) |
|----------------|---------|-------------------|-------------------|
| `#match-announcements` | Ready-up embeds, ✅ reaction, team pings when a match **starts** | `CHANNEL_MATCH_ANNOUNCE` | `DISCORD_MATCH_ANNOUNCE_CHANNEL_ID` |
| `#match-results` | **Parent only** — threads are created **under** this channel | `CHANNEL_MATCH_RESULTS` | `DISCORD_MATCH_RESULTS_CHANNEL_ID` |
| `#match-processing-queue` (or `#processing-queue`) | After losing team runs **`/confirm`**, bot posts replays here for staff | `CHANNEL_PROCESSING_QUEUE` | *(site doesn’t post here; bot only)* |
| `#staff-chat` (or `#match-operations`) | Check-in logs, **15 min timer** expiry alerts, dispute pings | `CHANNEL_STAFF_CHAT` | *(optional; bot uses for alerts)* |

**Same channel IDs** must be in **both** Railway and Vercel where the table shows two columns.

---

## Voice channels (2 shared “slots”)

Create **exactly two** voice channels for all matchups (e.g. **Match Voice A**, **Match Voice B**).  
When you **start a match** (Discord `/match create` or site **Start match in Discord**), you pick **slot 1 or 2** — that tells players which VC to use for **this** series. Multiple matches take turns on those two rooms over time.

Optional: rename via bot env `MATCH_ROOM_1_LABEL` / `MATCH_ROOM_2_LABEL`.

---

## Pod mode — one text + two team-only voice channels per match (concurrent games)

Use this when **multiple matches run at once** and you want each matchup isolated: **its own replay text channel** and **two voice channels** (one visible only to team A + staff, one only to team B + staff). Announcements still go to **`#match-announcements`**, but each post **only pings the two team roles** for that match (`allowed_mentions` roles), so six teams in three games do **not** all get pinged on every start.

**Server setup**

1. Create a **category** (e.g. **Match pods** or **Live matches**) — empty is fine; the site will create channels **under** it.
2. In **Vercel** `.env`: set `DISCORD_MATCH_POD_CATEGORY_ID` to that category’s ID. Keep `DISCORD_MATCH_ANNOUNCE_CHANNEL_ID`. You can **omit** `DISCORD_MATCH_RESULTS_CHANNEL_ID` if you only use pods.
3. **Requirements:** `DISCORD_GUILD_ID`, `DISCORD_BOT_TOKEN`, staff role (`DISCORD_BOT_STAFF_ROLE_ID` or `DISCORD_ROLE_STAFF_ID`), and **both teams must have `discordRoleId`** saved in **Admin → Teams** (used for permission overwrites).
4. **Bot:** must be allowed to **Manage Channels** (create channels in that category). Same replay timer as threads: `MOTION_BOT_REGISTER_URL` + `MOTION_BOT_INTERNAL_SECRET`.

**Optional UI:** set `NEXT_PUBLIC_DISCORD_MATCH_POD_MODE=1` on the site to hide the legacy **Voice slot 1/2** dropdown in Admin → Matches.

**Database:** match rows store `discordPodTextChannelId`, `discordPodVoiceAChannelId`, `discordPodVoiceBChannelId` after start (run `prisma db push` / migrate if you added these fields).

---

## Extra channels (your tournament lobby — optional but typical)

These are **not** hardcoded in the bot env, but players expect them:

| Suggested | Purpose |
|-----------|---------|
| `#tournament-info` | Rules, links |
| `#check-in` | Player flow (manual or bot elsewhere) |
| `#player-pool` | Waiting |
| `#draft-room` | Draft |

---

## Match check-in from the **league site** (different channel)

**Admin → Matches** can **Send Check-In Post** to the channel stored on the match as **`discordChannelId`** (often a shared `#series-checkin` or `#match-day`).  
That is **separate** from the four channels above — set **`discordChannelId`** per match in admin to whatever text channel you want that ping in.

---

## How a match flows (end to end)

1. **Staff** creates a match in **Admin → Matches** (teams + roles from **Admin → Teams**).
2. **Start match in Discord** (or **`/match create`** in Discord):  
   - Message in **`#match-announcements`** with embed + ✅.  
   - **Thread** under **`#match-results`** with replay / `/confirm` / `/dispute` instructions.  
   - Railway bot registers the thread for the **15‑minute replay timer** (if `MOTION_BOT_*` env is set on Vercel).
3. Teams react ✅ in announcements (optional policy).  
4. Teams play in **Voice A or B** (the slot you chose).  
5. **Winner** uploads `.replay` in the **thread** → bot starts **15 min** timer for loser to **`/confirm`** or **`/dispute`**.  
6. **`/confirm`** → bot posts replay list to **`#match-processing-queue`** and pings **Staff**.  
7. **`/match close`** in thread when done (staff).

---

## Railway (Motion bot) — variables to set

| Variable | Value |
|----------|--------|
| `TOKEN` | Bot token |
| `CLIENT_ID` | Application ID |
| `GUILD_ID` | Server ID |
| `CHANNEL_MATCH_ANNOUNCE` | ID of `#match-announcements` |
| `CHANNEL_MATCH_RESULTS` | ID of `#match-results` **parent** |
| `CHANNEL_PROCESSING_QUEUE` | ID of processing queue |
| `CHANNEL_STAFF_CHAT` | ID of staff / ops channel |
| `ROLE_STAFF` | Staff role ID |
| `BOT_INTERNAL_SECRET` | Long random string (share with Vercel) |
| `TOURNAMENT_SYNC_URL` | *(optional)* Your Vercel notes-api base if you use schedule poller |

---

## Vercel (league-site) — extra variables

| Variable | Value |
|----------|--------|
| `DISCORD_MATCH_ANNOUNCE_CHANNEL_ID` | **Same** as `CHANNEL_MATCH_ANNOUNCE` |
| `DISCORD_MATCH_RESULTS_CHANNEL_ID` | **Same** as `CHANNEL_MATCH_RESULTS` (omit if using **pod mode** only) |
| `DISCORD_MATCH_POD_CATEGORY_ID` | Category under which the site creates **1 text + 2 voice** per match (see **Pod mode** above) |
| `NEXT_PUBLIC_DISCORD_MATCH_POD_MODE` | `1` = hide legacy voice-slot dropdown in admin (optional) |
| `MOTION_BOT_REGISTER_URL` | Railway public URL, e.g. `https://xxx.up.railway.app` (no path) |
| `MOTION_BOT_INTERNAL_SECRET` | **Same** as `BOT_INTERNAL_SECRET` |
| `DISCORD_GUILD_ID` | Server ID |
| `DISCORD_BOT_TOKEN` | Same bot token (for API routes) |

Plus your existing OAuth vars (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_ROLE_STAFF_ID`, etc.) and `LEAGUE_API_BASE_URL`.

---

## Bot permissions (Discord Developer Portal)

The bot needs, at minimum, in the channels it uses: **View Channel**, **Send Messages**, **Embed Links**, **Attach Files**, **Read Message History**, **Add Reactions**, **Create Public Threads**, **Send Messages in Threads**, **Manage Threads** (if you archive via `/match close`), **Mention Roles** (for team role pings).

---

## Related docs

- `PRODUCTION-VERCEL-RAILWAY.md` — deploy checklist (no PC).  
- `discord-team-channels.md` — per-team private channels + overwrites.  
- `replay-ingest.md` — `.replay` → database on the league platform.
