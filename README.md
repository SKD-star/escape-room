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
| 🕹 **Real FPS controller** | Rapier kinematic character: walk/run/crouch/jump, stamina, head bob, breathing, camera shake |
| 🎨 **Cinematic rendering** | PBR + HDR pipeline, ACES tone mapping, bloom, SSAO, DOF, chromatic aberration, film grain, vignette, volumetric-style fog, procedural PBR textures with derived normal maps |
| 🔊 **Procedural audio** | Every sound is synthesized in WebAudio — drones, wind, footsteps, whispers, thunder, heartbeat |
| 💾 **Save system** | Autosave, checkpoints, 3 manual slots — local-first with cloud sync when signed in |
| 🏆 **Meta systems** | Achievements, leaderboard, multiple endings, secret rooms, inventory with item combination |
| 🛠 **Admin dashboard** | Users, room tuning, puzzle analytics, AI logs, live event stream |

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

# 3. Run both servers
npm run server              # Flask API on :5000
npm run dev                 # Vite dev server on :3000 (proxies /api)
```

Open **http://localhost:3000** — the game runs immediately.
Admin dashboard: **http://localhost:5000/admin/**

### Optional: enable real AI

```bash
cp .env.example .env
# set OPENAI_API_KEY=sk-...   (https://platform.openai.com/api-keys)
```

Without a key the built-in procedural generator produces all puzzles, hints and
dialogue — the game is fully playable either way.

### Optional: MySQL instead of SQLite

Set `MYSQL_HOST`, `MYSQL_DATABASE`, `MYSQL_USERNAME`, `MYSQL_PASSWORD` in `.env`,
create the database (`CREATE DATABASE escape_room CHARACTER SET utf8mb4;`),
then re-run `npm run setup:db && npm run seed`.

## 🎮 Controls

| Key | Action |
|---|---|
| `W A S D` | Move |
| Mouse | Look |
| `Shift` | Sprint (stamina) |
| `C` | Crouch |
| `Space` | Jump |
| `E` | Interact / pick up / read |
| `R` | Reset held item rotation |
| `F` | Throw held item |
| `Tab` | Inventory |
| `F5` | Quick save |
| `Esc` | Pause |

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
