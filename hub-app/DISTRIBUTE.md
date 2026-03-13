# Sending Motion Staff Hub to Your Team

## For you (one-time build)

1. Open Command Prompt and go to the app folder:
   ```
   cd C:\Users\Halep\MotionHub\hub-app
   ```
2. Create the portable app (single .exe, no install needed):
   ```
   npm run build
   ```
3. When it finishes, the file is here:
   ```
   hub-app\dist\Motion-Staff-Hub-0.1.0.exe
   ```
4. **Send that one file** to your team (e.g. via Discord, Google Drive, or email).  
   Optional: zip it first so it’s one attachment.

---

## For your staff

1. Download `Motion-Staff-Hub-0.1.0.exe` (or the zip and unzip it).
2. Double-click the .exe to open the hub.
3. No install, no Node, no account—just run it.

They can keep the .exe anywhere (Desktop, a folder) and run it whenever they need the hub.

---

## Optional: installer instead of portable

If you prefer an installer (adds Start Menu / Desktop shortcut):

```
npm run build:installer
```

Then send: `dist\Motion-Staff-Hub-Setup-0.1.0.exe`. Staff run it once to install, then open “Motion Staff Hub” from the Start Menu or shortcut.

---

## Building the Master version (for you only)

The Master build has the same hub plus: **GitHub token** field, **Publish**, **Rollback**, and **Load staff suggestion** in the Rules section.

1. In `hub-app`, open **`build-type.js`** and change the line to:
   ```js
   window.MOTION_HUB_BUILD = 'master';
   ```
