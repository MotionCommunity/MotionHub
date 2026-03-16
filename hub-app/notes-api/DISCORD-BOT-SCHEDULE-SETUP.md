# Discord bot setup for match scheduling

The Motion Hub **Schedule** tab lets staff add matches (round, slot, team A vs team B, time) and optionally **Start now**. That data is stored in the **tournament sync** API. A Discord bot can read it and post match calls (with role pings) at the right time.

---

## 1. Where the bot gets the data

**Endpoint (GET):**  
`https://motion-notes-api.vercel.app/api/tournament-sync`  
(or whatever your Notes API base URL is — same as the hub’s “Notes sync” / `motion-notes-api.vercel.app`).

**Response shape (relevant parts):**
```json
{
  "scheduledMatches": [
    {
      "id": "sched-1734567890123-abc123",
      "round": "Semi-finals",
      "matchSlot": "1",
      "teamA": { "name": "Team Alpha", "discordRoleId": "123456789012345678" },
      "teamB": { "name": "Team Beta", "discordRoleId": "987654321098765432" },
      "startAt": "2025-03-15T20:00:00.000Z",
      "status": "scheduled",
      "tournamentId": 1,
      "startRequestedAt": null,
      "lastUpdated": "2025-03-12T...",
      "createdAt": "2025-03-12T..."
    }
  ],
  "lastUpdated": "..."
}
```

- **`scheduledMatches`**: array of match objects (see below).
- All other keys (`queue`, `verified`, `matchResults`, `bracketConfig`, etc.) are for other hub features; the bot can ignore them for scheduling.

**Per match:**

| Field              | Type   | Description |
|--------------------|--------|-------------|
| `id`               | string | Unique id (e.g. `sched-...`). |
| `round`            | string | e.g. "Quarter-finals", "Semi-finals". |
| `matchSlot`        | string | e.g. "1", "QF1". |
| `teamA.name`       | string | Team A display name. |
| `teamA.discordRoleId` | string | Discord role ID to @ping for team A (optional). |
| `teamB.name`       | string | Team B display name. |
| `teamB.discordRoleId` | string | Discord role ID to @ping for team B (optional). |
| `startAt`          | string | ISO 8601 datetime (UTC) when the match is scheduled. |
| `status`           | string | `"scheduled"` or `"calling"`. |
| `startRequestedAt` | string | If set (ISO datetime), staff clicked **Start now**; bot should call the match immediately. |
| `tournamentId`     | number | Optional; hub can filter by active tournament. |

---

## 2. When the bot should “call” a match

Call a match (post in Discord and ping roles) when **either**:

1. **Start now:**  
   `status === 'calling'` or `startRequestedAt` is set.  
   → Call immediately (or on next poll).

2. **Scheduled time (optional):**  
   `status === 'scheduled'` and current time ≥ `startAt`.  
   → Call at that time (or on next poll after that time).

To avoid double-pinging, the bot should track which match IDs it has already “called” (e.g. in memory or a small DB) and skip those. The hub does not currently mark matches as “called” in the API; that can be a later enhancement (e.g. bot POSTs back or a separate “match-called” store).

---

## 3. What the bot should do when calling a match

1. **Resolve Discord IDs**  
   - Use `teamA.discordRoleId` and `teamB.discordRoleId` for pings.  
   - In Discord, ping a role with: `<@&ROLE_ID>` (e.g. `<@&123456789012345678>`).

2. **Post one message** in your chosen “match call” channel, for example:
   - **Match: Team Alpha vs Team Beta**
   - **Round:** Semi-finals · **Slot:** 1  
   - <@&123456789012345678> vs <@&987654321098765432>  
   - Head to the match channel / voice.  
   (Adjust text and channel to your server’s rules.)

3. **Optional:**  
   - If you add a “match call” webhook or API later, the bot could mark the match as called so the hub UI can show “Called at …”.  
   - For now, the bot can just post and remember the `id` so it doesn’t post again.

---

## 4. Bot implementation outline

- **Config**
  - `TOURNAMENT_SYNC_URL` = `https://motion-notes-api.vercel.app` (or your notes API base).
  - `DISCORD_BOT_TOKEN` = your bot token.
  - `DISCORD_MATCH_CHANNEL_ID` = channel where match calls are posted.

- **Polling**
  - Every 30–60 seconds: `GET {TOURNAMENT_SYNC_URL}/api/tournament-sync`.
  - Parse `scheduledMatches`.
  - For each match:
    - If already in “called” set → skip.
    - If `status === 'calling'` or `startRequestedAt` is set → call now.
    - Else if you want time-based calls and `status === 'scheduled'` and now ≥ `new Date(startAt)` → call now.
  - When calling: send one message to `DISCORD_MATCH_CHANNEL_ID` with round, slot, team names, and `<@&teamA.discordRoleId>` / `<@&teamB.discordRoleId>` (if present). Add match `id` to “called” set.

- **Permissions**
  - Bot needs to **Send Messages** (and optionally **Mention @everyone, @here, and All Roles**) in the match channel so role pings work.

---

## 5. Hub side (already in place)

- Staff add/edit/remove scheduled matches in the hub **Schedule** tab.
- Team names and Discord role IDs come from the **Bracket** tab (team config) or custom entry in the schedule modal.
- **Start now** sets `status: 'calling'` and `startRequestedAt` and pushes to the same tournament-sync API the bot reads.
- Sync URL in the hub is the same as above (built-in default or custom in hub config).

No extra hub setup is required for the bot to read schedule data; only the bot needs to be configured and run (and have the Discord token and channel ID).

---

## 6. Quick checklist

1. Notes API is deployed and returns `scheduledMatches` from `GET /api/tournament-sync`.
2. Discord bot has token, Send Messages (and role mention) in the match channel.
3. Bot polls `GET {base}/api/tournament-sync`, reads `scheduledMatches`.
4. Bot calls a match when `status === 'calling'` or `startRequestedAt` is set (and optionally when current time ≥ `startAt` for `scheduled`).
5. Bot posts one message per match with round, slot, team names, and `<@&roleId>` pings, and tracks called IDs so it doesn’t double-post.

If your Discord bot is in a separate repo, you can copy the payload shape and polling rules above into that repo’s docs or code comments.
