# API Documentation

Base URL: `http://localhost:5000`
Auth: `Authorization: Bearer <JWT>` — obtained from login/register.
All bodies are JSON. Errors return `{ "error": "message" }` with 4xx/5xx.

## Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | – | `{status, database, ai}` |

## Authentication

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/api/auth/register` | – | `{username, email, password}` | username 3-32 `[a-zA-Z0-9_]`, password ≥ 8. Returns `{token, user}` (201) |
| POST | `/api/auth/login` | – | `{username\|email, password}` | Returns `{token, user}` with stats |
| GET | `/api/auth/me` | ✔ | – | Current profile + stats |
| POST | `/api/auth/forgot-password` | – | `{email}` | Always 200 (no enumeration). Emails a 1-hour reset link; without SMTP the token is logged server-side |
| POST | `/api/auth/reset-password` | – | `{token, password}` | |

Rate limits: register 10/min, login 15/min, forgot 5/5min per IP.

## Saves

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/saves` | ✔ | List all slots (no state payload) |
| GET | `/api/saves/<slot>` | ✔ | Full save incl. `state_json` |
| PUT | `/api/saves/<slot>` | ✔ | `{room_id, state_json, save_type?, playtime_s?}` — slot 0-8, state ≤ 256 KB |
| DELETE | `/api/saves/<slot>` | ✔ | |

## Leaderboard

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/leaderboard` | – | Top 50 by score |
| POST | `/api/leaderboard` | ✔ | `{completion_time_s, rooms_cleared, puzzles_solved, hints_used, ending}` → `{entry, rank}`. Score = rooms×1000 + puzzles×250 − time/6 − hints×100 |

## Achievements

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/achievements` | opt | Catalogue; `unlocked` flags when authed |
| POST | `/api/achievements/<code>/unlock` | ✔ | Idempotent — `{unlocked, new}` |

## Analytics & Puzzle History

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/analytics` | opt | `{event_type, session_id?, room_id?, payload?}` (120/min) |
| POST | `/api/puzzles/result` | ✔ | `{room_id, puzzle_type, difficulty, solved, solve_time_s, hints_used, ai_generated}` → updates skill rating, returns `{skill_rating}` |

## Settings Sync

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/settings` | ✔ | `{settings}` |
| PUT | `/api/settings` | ✔ | `{settings: {…}}` (≤ 16 KB) |

## AI

All AI endpoints work without an OpenAI key (procedural fallback) and log to
`ai_logs`. `provider` in the response is `openai` or `fallback`.

### POST `/api/ai/puzzle` (30/min)
```json
{ "theme": "library", "room_id": "haunted_library", "context": "optional" }
```
Response (one of three types):
```json
{ "type": "keypad", "title": "...", "narrative": "...", "code": "2987", "clue": "...", "difficulty": 0.45, "provider": "fallback" }
{ "type": "riddle", "riddle": "...", "answer": "echo", ... }
{ "type": "sequence", "sequence": ["moon","eye","key"], "clue": "...", ... }
```
Difficulty is computed server-side: room base blended with the player's skill rating.

### POST `/api/ai/hint` (20/min)
```json
{ "puzzle": { …puzzle object… }, "tier": 0 }
```
Tier 0 = cryptic, 1 = clear, 2 = near-answer. → `{ "hint": "..." }`

### POST `/api/ai/dialogue` (30/min)
```json
{ "npc": "The Librarian", "theme": "library", "message": "who are you?", "history": [{"role":"user","content":"..."}] }
```
→ `{ "line": "...", "mood": "ominous" }`

### POST `/api/ai/story` (20/min)
```json
{ "theme": "temple", "progress": { "rooms_cleared": 2 } }
```
→ `{ "text": "..." }`

## Admin (role = admin)

Served at `/admin/` (dashboard UI). JSON endpoints:

| Method | Path | Description |
|---|---|---|
| GET | `/admin/api/stats` | KPI cards + daily event counts |
| GET | `/admin/api/users?page=&q=` | Paginated user search |
| POST | `/admin/api/users/<id>/toggle` | Enable/disable account |
| GET | `/admin/api/rooms` | Room metadata |
| POST | `/admin/api/rooms/<key>` | `{enabled?, base_difficulty?}` |
| GET | `/admin/api/puzzle-analytics` | Per room/type solve stats |
| GET | `/admin/api/leaderboard` | Top 100 |
| GET | `/admin/api/ai-logs?page=` | AI request log |
| GET | `/admin/api/events?page=&type=` | Analytics event stream |
