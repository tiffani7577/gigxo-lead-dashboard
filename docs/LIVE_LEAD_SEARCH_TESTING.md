# How to Test Live Lead Search Locally

## 1) Exact local URL

- **URL:** `http://localhost:3000/admin/live-lead-search`
- The app runs on a single server; the default port is **3000** (or whatever you set in `PORT`). So if you use `npm run dev` or `npm run dev:run`, open:
  - **http://localhost:3000/admin/live-lead-search**

If you changed the port (e.g. `PORT=4000 npm run dev`), use that port instead.

---

## 2) Exact steps to use it

1. **Start the app**
   - From project root: `npm run dev` or `npm run dev:run`
   - Wait until the server is up (e.g. “Listening on port 3000” or similar).

2. **Log in as admin**
   - Go to `http://localhost:3000/login` and sign in with a user that has **role = admin**.
   - If you don’t have an admin user, create one and set `role` to `admin` in the DB (or use your existing promote-admin script).

3. **Open Live Lead Search**
   - Either go directly to **http://localhost:3000/admin/live-lead-search**
   - Or use the sidebar: click **“Live Lead Search”** (Radio icon).

4. **Run a search**
   - Enter a **Custom search phrase** (e.g. `wedding dj`).
   - Select at least one **Source**: Reddit, Craigslist, Eventbrite (click the badges).
   - Optionally set **City**, **Performer type**, **Include keywords**, **Exclude keywords**, **Max results**, or **Date window**.
   - Click **“Run live search”**.
   - Wait for the request to finish (button shows a spinner).

5. **View results**
   - A **Results** card appears with a table: Title, Source, Location, URL, Snippet, Intent score, Status/reason (Pass or reject reason).
   - Rows with **Pass** have a checkbox in the first column.

6. **Save to gigLeads (optional)**
   - **Save selected:** Check the rows you want, then click **“Save selected (N) to gigLeads”**.
   - **Save all passing:** Click **“Save all passing (N) to gigLeads”** to save every accepted row.
   - A toast shows how many were inserted and how many were skipped as duplicates.

7. **Save a preset (optional)**
   - Fill the form as you want, enter a **Preset name**, click **“Save preset”**.
   - Later, use **“Load preset…”** to reapply that search.

---

## 3) Example searches to test

**Example 1 – Wedding DJ (Reddit)**  
- Custom search phrase: `wedding dj`  
- Sources: **Reddit** only  
- Max results: `25`  
- Leave include/exclude empty to use pipeline defaults.  
- Click **Run live search**. You should see a mix of Pass and reject reasons.

**Example 2 – Need a DJ (multiple sources)**  
- Custom search phrase: `need a dj`  
- Sources: **Reddit** and **Craigslist**  
- City: `Miami` (optional)  
- Max results: `50`  
- Click **Run live search**.

---

## 4) Compile / runtime errors remaining

- **TypeScript (pre-existing, not from Live Lead Search):**  
  - `client/src/pages/AdminDashboard.tsx` (lines 529 and 539) references `passedFilter` and `highConfidence` on the scraper result. The pipeline only returns `collected`, `filtered`, `classified`, `sourceCounts`. Fix by removing or updating those references in AdminDashboard (or by extending the pipeline return type if you add those fields).
- **Live Lead Search code:** No compile or runtime errors in the Live Lead Search feature itself after the router fixes (saveSearch `filterJson` typing and saveLeadsToGigLeads insert type).

---

## 5) DB migrations or schema changes required

- **None.**  
  Live Lead Search does not add or change tables. It uses:
  - **gigLeads** (existing) when you click “Save selected” or “Save all passing”.
  - **savedSearches** (existing) for presets, with `filterJson.presetType === "liveSearch"`.
- No new migrations or schema pushes are required to test or use Live Lead Search.

---

## 6) Are results preview-only until I click Save?

- **Yes.**  
  - **Run live search** only queries the live sources (Reddit, Craigslist, Eventbrite), runs the same pipeline (normalization, negative keywords, intent gate, scoring), and returns the results to the UI. **Nothing is written to the database.**
  - Leads are written to **gigLeads** only when you click:
    - **“Save selected … to gigLeads”**, or  
    - **“Save all passing … to gigLeads”**.  
  - Saving skips rows that already exist (same `externalId`). So the table is purely a preview until you choose to save.
