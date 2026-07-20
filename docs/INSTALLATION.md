# Installation Guide

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | ≥ 20 | https://nodejs.org |
| Python | ≥ 3.11 | https://python.org |
| Git | any | optional, for cloning |
| MySQL | 8.x | **optional** — SQLite is used automatically when unset |
| OpenAI key | – | **optional** — procedural fallback otherwise |

A GPU-capable browser with **WebGL 2** (Chrome, Edge, Firefox, Safari 15+).

## Step-by-Step

### 1. Get the code
```bash
git clone <your-repo-url> escape-room
cd escape-room
```

### 2. Frontend dependencies
```bash
npm install
```

### 3. Python environment
```bash
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 4. Configuration
```bash
cp .env.example .env
```
Generate secrets and paste them into `.env`:
```bash
python -c "import secrets; print('SECRET_KEY=' + secrets.token_hex(32)); print('JWT_SECRET_KEY=' + secrets.token_hex(32))"
```
Everything else in `.env` is optional (see comments in the file).

### 5. Database
```bash
npm run setup:db      # create tables (SQLite file by default)
npm run seed          # 10 rooms + 12 achievements
npm run create:admin  # interactive admin account creation
```

### 6. Run
Two terminals:
```bash
npm run server        # Flask API  → http://localhost:5000
npm run dev           # Game       → http://localhost:3000
```

### 7. Verify
- Game: http://localhost:3000 → main menu appears, New Game starts in the Haunted Library.
- API: `curl http://localhost:5000/api/health` → `{"status": "ok"}`
- Admin: http://localhost:5000/admin/ → sign in with the admin account.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `WebGL 2 Required` screen | Update your browser / enable hardware acceleration |
| API requests fail in game | Ensure Flask is running on :5000 (the Vite proxy targets it). The game still works offline. |
| `pip install` fails on `bcrypt` | Upgrade pip: `python -m pip install -U pip` |
| MySQL `Access denied` | Check `MYSQL_*` values; test with `mysql -u <user> -p` |
| Port 3000/5000 taken | `npm run dev -- --port 3001` / set `PORT=5001` in `.env` |
| Low FPS | The built-in performance guard auto-lowers quality; or set Settings → Video → Graphics Quality to Low |

## Optional Services

| Service | Enables | Setup |
|---|---|---|
| OpenAI | Real AI puzzles/hints/dialogue | `OPENAI_API_KEY` in `.env` — https://platform.openai.com/api-keys |
| SMTP | Forgot-password emails | `EMAIL_HOST/PORT/USERNAME/PASSWORD` (e.g. Gmail app password) |
| MySQL | Production database | `MYSQL_*` variables + `CREATE DATABASE escape_room` |
| Gemini / HuggingFace / ElevenLabs / Cloudinary / Firebase / OAuth | Reserved extension points | Keys accepted in `.env`; not required by any core feature |
