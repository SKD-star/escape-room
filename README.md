# 🗝 AI Powered Escape Room

A browser-based 3D horror escape room game with **AI-generated puzzles**, adaptive
difficulty, spectral NPC dialogue, and ten hand-crafted haunted environments —
built with Three.js, Rapier physics, Flask, SQLAlchemy and the OpenAI API.

> Final Year Project — every asset is generated procedurally in code.
> No copyrighted material. Fully playable offline with zero configuration.

---

## ✨ Highlights

| | |
|---|---|
| 🎮 **10 unique rooms** | Haunted Library → Ancient Temple → Prison → Laboratory → Hospital → Mansion → Castle → Bunker → Cyber AI Facility → Final Convergence |
| 🤖 **AI everywhere** | OpenAI-generated puzzles, tiered hints, free-text ghost dialogue, story beats — with a full procedural fallback when no API key is set |
| 📈 **Adaptive difficulty** | Server-side skill rating (EMA over solve time / hints / failures) scales every generated puzzle |
| 🔦 **Flashlight survival** | Battery-managed beam with weighty hand-lag, low-charge stutter, and spectral interference |
| 🧠 **Sanity system** | Darkness and the presence erode your grip — post-FX distortion, quickening heartbeat, intruding whispers; light and solved puzzles restore it |
| 👁 **The Presence** | A stalking entity that manifests between puzzles, hunts in the dark, and dissolves under a steady beam — sprinting attracts it, crouching keeps you quiet |
| 🎚 **3 difficulty modes** | Story (no presence, no clock) · Normal · Nightmare (relentless, ×1.5 score) — multipliers enforced server-side |
| ⏳ **Room countdown timer** | Per-room clock on Normal/Nightmare, scaled per level. Normal = soft overtime (sanity bleed); **Nightmare = hard deadline that restarts the room**. Off in Story / Settings |
| 📖 **In-game Field Manual** | A tabbed manual (Controls · Survival · Puzzles · Chapters · Tips) plus a per-level **briefing card** on entry — open any time from the menu or pause |
| 🎯 **Objective markers** | A **gold diamond** floats over each room's puzzle; solve it and a **green diamond** lights the exit — you always know where to go |
| 🎪 **Aim assist** | Generous hitboxes + crosshair assist make keys, notes and batteries easy to grab — no pixel-hunting |
| 📔 **Journal** | Every note you read is collected per-room, browsable any time (`J`) |
| 🧭 **HUD extras** | Compass tape, speedrun timer with per-room PB splits, sound captions (accessibility) |
| 📊 **Lifetime statistics** | Every solve, scare, banish and ending tracked across sessions |
| 📸 **Photo mode** | `P` captures a clean HUD-free PNG of the current frame |
| 🎮 **Gamepad support** | Full standard-mapping controller play: sticks, zoom trigger, rumble-free |
| 🕹 **Real FPS controller** | Rapier kinematic character: walk/run/crouch/jump, stamina, head bob, strafe lean, landing weight, sprint FOV kick, RMB focus zoom, breathing, camera shake |
| 🎨 **Cinematic rendering** | PBR + HDR pipeline, ACES tone mapping, bloom, SSAO, chromatic aberration, film grain, vignette, volumetric-style fog, procedural PBR textures — tuned bright & crisp (no depth-of-field blur by default) |
| 🔊 **Procedural audio** | Every sound is synthesized in WebAudio — drones, wind, per-surface footsteps (wood/stone/tile/metal), whispers, thunder, heartbeat, scare stings |
| 💾 **Save system** | Autosave, checkpoints, 3 manual slots — local-first with cloud sync when signed in |
| 🏆 **Meta systems** | Achievements, leaderboard, multiple endings, secret rooms, inventory with item combination |
| 🛠 **Admin dashboard** | Add/edit/reorder/delete rooms, author a live puzzle bank, monitor active players, tune difficulty, puzzle analytics, AI logs, event stream, and leaderboard moderation (delete a run or reset all) |

## 🚀 Quick Start (zero configuration)

```bash
# 1. Install dependencies
npm install
python -m venv venv
venv\Scripts\pip install -r requirements.txt        # Windows
# source venv/bin/activate && pip install -r requirements.txt  # macOS/Linux

# 2. Initialize the database (SQLite by default — no MySQL needed for dev)
npm run setup:db
npm run seed
npm run create:admin        # prompts for an admin password

# 3. Run BOTH servers with one command
npm start                   # Flask API on :5000 + Vite dev server on :3000
```

Open **http://localhost:3000** — the game runs immediately.
Admin dashboard: **http://localhost:5000/admin/**

### 🎮 How to play (first 60 seconds)

1. Click **New Game** → pick a difficulty (**Normal** recommended).
2. After the intro you spawn in the Haunted Library with your **flashlight
   already raised** — press `F` any time to toggle it.
3. Walk (`W A S D`) toward the **floating gold diamond** — that's the room's
   puzzle. When the crosshair turns **gold** and shows `E Interact`, press `E`.
4. Solve the puzzle → a **green diamond** appears over the exit door.
   Walk to it, press `E`, and you're on to Chapter II.
5. Along the way: press `E` on notes 📄, keys 🗝 (they shimmer gold) and
   batteries 🔋 to collect them. `Tab` shows your inventory.

> Running the servers separately also works: `npm run server` (Flask) in one
> terminal and `npm run dev` (Vite) in another.

### 🔧 Troubleshooting

