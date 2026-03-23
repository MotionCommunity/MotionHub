# Replay ingest (per match / per game)

Parsed stats come from **Rocket League `.replay` files**. The database stores:

- `ReplayFile` — storage path, SHA, parse status  
- `PlayerGameStat` — per-player stats for a `Game`  
- `Game` — belongs to a `Match` (series), has `gameNumber` (1, 2, 3, …)

## Staff UI flow

1. **Admin → Matches** — open **Games & .replays** for a match.  
2. **Add game slot** — one row per map (Game 1, Game 2, …).  
3. **Upload** the `.replay` for that game — the file is saved under  
   `REPLAY_UPLOADS_DIR/matches/<matchId>/…` and `POST /v1/replays/ingest` is called with that **`gameId`**.  
4. **league-worker** reads the file, runs the parser, and writes `PlayerGameStat` rows for that game.

## Environment (required for uploads)

Set the **same** absolute path on:

- **league-site** — `REPLAY_UPLOADS_DIR` (Next.js `.env.local`)  
- **league-worker** — `REPLAY_UPLOADS_DIR`  

If this is missing on the site, the upload API returns 500 with a clear error.

## Manual / CLI alternative

You can copy a `.replay` into the uploads tree and call the API yourself:

```json
POST /v1/replays/ingest
{ "storageKey": "matches/<matchId>/<file>.replay", "sha256": "<optional>", "gameId": "<game uuid>" }
```

`storageKey` must resolve under `REPLAY_UPLOADS_DIR` on the worker (see worker `resolveReplayPath`).

## Legacy behavior

If you ingest **without** a `gameId`, the worker creates a placeholder tournament (`__Replay Imports__`) and match. Prefer creating games under a real match and always passing **`gameId`**.
