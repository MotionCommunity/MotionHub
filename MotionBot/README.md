# Motion RL Discord Bot

Tournament bot for match threads, replay submission, and loser confirmation.

---

## Run in the cloud (recommended — always on)

So the bot stays online 24/7 without your PC. Use **Railway** (free tier) or **Render** (free tier).

### Deploy to Railway

1. **Put the bot code on GitHub** (if you haven’t already):
   - Create a new repo at [github.com/new](https://github.com/new) (e.g. `MotionBot`).
   - In the MotionBot folder on your PC, run:
     ```bash
     cd C:\Users\Halep\MotionBot
     git init
     git add .
     git commit -m "Initial commit"
     git branch -M main
     git remote add origin https://github.com/YOUR_USERNAME/MotionBot.git
     git push -u origin main
     ```
   - Replace `YOUR_USERNAME` with your GitHub username.

2. **Sign up at [railway.app](https://railway.app)** (GitHub login is fine).

3. **New project → Deploy from GitHub repo**  
   Choose your `MotionBot` repo. Railway will detect Node.js and run `npm install` and `npm start`.

4. **Add environment variables**  
   In the Railway project: **Variables** → add each name and value (no `.env` file in the cloud):
   - `TOKEN` — your Discord bot token  
   - `CLIENT_ID` — Discord application (client) ID  
   - `GUILD_ID` — your Discord server (guild) ID  
   - `CHANNEL_MATCH_ANNOUNCE`, `CHANNEL_MATCH_RESULTS`, `CHANNEL_PROCESSING_QUEUE`, `CHANNEL_STAFF_CHAT`  
   - `ROLE_STAFF`, `ROLE_REGISTERED`, `ROLE_CHECKED_IN`  

5. **Deploy**  
   Railway builds and runs the bot. It stays on so long as the project is active (free tier has monthly limits; paid is cheap if you need 24/7 with no spin-down).

6. **Check logs**  
   In Railway, open the deployment → **Logs**. You should see something like: `Motion RL Bot is online as …`.

---

### Alternative: Deploy to Render

1. Go to [render.com](https://render.com) and sign up (GitHub login).
2. **New → Background Worker**.
3. Connect your GitHub repo (the same MotionBot repo).
4. **Build command:** `npm install`  
   **Start command:** `npm start`
5. Add the same **Environment Variables** as above (TOKEN, CLIENT_ID, GUILD_ID, channel IDs, role IDs).
6. Create the worker. Render will run the bot; on the free tier it may spin down after inactivity (paid tier keeps it always on).

---

## Run on your PC (optional)

Use this for testing or if you prefer not to use the cloud.

- **From the Motion Hub (Master build):** Tournament → Discord Bot → set path → **Start Bot**.
- **From this folder:** Double‑click **`start_bot.bat`** or run `npm start` in a terminal.

## Environment variables

Create a **`.env`** file in this folder with:

- `TOKEN` — Discord bot token
- `CLIENT_ID` — Application (client) ID
- `GUILD_ID` — Your server (guild) ID
- `CHANNEL_MATCH_ANNOUNCE` — #match-announcements channel ID
- `CHANNEL_MATCH_RESULTS` — #match-results channel ID (threads created here)
- `CHANNEL_PROCESSING_QUEUE` — #processing-queue channel ID (replays posted here on `/confirm`)
- `CHANNEL_STAFF_CHAT` — #staff-chat channel ID
- `ROLE_STAFF` — Staff role ID
- `ROLE_REGISTERED` — Registered player role ID
- `ROLE_CHECKED_IN` — Checked-in role ID

## Data the bot has for integration

When the losing team runs `/confirm`, the bot posts to **#processing-queue** with:

- **Match:** team1 vs team2, round, format (from `/match create`)
- **Confirmed by:** Discord user who ran `/confirm` (loser)
- **Replay files:** each file lists **Uploaded by** (Discord tag of the person who posted it = winning team’s player)

So you have **winner Discord** (uploader) and **loser Discord** (confirming user) for pairing with MotionRL/Motion Hub.
