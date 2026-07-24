# 🚀 Permanent Hosting Guide

Get a **permanent public link** that works even when your PC is off:

- **Game (frontend)** → **Netlify** (free, drag-and-drop)
- **Backend (accounts, leaderboard, admin)** → **Render** (free)
- Netlify **proxies** `/api` and `/admin` to Render, so everything is one URL.

You can stop after **Part 1** for a permanent *single-player* link (no accounts),
or do **Part 2 + 3** for the full online experience.

---

## Part 1 — Game live on Netlify (5 minutes, no accounts needed)

1. Build the site (already done for you, but to rebuild):
   ```bash
   npm run build
   ```
   This creates the **`client/dist`** folder.
2. Go to **https://app.netlify.com/drop**
3. **Drag the `client/dist` folder** onto the page.
4. You instantly get a permanent URL like `https://random-name-123.netlify.app`.
   - Optional: click **"Sign up"** (free) to keep it forever and rename it.

✅ That link is your permanent game — plays fully offline on any phone/computer.

---

## Part 2 — Backend on Render (accounts + leaderboard + admin)

Render deploys from GitHub, so first put the project on GitHub.

### 2a. Push the project to GitHub
1. Create a free account at https://github.com and click **New repository**
   (name it e.g. `escape-room`, keep it **empty** — no README).
2. In the project folder, run (replace the URL with yours):
   ```bash
   git add -A
   git commit -m "Deploy: hosting config"
   git branch -M main
   git remote add origin https://github.com/<your-username>/escape-room.git
   git push -u origin main
   ```
   (If git asks for your name/email first:
   `git config user.name "You"` and `git config user.email "you@example.com"`.)

### 2b. Create the Render service
1. Sign up at https://render.com (log in with GitHub).
2. Click **New → Blueprint**, pick your `escape-room` repo, click **Apply**.
   Render reads **`render.yaml`** and creates the web service + a free Postgres DB.
3. When prompted (or in the service's **Environment** tab), set:
   - **`ADMIN_PASSWORD`** → your own admin password (min 8 chars).
   - (Optional) **`OPENAI_API_KEY`** → for real AI puzzles; blank uses the offline generator.
4. Wait for the deploy to finish. On first boot the app auto-creates the tables,
   seeds the rooms/achievements, and creates your admin account.
5. Copy your backend URL — it looks like **`https://escape-room-api.onrender.com`**.
6. Verify it: open `https://escape-room-api.onrender.com/api/health` →
   you should see `{"status":"ok","database":"postgresql",...}`.

> ⏱ Free Render services **sleep after ~15 min idle** — the first request then
> takes ~30–60 s to wake up. That's normal on the free tier.

---

## Part 3 — Connect the game to the backend

1. Open **`client/public/_redirects`** and replace **`BACKEND_URL`** (3 places)
   with your Render URL, e.g.:
   ```
   /api/*    https://escape-room-api.onrender.com/api/:splat     200
   /admin    https://escape-room-api.onrender.com/admin/         200
   /admin/*  https://escape-room-api.onrender.com/admin/:splat   200
   ```
2. Rebuild and re-drop:
   ```bash
   npm run build
   ```
   Drag **`client/dist`** onto https://app.netlify.com/drop again (or, if you signed
   up, connect the GitHub repo for automatic deploys).

✅ Now on your Netlify URL:
- **Play** on any phone.
- **Register / log in**, submit runs, and the **leaderboard persists**.
- **Admin dashboard** at `https://<your-site>.netlify.app/admin/`
  (login `admin` / the `ADMIN_PASSWORD` you set).

---

## Notes & limitations (free tier)
- Render web service **sleeps when idle** (~30–60 s cold start on first hit).
- Render's **free Postgres expires after ~90 days** — recreate it (or swap in
  another free database) when it does.
- Your existing **cloudflared tunnel** already gives full online features while
  your PC is on — this permanent setup is for when it's off.
- Prefer not to host the backend? **Part 1 alone** is a permanent offline game link.