2. Run `npm run build` (or `build:installer`).
3. The .exe in `dist\` is now the Master build. Keep this for yourself; send staff the **Staff** build (with `build-type.js` set back to `'staff'` and rebuild if needed).

---

## When you update the app — sending updates to your team

After you change the hub (new links, UI, rules editor, etc.), use one of these ways to get the new build to your team.

### Option A: One place to download (recommended)

Put every new build in **one place** your team knows (e.g. a Discord channel, Google Drive folder, or GitHub Releases). Then staff always go to that same place to get the latest .exe.

**Steps for you when you release an update:**

1. Bump the version in `hub-app\package.json` (e.g. change `"version": "0.1.0"` to `"0.2.0"`) so the filename reflects the version.
2. Build the portable app:
   ```
   cd C:\Users\Halep\MotionHub\hub-app
   npm run build
   ```
3. Upload the new file to your chosen place:
   - **Discord:** Post `dist\Motion-Staff-Hub-0.2.0.exe` (or a zip of it) in a dedicated channel (e.g. `#staff-hub-downloads`). Pin a message like: “Always use the **latest** file in this channel.”
   - **Google Drive:** Use **`npm run build:drive`** instead of `npm run build`; it creates **`Motion-Staff-Hub-LATEST.exe`** in `dist\`. Upload that to your shared folder and replace the old one so the link never changes. See **Google Drive updates — full step-by-step** below.
   - **GitHub Releases:** Create a new release (e.g. tag `v0.2.0`), attach the .exe from `dist\`, and write short release notes. Staff go to the repo → Releases and download the latest.

4. Tell your team (e.g. in Discord): “New Staff Hub is out — download from [link/channel]. Replace your old .exe with the new one (or run the new one).”

**For staff:** They download the latest .exe from that one place and run it (no install). They can replace their old .exe with the new one or keep both and run the new one.

---

### Option B: You send the file each time

1. Run `npm run build` and bump the version in `package.json` if you like.
2. Send the new .exe from `dist\` (e.g. via Discord DM, email, or a one-off link). Staff replace their old file and run the new one.

---

### Option C: Team has the repo (developers)

If a team member has the MotionHub repo and Node.js installed, they can pull and build themselves:

```
cd MotionHub\hub-app
git pull
npm install
npm run build
```

Then they run `dist\Motion-Staff-Hub-0.x.x.exe`. Most staff will prefer Option A (single download link) instead.

---

### In-app “Check for updates”

The hub has **Help → Check for updates** (menu) and **Check for updates** (sidebar). Both open your update URL in the browser so staff can download the latest build. No need to delete the old app — they just download and run the new one. Full step-by-step below uses **Google Drive** so one link stays the same forever.

---

## Google Drive updates — full step-by-step (flawless)

One folder, one filename, one link. Staff click “Check for updates” → download → run (or replace their old file). No uninstall, no searching for new links.

---

### Part 1: One-time setup (you do this once)

#### Step 1 — Create the folder in Google Drive

1. Go to [drive.google.com](https://drive.google.com) and sign in.
2. Click **+ New** → **New folder**.
3. Name it (e.g. **Motion Staff Hub**). Click **Create**.

#### Step 2 — Share the folder so anyone with the link can view

1. **Right‑click** the folder you just created.
2. Click **Share**.
3. Under “General access,” change **Restricted** to **Anyone with the link**.
4. Leave the role as **Viewer** (they only need to download).
5. Click **Copy link** (or copy the URL shown). It will look like:
   ```
   https://drive.google.com/drive/folders/1ABC...longId...xyz
   ```
6. Paste that link somewhere safe (Notepad, Discord to yourself). You’ll use it in the next part.
7. Click **Done**.

#### Step 3 — Put the update URL in the app

1. On your PC, open the MotionHub project.
2. Open **`hub-app\main.js`** in your editor.
3. Near the top (around line 6–8), find:
   ```js
   const CHECK_FOR_UPDATES_URL = '';
   ```
4. Paste your **folder link** between the quotes, for example:
   ```js
   const CHECK_FOR_UPDATES_URL = 'https://drive.google.com/drive/folders/1ABC...xyz';
   ```
5. Save the file (Ctrl+S). Do **not** add a slash at the end of the URL.

#### Step 4 — Build the app with the update link (and create the file for Drive)

1. Open **Command Prompt** or **PowerShell**.
2. Go to the app folder:
   ```
   cd C:\Users\Halep\MotionHub\hub-app
   ```
3. Run the **Drive build** (this builds the app and creates `Motion-Staff-Hub-LATEST.exe` in one go):
   ```
   npm run build:drive
   ```
4. Wait until it finishes. You should see:
   - `Copied to dist/Motion-Staff-Hub-LATEST.exe (ready for Drive upload)`
5. In File Explorer, open **`hub-app\dist`**. You should see:
   - `Motion-Staff-Hub-0.1.0.exe` (or your current version)
   - **`Motion-Staff-Hub-LATEST.exe`** ← this is the one you upload to Drive.

#### Step 5 — Upload to Google Drive and add instructions (optional but recommended)

1. Go back to your Google Drive and open the **Motion Staff Hub** folder.
2. Drag **`Motion-Staff-Hub-LATEST.exe`** from `hub-app\dist` into that folder (or click **New** → **File upload** and choose it).
3. **(Optional)** So staff see instructions when they open the folder: copy the file **`hub-app\drive-folder-README.txt`** into the same Drive folder. You can rename it to **README.txt** if you like. Staff will see how to download and that they don’t need to delete the old app.

#### Step 6 — Send the app to your team (once)

1. From **`hub-app\dist`**, send your team **`Motion-Staff-Hub-LATEST.exe`** (or the versioned one, e.g. `Motion-Staff-Hub-0.1.0.exe`) — e.g. via Discord, email, or a one-off link.
2. Tell them: “This is the Motion Staff Hub. When we release updates, use **Help → Check for updates** inside the app to get the latest version from the same place. No need to uninstall — just download and run the new file.”

After this one-time setup, you **never** need to send a new link or new “update” build to the team. They always use “Check for updates” to open the same Drive folder.

---

### Part 2: When you release an update (you do this every time you update the hub)

#### Step 1 — Make your code changes

Edit the hub as usual (rules, UI, links, etc.). If you want the version number in the filename to change, edit **`hub-app\package.json`** and bump **`"version"`** (e.g. `"0.1.0"` → `"0.2.0"`).

#### Step 2 — Build the new app and create the LATEST file

1. Open **Command Prompt** or **PowerShell**.
2. Run:
   ```
   cd C:\Users\Halep\MotionHub\hub-app
   npm run build:drive
   ```
3. Wait until you see: `Copied to dist/Motion-Staff-Hub-LATEST.exe (ready for Drive upload)`.

#### Step 3 — Replace the file in Google Drive

1. Go to [drive.google.com](https://drive.google.com) and open your **Motion Staff Hub** folder.
2. You should see the old **Motion-Staff-Hub-LATEST.exe**.
3. **Option A (replace in place):**
   - **Right‑click** the existing **Motion-Staff-Hub-LATEST.exe** → **Manage versions** → **Upload new version**.
   - Choose the new file from **`hub-app\dist\Motion-Staff-Hub-LATEST.exe`**.
   - Done. The folder link is unchanged; staff still open the same folder and get the new file.
4. **Option B (delete and re-upload):**
   - Right‑click the old **Motion-Staff-Hub-LATEST.exe** → **Remove** (or move to Trash).
   - Click **New** → **File upload** and select **`hub-app\dist\Motion-Staff-Hub-LATEST.exe`**.
   - Done.

#### Step 4 — Tell your team (optional)

Send a short message (e.g. in Discord): “Staff Hub update is live. In the hub, go to **Help → Check for updates** to download the latest.”

You do **not** need to send a new app or new link. Everyone who already has the hub will use “Check for updates” and get the new exe from the same folder.

---

### Part 3: For your staff (what they do — no deleting required)

#### Getting the hub for the first time

1. They get **Motion-Staff-Hub-LATEST.exe** from you (or from the Drive link you shared once).
2. They put it somewhere (Desktop, a folder) and double‑click to run it. No install.

#### Getting an update (every time you release one)

1. Open the **Motion Staff Hub** app.
2. Click **Help** in the menu bar → **Check for updates** (or click **Check for updates** at the bottom of the sidebar).
3. Their browser opens the Google Drive folder. They see **Motion-Staff-Hub-LATEST.exe** (and optionally README.txt).
4. They click **Motion-Staff-Hub-LATEST.exe**, then click the **Download** button (or the download icon).
5. When the download finishes, they have two choices:

   **Option A — Replace the old file (recommended, keeps shortcuts working)**  
   - They move the downloaded **Motion-Staff-Hub-LATEST.exe** to the **same folder** where their current hub is (e.g. Desktop or “Motion Hub” folder).  
   - When Windows asks **“Replace file in destination?”**, they click **Replace**.  
   - Their existing shortcut or taskbar pin still opens the hub — now the latest version. No need to delete anything first.

   **Option B — Run from Downloads**  
   - They double‑click the downloaded file (e.g. from their Downloads folder) and run the new version.  
   - They can delete the old shortcut or old exe later if they want. Both can coexist.

Either way, they **never** have to uninstall or “delete the old system.” They just download and run (or replace and run).

---

### Quick reference

| Who        | Action |
|-----------|--------|
| **You (once)** | Create Drive folder → Share (Anyone with link) → Put folder URL in `main.js` → `npm run build:drive` → Upload `Motion-Staff-Hub-LATEST.exe` to folder → Send that exe to team once. |
| **You (each update)** | Code changes → `npm run build:drive` → In Drive folder, upload new version of `Motion-Staff-Hub-LATEST.exe` (replace or delete old + upload). |
| **Staff (each update)** | In hub: **Help → Check for updates** → Download **Motion-Staff-Hub-LATEST.exe** → Replace old file (or run from Downloads). |

---

### Troubleshooting

- **“Check for updates” does nothing or doesn’t open a link**  
  Make sure `CHECK_FOR_UPDATES_URL` in `main.js` is set to your Drive folder link and that you rebuilt the app (`npm run build:drive`) after changing it. The copy you send to staff must be that build.

- **Staff get “Can’t download” or “Too many downloads” on Google Drive**  
  Google can limit downloads for very popular files. Workaround: have them **Right‑click the file** → **Make a copy** (saves to their Drive), then download from their copy. Or host the same file in a Discord channel and set `CHECK_FOR_UPDATES_URL` to that channel.

- **I want the link to open the file directly instead of the folder**  
  Share the **file** (Motion-Staff-Hub-LATEST.exe) with “Anyone with the link,” copy the file link (e.g. `https://drive.google.com/file/d/FILE_ID/view?usp=sharing`), and set that as `CHECK_FOR_UPDATES_URL` in `main.js`. Then “Check for updates” opens the file page; they click Download there.

---

### Other update URL options

You can set `CHECK_FOR_UPDATES_URL` to a **Discord channel** or **GitHub Releases** page instead of Google Drive; the in-app “Check for updates” will open that URL the same way. The steps above are for the Google Drive “one folder, one file” flow so the link never changes.
