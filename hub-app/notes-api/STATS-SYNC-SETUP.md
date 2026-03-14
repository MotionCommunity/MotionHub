# Stats sync – do this in order

**Goal:** "Submit suggested changes" and "Load staff suggestion" work in Tournament Stats.

---

## Part 1: Vercel (the website that runs your API)

**1.** Go to vercel.com and log in.

**2.** Click the project named **motion-notes-api**.

**3.** Click **Settings** (top).

**4.** On the left, click **Git**.  
You’ll see **Connected Git Repository** with a name like `something/repo-name`.  
That’s the GitHub folder Vercel is using. Remember it.

**5.** On the left, click **General**.  
Scroll to **Root Directory**.  
- If it’s **empty**: type `hub-app/notes-api` and click **Save**.  
- If it already says something: leave it. Click **Save** anyway so you’re sure.

**6.** On the left, click **Environment Variables**.  
Do you see a row with **GITHUB_TOKEN**?  
- **No:** Click **Add**. Name: `GITHUB_TOKEN`. Value: a GitHub token that can write to the MotionCommunity/stats repo. Save.  
- **Yes:** You’re good. Skip.

**7.** Click **Deployments** (top).  
Click the **⋯** on the latest deployment.  
Click **Redeploy**. Wait until it says Ready.

---

## Part 2: GitHub (so Vercel has the stats code)

First: in Vercel → Settings → Git, what does **Connected Git Repository** show?

- **If it shows MotionHub (or this repo)** → do **Option A** below.
- **If it shows a different repo** (e.g. motion-notes-api, notes-api, something else) → do **Option B** below.

---

### Option A: Vercel is connected to MotionHub

You need the code in your MotionHub folder to be on GitHub so Vercel can see it.

**If you use GitHub Desktop:**

**8a.** Open **GitHub Desktop**.  
**9a.** File → **Add Local Repository**. Choose your **MotionHub** folder. (If it says “not a Git repository,” skip to “If you don’t use Git” below.)  
**10a.** In the left sidebar, check the list of changes. You should see `hub-app/notes-api/` files.  
**11a.** At the bottom left, type a summary like **Add stats sync**, then click **Commit to main**.  
**12a.** Click **Push origin** (top). Wait until it finishes.  
**13a.** Go to Vercel → **Deployments**. A new deployment should start. Wait until it says **Ready**.

**If you use Git in a terminal (e.g. Command Prompt or PowerShell):**

**8b.** Open a terminal, go to MotionHub:  
`cd c:\Users\Halep\MotionHub`  
**9b.** Commit:  
`git add .`  
`git commit -m "Add stats sync"`  
**10b.** Push:  
`git push`  
(If it asks for login, use your GitHub username and a Personal Access Token as the password.)  
**11b.** Go to Vercel → **Deployments**. Wait until the new deployment is **Ready**.

**If you don’t use Git / MotionHub isn’t a repo yet:**

**8c.** On GitHub.com, create a new repo (e.g. **MotionHub**). Don’t add a README.  
**9c.** Install **GitHub Desktop** (desktop.github.com), open it, sign in.  
**10c.** File → **Add Local Repository** → choose `c:\Users\Halep\MotionHub`.  
If it says “this directory does not appear to be a Git repository”: click **create a repository** and set the path to `c:\Users\Halep\MotionHub`, then Create.  
**11c.** In GitHub Desktop: commit all files (summary: “Add stats sync”), then **Publish repository** (so it goes to GitHub).  
**12c.** In Vercel → Settings → Git: if the project isn’t linked to this repo yet, connect it to the new MotionHub repo and set **Root Directory** to `hub-app/notes-api`. Save.  
**13c.** Deployments → wait for a deployment to run and become **Ready**.

---

### Option B: Vercel is connected to a *different* repo

You need to add the stats file and route to that other repo. Easiest: do it on GitHub’s website.

**8d.** Go to **github.com** and open the repo that Vercel is connected to (the name you saw in Part 1, step 4).  
**9d.** In that repo, open the **api** folder (or create an **api** folder if there isn’t one).  
**10d.** Click **Add file** → **Upload files**.  
**11d.** From your computer, drag in:  
`c:\Users\Halep\MotionHub\hub-app\notes-api\api\suggested-stats.js`  
(Or click “choose your files” and go to that path.)  
**12d.** Scroll down, click **Commit changes**.  
**13d.** Back in that repo, open the file **vercel.json** (in the root of that repo).  
**14d.** Click the pencil icon (Edit). Find the **"routes"** section. Add this line *inside* the routes array (with a comma after the line above it):  
`{ "src": "/api/suggested-stats", "dest": "/api/suggested-stats.js" }`  
**15d.** Click **Commit changes**.  
**16d.** Go to Vercel → **Deployments**. A new deployment should start. Wait until it says **Ready**.

---

**10.** Once the deployment is Ready, Part 2 is done. Go to Part 3.

---

## Part 3: Motion Hub (the app on your computer)

**11.** Open **Motion Hub**.

**12.** Find where you set **Notes sync URL** (e.g. Staff Notes or settings).

**13.** Set it to:  
`https://motion-notes-api.vercel.app`  
(no slash at the end, no space)

**14.** Save.

**15.** Go to **Tournament Stats** → **Easy Edit**.

**16.** Click **Submit suggested changes**.  
If it doesn’t error, it worked.

**17.** Click **Load staff suggestion** to load what was sent.

---

## If it still doesn’t work

- **Submit** gives an error?  
  Vercel might be connected to a **different** GitHub repo (not MotionHub).  
  Then you have to put the stats code in *that* repo: copy `hub-app/notes-api/api/suggested-stats.js` and the `hub-app/notes-api/vercel.json` from MotionHub into that repo’s same places, then push.

- **Load** is empty?  
  Nobody has submitted yet, or the GitHub token can’t read the stats repo. Check **GITHUB_TOKEN** in Vercel has **repo** access.
