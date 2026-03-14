# Push the code – copy and paste these

Do this **after** Part 1 (Vercel) is done. Use **Command Prompt** or **Git Bash** (not PowerShell unless you know Git works there).

---

## Step 1: Open a terminal where Git works

- **Option A:** In Cursor/VS Code: **Terminal → New Terminal**. If `git` works there, use it.
- **Option B:** Press Windows key, type **Git Bash**, open it.
- **Option C:** Press Windows key, type **cmd**, open Command Prompt.

---

## Step 2: Go to the MotionHub folder

Paste this and press Enter:

```cmd
cd c:\Users\Halep\MotionHub
```

---

## Step 3: See what Git will push

Paste:

```cmd
git status
```

You should see a list of changed/untracked files (including things under `hub-app/notes-api`). That’s good.

---

## Step 4: Add everything and commit

Paste these **one at a time** (press Enter after each):

```cmd
git add .
```

```cmd
git commit -m "Add stats sync"
```

If it says “nothing to commit” or “no changes,” the code was already committed. You can still do Step 5 to push.

---

## Step 5: Push to GitHub

First, check if a remote is set. Paste:

```cmd
git remote -v
```

- **If you see a line with `origin` and a GitHub URL** (e.g. `https://github.com/...` or `git@github.com:...`):  
  Push with:

```cmd
git push origin main
```

If your default branch is `master` instead of `main`, use:

```cmd
git push origin master
```

- **If you see “fatal: not a git repository”** when you ran `git status`: you’re not in a Git repo; make sure you’re in `c:\Users\Halep\MotionHub`.
- **If `git remote -v` shows nothing**: you need to connect this folder to GitHub first (see “No remote?” below).

---

## Step 6: Check Vercel

1. Go to **vercel.com** → your **motion-notes-api** project.
2. Open **Deployments**.
3. A new deployment should appear and run. Wait until it says **Ready**.

Then do **Part 3** in the Motion Hub app (set Notes sync URL and try Submit suggested changes).

---

## No remote? (git remote -v showed nothing)

You have to connect MotionHub to a GitHub repo once.

1. On **github.com**, create a **new repository** (e.g. name: **MotionHub**). Do **not** check “Add a README.”
2. Copy the repo URL (e.g. `https://github.com/YourUsername/MotionHub.git`).
3. In the same terminal (in `c:\Users\Halep\MotionHub`), paste (replace the URL with yours):

```cmd
git remote add origin https://github.com/YourUsername/MotionHub.git
```

4. Then push (use `main` or `master` to match what GitHub shows):

```cmd
git push -u origin main
```

If it fails with “master,” try:

```cmd
git push -u origin master
```

5. In **Vercel** → project **Settings** → **Git**: connect the project to this new repo and set **Root Directory** to `hub-app/notes-api`. Save. A deployment will run.

---

## Push asked for username/password?

- **Username:** your GitHub username.
- **Password:** use a **Personal Access Token**, not your GitHub password.  
  Create one: GitHub.com → your profile (top right) → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token**. Give it **repo** scope, copy the token, and paste it when Git asks for a password.
