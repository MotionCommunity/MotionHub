# Testing tournament live sync (draft board & bracket)

You can verify that draft/bracket updates reach other Staff and Master hubs **without** another person.

---

## 1. Verify sync (one hub)

1. Open **Motion Hub** → **Tournament**.
2. Select an **Active tournament** (or create one).
3. Make a small change on the **Draft board** (e.g. add a player to a team or add a sub).
4. Click **Verify sync** in the tournament header.
5. You should see:
   - **"Read & write OK. Your update is live. Last updated: …"**  
     That means your change was pushed to the sync server and re-fetched successfully. Other hubs use the same server, so they will see the same data when they fetch.
   - If you see **"Sync reachable. Last updated: never"** and no error, the API is reachable but no one has pushed yet; after you push (e.g. by making a draft change), run **Verify sync** again to confirm write.

If **Verify sync** shows an error (e.g. "Fetch failed"), check:

- Notes API is deployed and the sync URL is correct (default: `https://motion-notes-api.vercel.app`).
- Your network allows access to that URL.

---

## 2. Testing with two hubs (optional)

To simulate **Staff A** and **Staff B** (or Master) on one machine:

### Option A: Two app windows (same data)

- Open the app twice (e.g. run `npm start` twice, or launch the built app twice).
- Both windows share the same tournament database and the same **Staff handle** in Settings, so they will show the same local draft.  
- What you can still test:
  - In window 1: make a draft change → click **Verify sync** (confirms push).
  - In window 2: go to **Home** then back to **Tournament** (or switch section away and back). The **Bracket / Schedule / Match results** tabs may show a **change indicator** (dot) because `recentChanges` is updated on the server.  
- Match results and schedule are loaded from the sync API when you open those panes; after one window adds/updates a result or schedule, the other window will see it when it **refreshes** or re-opens that pane.

### Option B: Two different “hubs” (different Staff handles)

To test different Staff handles (who edited what):

1. In **Hub 1**: Settings → set **Staff handle** to e.g. `Staff A`.
2. In **Hub 2** (second window or second machine): set Staff handle to `Staff B`.
3. In **Hub 1**: Tournament → Draft board → make a change (e.g. assign a player).  
   - Click **Verify sync** to confirm push.
4. In **Hub 2**: Tournament → open **Bracket** (or **Schedule** / **Match results**).  
   - The Bracket pane can show **“Last edited by Staff A at …”** when that data comes from the sync API (if the UI displays it for the section you’re viewing).
5. The **change indicators** (dots on Bracket / Schedule / Results) in Hub 2 are driven by `recentChanges` from the sync server; switching to Tournament and checking those tabs shows that “someone else” (Staff A) updated something.

---

## 3. What is shared vs local

| Data                 | Stored / shared                          | How others see it                          |
|----------------------|------------------------------------------|-------------------------------------------|
| Draft (teams, roster)| Pushed to sync server as `bracketConfig` | Change indicator; “last edited by …”       |
| Match results        | Sync server                              | Refresh / open Match results pane         |
| Schedule             | Sync server                              | Refresh / open Schedule pane              |
| Registrations/players| Local DB + Google Sheet sync             | Each hub syncs from the sheet separately  |

So: **Verify sync** confirms that your draft/bracket updates are written to and read back from the same place other hubs use. To see “live” behavior as another person would, use a second window or machine and refresh or re-open the Tournament section and the relevant panes (Bracket / Schedule / Match results).
