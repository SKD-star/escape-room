# Architecture — AI Powered Escape Room

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                            BROWSER (client/)                         │
│                                                                      │
│  ┌────────────┐  ┌──────────────────────────────────────────────┐   │
│  │  UI Layer  │  │                GAME ENGINE                    │   │
│  │ (HTML/CSS/ │  │  ┌─────────┐ ┌──────────┐ ┌──────────────┐   │   │
│  │  GSAP)     │  │  │ Renderer│ │ Physics  │ │ Audio Engine │   │   │
│  │            │  │  │ Three.js│ │ Rapier   │ │ WebAudio/    │   │   │
│  │ MainMenu   │  │  │ + post- │ │ (WASM)   │ │ WebAudio     │   │   │
│  │ HUD        │◄─┼─►│ process │ └──────────┘ └──────────────┘   │   │
│  │ Inventory  │  │  └─────────┘ ┌──────────┐ ┌──────────────┐   │   │
│  │ Settings   │  │  ┌─────────┐ │ Player   │ │ Room Manager │   │   │
│  │ PauseMenu  │  │  │ Asset   │ │Controller│ │ (10 rooms)   │   │   │
│  │ Dialogue   │  │  │ Manager │ └──────────┘ └──────────────┘   │   │
│  └────────────┘  │  └─────────┘ ┌──────────┐ ┌──────────────┐   │   │
│        ▲         │              │ Puzzle   │ │ Save Manager │   │   │
│        │EventBus │              │ Engine   │ │              │   │   │
│        ▼         │              └──────────┘ └──────────────┘   │   │
│  ┌────────────────────────────────────────────────────────────┐ │   │
│  │                     API Client (fetch + JWT)                │ │   │
│  └────────────────────────────────────────────────────────────┘ │   │
└─────────────────────────────┬────────────────────────────────────────┘
                              │ REST /api/*  (JSON, JWT auth)
┌─────────────────────────────▼────────────────────────────────────────┐
│                         FLASK SERVER (server/)                       │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌───────────────────────┐  │
│  │ Auth API │ │ Game API │ │ Admin UI  │ │  AI Service           │  │
│  │ register │ │ saves    │ │ dashboard │ │  OpenAI w/ procedural │  │
│  │ login    │ │ leaderbd │ │ users     │ │  fallback generator   │  │
│  │ JWT      │ │ achieve  │ │ analytics │ │  puzzles/hints/story  │  │
│  │ forgot pw│ │ analytics│ │ AI logs   │ │  adaptive difficulty  │  │
│  └──────────┘ └──────────┘ └───────────┘ └───────────┬───────────┘  │
│  ┌────────────────────────────────────────┐          │              │
│  │        SQLAlchemy ORM                  │          ▼              │
│  └───────────────────┬────────────────────┘   OpenAI API (optional) │
└──────────────────────┼───────────────────────────────────────────────┘
                       ▼
        MySQL (production) / SQLite (zero-setup dev fallback)
```

## Design Principles

1. **Offline-first** — every cloud feature (AI, saves, auth) has a local
   fallback so the game is playable with zero configuration.
2. **Event-driven** — a global `EventBus` decouples UI ↔ engine ↔ systems.
   No system imports another system directly; they communicate via events.
3. **Component architecture** — rooms, puzzles, props and particles are
   pluggable classes registered in factories.
4. **Procedural everything** — geometry, materials, textures and audio are
   generated in code (no copyrighted assets, tiny download size). GLTF/GLB
   loading is fully supported for drop-in asset upgrades.
5. **Quality tiers** — Low/Medium/High/Ultra presets scale postprocessing,
   shadows, particles and resolution.

## Client Module Map (`client/src/`)

| Module        | Responsibility |
|---------------|----------------|
| `core/`       | Engine, Renderer, AssetManager, EventBus, GameLoop, QualityManager, PhotoMode |
| `player/`     | FPSController, InteractionSystem, ObjectInspector, Flashlight, SanitySystem, HauntSystem, LevelTimer (room countdown), SpeedrunTimer, GamepadInput |
| `world/`      | RoomManager, 10 room classes, HauntSystem, props, materials, particles, lighting rigs |
| `puzzles/`    | PuzzleManager + typed puzzles (keypad, riddle, symbols, wiring, …) |
| `inventory/`  | Inventory model + UI + item combination |
| `audio/`      | AudioEngine (3D positional, procedural synth ambience) |
| `ai/`         | AIClient (talks to server AI endpoints, local fallback) |
| `save/`       | SaveManager (localStorage + cloud sync) |
| `ui/`         | Screen manager, all menus/HUD, in-game Field Manual, Journal, Stats, per-level briefing card |
| `net/`        | ApiClient (fetch wrapper w/ JWT) |
| `utils/`      | Math helpers, logger, device detection |
| `config/`     | Game constants, quality presets, room definitions (per-room `par`/`brief`/`tip`), difficulty modes |

## Server Module Map (`server/`)

| Module            | Responsibility |
|-------------------|----------------|
| `app.py`          | App factory, blueprint registration, CORS |
| `config.py`       | Env-driven config (MySQL → SQLite fallback) |
| `extensions.py`   | db, login_manager singletons |
| `models/`         | User, Save, Achievement, LeaderboardEntry, AnalyticsEvent, PuzzleRecord, AILog, PuzzleBank, RoomMeta, UserSetting |
| `api/`            | auth, saves, leaderboard, achievements, analytics, ai, settings blueprints |
| `services/`       | ai_service (OpenAI + fallback, prefers authored PuzzleBank), difficulty engine, email service |
| `admin/`          | Server-rendered admin dashboard (Jinja2): room add/edit/reorder/delete, puzzle bank CRUD, live-player monitor, stats, analytics, AI logs, event stream, leaderboard moderation |
| `scripts/`        | init_db, seed, create_admin (run via `scripts/py.js`, a cross-platform venv launcher) |

## Data Flow: AI Puzzle Generation

```
Player enters room → RoomManager fires `room:entered`
 → PuzzleManager requests puzzle → AIClient POST /api/ai/puzzle
   { room_theme, difficulty, player_stats }
 → ai_service: OPENAI_API_KEY set?  → OpenAI JSON-mode completion
                              else  → authored PuzzleBank entry (admin-written,
                                       matched to theme + difficulty) if present,
                                       otherwise the procedural template generator
 → response validated against puzzle schema → logged to ai_logs
 → PuzzleManager instantiates typed puzzle → props wired in 3D scene
```

## Server-driven Campaign

The playable room list is authoritative on the server. On New Game / Continue
the client calls `GET /api/rooms` (public) for the admin-defined order and
enabled set, and plays it via `config/campaign.js`. Built-in keys reuse their
rich static data (chapter, par, briefing); admin-authored custom rooms are
synthesized and played in the 3D environment of their theme (RoomManager's
`THEME_CLASSES` map). If the server is unreachable, the client falls back to its
built-in 10-room list, so offline play is unaffected. Reordering, enabling,
disabling or adding rooms in the admin therefore changes the real campaign the
next time a player starts.

## Room Countdown (LevelTimer)

On Normal and Nightmare a per-room clock runs, its limit = `ROOMS[key].par ×
difficulty.countdown.mult`, so it scales per level and per difficulty. It keeps
ticking while the puzzle modal is open (pausing only in menus / notes /
dialogue). On **Normal** timeout is soft (overtime drains sanity); on
**Nightmare** timeout is a hard deadline — the current room reloads fresh
(`Game.failRoom()`), while cleared rooms are untouched. Story has no clock. The
whole feature is toggleable via the `countdownTimer` setting.

## Adaptive Difficulty

Server keeps rolling stats per user (solve time, hint count, failures).
`difficulty_engine.compute(user)` returns 0.0–1.0; both the AI prompt and
procedural generator scale puzzle complexity from it.

## Security

- Passwords: bcrypt (12 rounds)
- Sessions: JWT access tokens (24 h), HttpOnly-safe usage from client
- All inputs validated server-side; SQLAlchemy ORM prevents injection
- Secrets only via environment (`.env` git-ignored)
- Admin routes require `role == 'admin'`
- Rate limiting on auth + AI endpoints (in-memory limiter)
