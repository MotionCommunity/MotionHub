# Stats page: bracket and tournament info from sync API

The Motion Hub publishes bracket and tournament info to the **tournament-sync API** as `bracketConfig`. The stats site fetches this on load and shows the bracket and (when present) tournament name and format.

## 1. One source of truth

- **Stats page** loads: `GET https://motion-notes-api.vercel.app/api/tournament-sync` (or your Notes API URL).
- **Hub** writes: Master Hub → Bracket → **Publish to stats page** → sends `bracketConfig` (rounds, tournament name, format, team count) to the same API.

One publish from the Hub updates the stats page after refresh.

## 2. Shape of `bracketConfig` (published from Hub)

When you click **Publish to stats page**, the Hub sends:

```json
{
  "tournamentId": 1,
  "tournamentName": "Q1 Inaugural 2v2",
  "bracketType": "SingleElimination",
  "seriesFormat": "BestOf5",
  "teamCount": 8,
  "updatedAt": "2025-03-12T...",
  "rounds": [
    { "roundId": "r1", "name": "Round 1", "order": 0, "matches": [ { "matchId": "r1-m1", "slot": "1", "teamA": "Team Alpha", "teamB": "Team Beta", "winner": "A" } ] },
    ...
  ]
}
```

- **Bracket:** `rounds` array; each round has `name`, `matches`; each match has `teamA`, `teamB`, `winner` ("A"/"B"/null).
- **Hero:** `tournamentName`, `bracketType`, `seriesFormat`, `teamCount` are used by the stats page to update the title and pills.

## 3. Stats site behavior (already implemented)

- On load, the stats page fetches the API and calls `applySyncData(data)`.
- If `bracketConfig.tournamentName` is set, the tournament title is updated.
- If `bracketType` / `seriesFormat` / `teamCount` are set, the pills are updated.
- If `bracketConfig.rounds` exists and has length, the bracket is rendered; otherwise "BRACKET NOT YET SET UP" is shown.
