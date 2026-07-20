# Database Schema & ER Diagram

The server uses SQLAlchemy ORM. MySQL in production (utf8mb4), SQLite in
zero-config development — the schema is identical.

## ER Diagram

```
                    ┌─────────────────────┐
                    │       users         │
                    │─────────────────────│
                    │ id            PK    │
                    │ username      UQ    │
                    │ email         UQ    │
                    │ password_hash       │
                    │ role                │
                    │ skill_rating        │◄─── adaptive difficulty
                    │ puzzles_solved      │
                    │ puzzles_failed      │
                    │ hints_used          │
                    │ avg_solve_time_s    │
                    │ total_playtime_s    │
                    │ is_active           │
                    └──────────┬──────────┘
          ┌────────────┬───────┼──────────┬─────────────┬──────────┐
          │ 1:N        │ 1:N   │ 1:N      │ 1:N         │ 1:1      │ 1:N
┌─────────▼──────┐ ┌───▼────────────┐ ┌──▼──────────┐ ┌─▼─────────────┐ ┌─▼──────────┐
│  game_saves    │ │ user_achieve-  │ │ leaderboard │ │ user_settings │ │ password_  │
│────────────────│ │ ments          │ │─────────────│ │───────────────│ │ resets     │
│ id        PK   │ │────────────────│ │ id      PK  │ │ id        PK  │ │────────────│
│ user_id   FK   │ │ id        PK   │ │ user_id FK  │ │ user_id FK UQ │ │ id    PK   │
│ slot           │ │ user_id   FK   │ │ username    │ │ settings_json │ │ user_id FK │
│ save_type      │ │ achievement_id │ │ score   IX  │ └───────────────┘ │ token  UQ  │
│ room_id        │ │           FK   │ │ completion_ │                   │ expires_at │
│ playtime_s     │ │ unlocked_at    │ │   time_s IX │                   │ used       │
│ state_json     │ │ UQ(user,ach)   │ │ rooms_      │                   └────────────┘
│ UQ(user,slot)  │ └───────┬────────┘ │   cleared   │
└────────────────┘         │ N:1      │ ending      │
                  ┌────────▼───────┐  └─────────────┘
                  │  achievements  │
                  │────────────────│      ┌──────────────────┐  ┌─────────────────┐
                  │ id        PK   │      │ analytics_events │  │  puzzle_history │
                  │ code      UQ   │      │──────────────────│  │─────────────────│
                  │ title          │      │ id          PK   │  │ id         PK   │
                  │ description    │      │ user_id     FK?  │  │ user_id    FK   │
                  │ icon           │      │ session_id  IX   │  │ room_id         │
                  │ points         │      │ event_type  IX   │  │ puzzle_type     │
                  │ secret         │      │ room_id          │  │ difficulty      │
                  └────────────────┘      │ payload_json     │  │ solved          │
                                          │ created_at  IX   │  │ solve_time_s    │
┌────────────────┐  ┌────────────────┐    └──────────────────┘  │ hints_used      │
│     rooms      │  │    ai_logs     │                          │ ai_generated    │
│────────────────│  │────────────────│                          └─────────────────┘
│ id        PK   │  │ id        PK   │
│ room_key  UQ   │  │ user_id   FK?  │
│ name           │  │ kind           │  kind: puzzle|hint|dialogue|story
│ theme          │  │ provider       │  provider: openai|fallback
│ order_index    │  │ model          │
│ story          │  │ prompt_summary │
│ base_difficulty│  │ response_json  │
│ enabled        │  │ latency_ms     │
└────────────────┘  │ success, error │
                    └────────────────┘
```

## Table Notes

### users
- `password_hash` — bcrypt, 12 rounds.
- `skill_rating` ∈ [0,1] — exponential moving average updated by
  `services/difficulty.py` after every puzzle result. Drives AI puzzle difficulty.

### game_saves
- One row per (user, slot). Slot 0 is the autosave; 1–8 are manual.
- `state_json` holds the full serialized client state (≤ 256 KB enforced).

### leaderboard
- `username` denormalized for read-heavy top-50 queries.
- `score`, `completion_time_s` indexed for ranking.

### analytics_events
- Append-only. `event_type` examples: `session_started`, `room_entered`,
  `puzzle_solved`, `puzzle_failed`, `hint_requested`, `item_collected`,
  `secret_found`, `ending_reached`.

### ai_logs
- Full audit trail of every AI request for the admin dashboard, including
  fallback generations and OpenAI failures (with error text).

## MySQL Setup

```sql
CREATE DATABASE escape_room CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'escape'@'%' IDENTIFIED BY 'strong-password-here';
GRANT ALL PRIVILEGES ON escape_room.* TO 'escape'@'%';
```

Then in `.env`:
```
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=escape_room
MYSQL_USERNAME=escape
MYSQL_PASSWORD=strong-password-here
```

`npm run setup:db` creates all tables via `db.create_all()`; the engine uses
`pool_pre_ping` + `pool_recycle=280` for long-lived MySQL connections.
