# 🚀 Deployment Guide — AI-Powered 3D Escape Room

This document provides complete instructions for deploying both the **Frontend Web Application (Three.js WebGL)** and the **Backend API Server (Python Flask & OpenAI)** across local environments, cloud hosting platforms (Netlify, Vercel, Render), and containerized Docker environments.

---

## 📋 Prerequisites

Before starting, ensure you have the following software installed:

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Python**: v3.10 or higher
- **Git**: Latest version

---

## 🛠️ 1. Local Development Setup

### A. Frontend Web Client (Three.js + Vite)

1. Clone the repository and navigate to the project directory:
   ```bash
   git clone <your-repository-url>
   cd game
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the local development server:
   ```bash
   npm run dev
   ```
   *The application will launch at `http://localhost:5173`.*

4. Validate production build:
   ```bash
   npm run build
   ```
   *Outputs optimized build files to the `dist/` directory.*

---

### B. Backend API Server (Python Flask + OpenAI)

1. Navigate to the `server/` directory:
   ```bash
   cd server
   ```

2. (Optional but recommended) Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # macOS / Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set your Environment Variables. Copy `.env.example` to `.env` at the repo
   root and fill in your AI key — a **free** OpenRouter key (no credit card)
   is all the Librarian chatbot needs:

   ```bash
   # Grab a key at https://openrouter.ai/keys  ->  sk-or-v1-...
   AI_API_KEY=sk-or-v1-your_free_key_here    # server-side (Flask)
   VITE_AI_KEY=sk-or-v1-your_free_key_here   # browser build (static hosting)
   ```

   `sk-or-…` keys are auto-routed to OpenRouter's $0 model pool; a paid
   `sk-proj-…` OpenAI key works in the same slot. Free models are capped at
   roughly 20 requests/minute and 50/day per key, shared by everyone playing.

5. Seed the local SQLite database:
   ```bash
   python scripts/seed.py
   ```

6. Start the Flask server:
   ```bash
   python app.py
   ```
   *Backend API runs at `http://localhost:5000`.*

> 💡 **Note**: The client automatically features a **built-in procedural offline fallback**. If the backend server or the AI key is unavailable, the game will seamlessly generate puzzles and dialogues locally without throwing errors — the Librarian just switches to its offline voice.

---

## 🌐 2. Cloud Deployment Options

### ⚡ Deploying Frontend to Netlify (Recommended)

1. Connect your GitHub repository to **Netlify**.
2. Set the following build settings:
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
3. Under **Site settings → Environment variables**, add:
   - `VITE_AI_KEY`: your free `sk-or-v1-…` key from https://openrouter.ai/keys

   Without it the Librarian still talks, but only through its offline voice —
   there is no backend on Netlify, so the browser needs its own key. The value
   is compiled into the public JS bundle, so use a **free, zero-spend key only**.
4. Click **Deploy Site**.

*Alternatively, deploy via CLI:*
```bash
npm install -g netlify-cli
netlify login
netlify deploy --build --prod
```

---

### 🔺 Deploying Frontend to Vercel

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy directly from the project root:
   ```bash
   vercel --prod
   ```

---

### 🐍 Deploying Backend API to Render / Railway

1. Create a new **Web Service** on Render or Railway connected to your GitHub repo.
2. Set the root directory to `server`.
3. Set the build and start commands:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app` (or `python app.py`)
4. Add Environment Variables:
   - `AI_API_KEY`: your free `sk-or-v1-…` key from https://openrouter.ai/keys
   - `FLASK_ENV`: `production`

---

## 🐳 3. Docker Container Deployment

If you prefer containerized execution, use the following `Dockerfile` setup:

### `Dockerfile`
```dockerfile
# Build Stage for Client
FROM node:18-alpine AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production Stage with NGINX
FROM nginx:alpine AS production-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Build & Run Docker Container:
```bash
docker build -t ai-escape-room .
docker run -d -p 8080:80 ai-escape-room
```
*Access the game at `http://localhost:8080`.*

---

## 🔍 Verification & Health Check

After deployment, verify that:
1. WebGL initializes cleanly in the browser console.
2. 3D room geometries and Rapier physics colliders load without error.
3. Level progression locks operate strictly: **Medium Mode unlocks only after Story Mode is fully completed**.
4. Achievement pop-up banners appear upon level completion.
5. In-game environmental notes and chatbot dialogue respond seamlessly.

---

© 2026–2027 **AI-Powered Escape Room Team** — All Rights Reserved.
