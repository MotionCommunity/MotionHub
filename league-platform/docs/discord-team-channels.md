# Discord: team roles & private channels

This league stack stores **Discord role IDs** and **channel IDs** per team (see **Admin → Teams**). Use Discord’s permission system so each team only sees its own channels.

## Recommended layout

1. Create a **category** per tournament (e.g. `MOTION S8 — Teams`).
2. Under it, for each team:
   - **Text** channel (e.g. `#team-legacy-lounge`)
   - Optional **voice** channel (e.g. `Legacy VC`)

## Permission template (per channel)

For **each** team text/voice channel:

1. Open **Channel settings → Permissions**.
2. **@everyone**: **Deny** `View Channel` (and optionally `Connect` on voice).
3. Add the **team role**: **Allow** `View Channel`, `Send Messages` / `Read Message History` (text), `Connect`, `Speak` (voice).
4. Add **staff / moderator** roles as needed (Allow `Manage Channel` only if required).

Repeat for the **category** if you want the whole category hidden: set category permissions the same way, then sync to children or set each child explicitly.

## Bot requirements

The bot user that posts check-ins needs:

- Access to the **match check-in channel** (`discordChannelId` on the match).
- Permission to **mention** the team roles used in check-in (`teamARoleId` / `teamBRoleId`), or use allowed mentions in the API.

## IDs in this app

| Field | Where it’s used |
| --- | --- |
| Team `discordRoleId` | Pings, check-in role dropdowns, permission overwrites |
| Team `discordTextChannelId` / `discordVoiceChannelId` | Reference for players; paste from Discord (Developer Mode → Copy ID) |
| Match `discordChannelId` | Where the check-in message is posted (often a shared **match** or **series** channel) |

After creating channels in Discord, copy IDs into **Admin → Teams** so staff and integrations stay aligned.