| Symptom | Fix |
|---|---|
| `http proxy error: /api/... ECONNREFUSED 127.0.0.1:5000` | The Flask backend isn't running — you launched only `npm run dev`. The game still works fully **offline**; use `npm start` to run both servers. |
| Browser opens **localhost:3001** instead of 3000 | An old copy is holding port 3000. Run `npx kill-port 3000 3001 5000`, then `npm start`, and open **localhost:3000**. |
| Black screen / old version after an update | Hard-refresh once: **`Ctrl + Shift + R`**. |
| Screen very dark | That's the horror mood — press **`F`** for the flashlight, or raise **Settings → Video → Brightness**. |
| Pressing `E` does nothing | Get closer (interact range ≈ 3.4 m) and center the crosshair until it turns **gold** with an `E Interact` label. |
| "To show your cursor, press Esc" bar in Chrome | Normal — that's the browser's mouse-capture notice, not an error. |
| `no such table` errors from the API | Run `npm run setup:db && npm run seed`. |
| `'vite' is not recognized` / missing modules | Run `npm install`. |

### Automated smoke test

With the game running (`npm start`), verify everything end-to-end:

```bash
node scripts/smoke.js     # boots the game in headless Chrome, reports errors
```

### Optional: enable real AI

```bash
cp .env.example .env
# set OPENAI_API_KEY=sk-...   (https://platform.openai.com/api-keys)
```

Without a key the built-in procedural generator produces all puzzles, hints and
dialogue — the game is fully playable either way.

### Optional: MySQL instead of SQLite

**Using XAMPP (already configured on this machine):**

1. Start MySQL from the **XAMPP Control Panel** (or run `C:\xampp\mysql_start.bat`).
2. The database `escape_room` and the `.env` config (host `127.0.0.1`, user
   `root`, empty password) are already set up — `npm start` connects
   automatically. Verify with http://localhost:5000/api/health →
   `"database": "mysql+pymysql"`.
3. Browse the data in phpMyAdmin: http://localhost/phpmyadmin →
   `escape_room` → `users`, `game_saves`, `leaderboard`…

**From scratch on another machine:** set `MYSQL_HOST`, `MYSQL_DATABASE`,
`MYSQL_USERNAME`, `MYSQL_PASSWORD` in `.env`, create the database
(`CREATE DATABASE escape_room CHARACTER SET utf8mb4;`), then run
`npm run setup:db && npm run seed`.

> ⚠️ If MySQL (XAMPP) is **not running**, the server falls back to SQLite
> automatically — the game still works, but accounts created in MySQL won't
> be visible until MySQL is back.

## 🎮 Controls

| Key | Action |
|---|---|
| `W A S D` | Move |
| Mouse | Look |
| RMB (hold) | Focus zoom |
| `Shift` | Sprint (stamina) |
| `C` | Crouch |
| `Space` | Jump |
| `E` | Interact / pick up / read |
| `R` | Reset held item rotation |
| `F` | Flashlight (throws instead while holding an item) |
| `Tab` | Inventory |
| `J` | Journal |
| `P` | Photo mode (saves a PNG) |
| `F5` | Quick save |
| `F9` | Quick load |
| `Esc` | Pause |

Gamepad (standard mapping): left stick move · right stick look · `A` jump ·
`B` crouch · `X` interact · `Y` flashlight · `LT` zoom · `RB` sprint ·
`Start` pause · `Back` inventory.

## 📁 Project Structure

```
client/               Frontend (Vite + Three.js)
  src/core/           Engine, renderer+postprocessing, physics, events, perf guard
  src/player/         FPS controller, interaction/inspection system
  src/world/          10 rooms, prop factory, procedural materials, particles
  src/puzzles/        AI puzzle manager (keypad / riddle / sequence)
  src/inventory/      Items, combination recipes
  src/audio/          Procedural WebAudio engine
  src/ai/             AI client with local fallback
  src/save/           Save manager (local + cloud)
  src/ui/             Screens: menu, HUD, settings, dialogue, endings…
server/               Backend (Flask + SQLAlchemy)
  models/             Users, saves, achievements, leaderboard, analytics, AI logs
  api/                auth / game / ai blueprints (JWT, rate limiting)
  services/           OpenAI + fallback generator, adaptive difficulty, email
  admin/              Admin dashboard (dark-themed SPA)
  scripts/            init_db, seed, create_admin
docs/                 Architecture, API docs, DB schema, deployment, report
```

## 📚 Documentation

- **[📖 User Manual — how to play](USER_MANUAL.md)** *(no spoilers)*
- **[🎮 Walkthrough — clear all 10 levels](WALKTHROUGH.md)** *(spoilers!)*
- **[💻 Setup on another laptop](SETUP_NEW_LAPTOP.md)** — from-zero install guide
- [Architecture](docs/ARCHITECTURE.md)
- [Installation Guide](docs/INSTALLATION.md)
- [API Documentation](docs/API.md)
- [Database Schema + ER Diagram](docs/DATABASE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Project Report](docs/PROJECT_REPORT.md)

## 🧪 Production build

```bash
npm run build         # outputs client/dist/
```

Serve `client/dist/` from any static host and point `/api` at the Flask server
(see the deployment guide for Docker / nginx setups).

## ⚖️ License & Assets

MIT. All 3D models, textures and audio are **generated procedurally at
runtime** — no third-party assets are shipped. Optional GLB/HDR drop-in
upgrades are supported via `client/public/assets/` (use CC0 sources like
polyhaven.com, kenney.nl, quaternius.com).
