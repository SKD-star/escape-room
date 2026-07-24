# 💻 SETUP ON ANOTHER LAPTOP — Step-by-Step Guide

This guide takes a **brand-new laptop with nothing installed** to a fully
running game. Works on Windows, macOS and Linux (commands shown for each).

**Time needed:** ~15 minutes + download time.

---

## Step 0 — What you need to install first

| Software | Version | Download |
|---|---|---|
| **Node.js** | 20 or newer | https://nodejs.org (click the big green LTS button) |
| **Python** | 3.11 or newer | https://python.org/downloads |
| **Git** | any | https://git-scm.com/downloads *(only needed for Option A below)* |

> **Windows Python installer:** ✅ tick **"Add python.exe to PATH"** on the
> first screen of the installer — this matters!

Verify everything installed — open a terminal (Windows: press `Win`, type
`cmd`, Enter) and run:

```bash
node --version     # should print v20.x or higher
npm --version      # should print 10.x or higher
python --version   # should print 3.11+  (on macOS/Linux try: python3 --version)
```

If any command says "not recognized", reinstall that program and restart the
terminal.

---

## Step 1 — Copy the project to the new laptop

**Option A — with Git (if the project is on GitHub):**
```bash
git clone <your-repo-url> escape-room
cd escape-room
```

**Option B — with a USB drive / zip (simplest):**
1. On the OLD laptop, copy the whole `game` folder to a USB stick,
   **BUT SKIP these folders** (they are huge and will be regenerated):
   - `node_modules/`  ← 400+ MB, do NOT copy
   - `venv/`          ← do NOT copy (Python venvs don't survive moving)
   - `client/dist/`   ← optional build output, skip
2. Paste the folder anywhere on the new laptop (e.g. `Desktop\escape-room`).
3. Open a terminal **inside that folder**:
   - Windows: open the folder in Explorer, click the address bar, type `cmd`, Enter.
   - macOS: right-click folder → *New Terminal at Folder*.

> 💡 Copying the `server/escape_room.db` file **brings your save data,
> accounts and leaderboard with you**. Skip it if you want a fresh start.

---

## Step 2 — Install the JavaScript packages

In the project folder:

```bash
npm install
```

Wait for it to finish (1–3 minutes). This recreates `node_modules/`.

---

## Step 3 — Create the Python environment

**Windows (cmd):**
```bat
python -m venv venv
venv\Scripts\pip install -r requirements.txt
```

**macOS / Linux:**
```bash
python3 -m venv venv
venv/bin/pip install -r requirements.txt
```

This installs Flask, SQLAlchemy, the OpenAI SDK, bcrypt, JWT, etc. (~1 minute).

---

## Step 4 — Configuration file (optional but recommended)

```bash
# Windows
copy .env.example .env
# macOS / Linux
cp .env.example .env
```

Generate two secret keys and paste them into `.env`:

```bash
# Windows
venv\Scripts\python -c "import secrets; print('SECRET_KEY=' + secrets.token_hex(32)); print('JWT_SECRET_KEY=' + secrets.token_hex(32))"
# macOS / Linux
venv/bin/python -c "import secrets; print('SECRET_KEY=' + secrets.token_hex(32)); print('JWT_SECRET_KEY=' + secrets.token_hex(32))"
```

Open `.env` in Notepad and replace the empty `SECRET_KEY=` and
`JWT_SECRET_KEY=` lines with the printed ones.

**Everything else in `.env` is OPTIONAL:**
- `OPENAI_API_KEY=` → real AI puzzles (get a key at
  https://platform.openai.com/api-keys). **Leave empty and the game still
  works** — it uses its built-in offline puzzle generator.
- `MYSQL_HOST=` → leave empty to use the zero-setup SQLite database.

> If you skip this step entirely the game still runs — the server
> auto-generates temporary keys (logins just won't survive a server restart).

---

## Step 5 — Create the database

*(Skip this step if you copied `server/escape_room.db` from the old laptop.)*

```bash
npm run setup:db      # creates all tables
npm run seed          # loads the 10 rooms + 12 achievements
npm run create:admin  # creates the admin account (asks you for a password, min 8 chars)
```

You should see:
```
[OK] Database ready: sqlite:///.../server/escape_room.db
[OK] Seeded 10 rooms, 13 achievements, 5 bank puzzles
[OK] Admin user 'admin' created
```

---

## Step 6 — RUN THE GAME 🎮

You need **two terminals open at the same time** (both in the project folder):

**Terminal 1 — the backend:**
```bash
npm run server
```
Leave it running. You'll see `Running on http://127.0.0.1:5000`.

> The `npm run …` Python scripts (`server`, `setup:db`, `seed`, `create:admin`)
> auto-detect the venv interpreter and work on Windows, macOS and Linux.
> One-command alternative: **`npm start`** launches the backend and the game
> together in a single terminal.

**Terminal 2 — the game:**
```bash
npm run dev
```
Leave it running too. You'll see `Local: http://localhost:3000/`.

**Now open Chrome or Edge and go to:**

## ➡ http://localhost:3000

Click **New Game** and play. 🗝

- Admin dashboard: http://localhost:5000/admin/ (your admin login from Step 5)
- To stop: press `Ctrl+C` in each terminal (or just close them).
- To play again later: repeat Step 6 only — everything else is one-time setup.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `'node' is not recognized` | Node.js not installed or terminal not restarted after install |
| `'python' is not recognized` (Windows) | Reinstall Python, tick **Add to PATH**; or try `py` instead of `python` |
| `npm install` errors | Delete the `node_modules` folder and `package-lock.json`, run `npm install` again |
| Port already in use | Another program uses 3000/5000. Game: `npm run dev -- --port 3001`. Server: put `PORT=5001` in `.env` |
| Page loads but "WebGL 2 Required" | Use Chrome/Edge/Firefox; enable hardware acceleration in browser settings |
| Menu clicks do nothing | Hard-refresh the page: `Ctrl+Shift+R` |
| Game works but login/leaderboard fail | Terminal 1 (backend) isn't running — the game still works offline |
| `'venv' is not recognized` / admin page won't load | The backend didn't start. Run `npm run server` (or `npm start`) in its own terminal, then open http://localhost:5000/admin/ |
| `pip install` fails on bcrypt | `venv\Scripts\python -m pip install --upgrade pip` then retry Step 3 |
| Antivirus blocks something | Allow Node.js and Python in your antivirus/firewall (local-only servers) |

## Quick-Reference Card (after first setup)

```
cd <project-folder>
npm run server        ← terminal 1, keep open
npm run dev           ← terminal 2, keep open
→ http://localhost:3000
```

That's it. Happy escaping! 🚪👻
