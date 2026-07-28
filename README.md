# 🗝️ AI-Powered 3D Escape Room with Dynamic Puzzle Generation

A state-of-the-art, browser-based 3D horror escape room game featuring **AI-generated dynamic puzzles**, **sequential level progression & mode unlocks**, **interactive AI NPC Chatbot**, **3D articulated dual-hand object interactions & throwing physics**, and **ten immersive haunted environments** — built with Three.js, Rapier Physics, GSAP, Python Flask, and the OpenAI API.

> **Academic Project Synopsis — Final Year B.Sc. Artificial Intelligence & Machine Learning**  
> **Academic Year**: 2026–2027  
> **Institution**: Thakur College of Science and Commerce, Kandivali  
> **Department**: Artificial Intelligence and Machine Learning  
> **Project Team**: Shruti Yadav (261520), Mansi Salunke (261542), Ayushree More (261543)  
> **Project Guide**: Jinal Mam  

---

## 🌟 Key Highlights & Feature Matrix

| Feature | Description |
|---|---|
| 🎮 **10 Unique 3D Rooms** | *Haunted Library → Ancient Temple → Forgotten Prison → Abandoned Laboratory → Abandoned Hospital → Haunted Mansion → Medieval Castle → Secret Bunker → Cyber AI Facility → Final Convergence* |
| 🔒 **Sequential Mode Unlocks** | Strict progression hierarchy: **Story Mode** $\rightarrow$ **Medium Mode** (locked until Story mode is fully completed) $\rightarrow$ **Difficult Mode** (locked until Medium mode is completed). Persistent across browser sessions. |
| 🤖 **AI-Driven Puzzles** | OpenAI GPT-4o / GPT-3.5-Turbo generated Keypad Locks, Riddles, and Symbol Sequences with atmospheric clues dynamically tied to room 3D physical props. |
| 💬 **Interactive AI Chatbot NPC** | Chat freely with room NPCs (*The Librarian*, *The Keeper*, *Prisoner 47*) in natural language using an in-game chatbot UI with scroll history and suggestion chips. |
| 🏆 **Level Cleared & Achievement Popups** | Instant AAA-style pop-up notifications (`✓ ROOM ESCAPED & CLEARED` and `🏆 ACHIEVEMENT UNLOCKED`) with trophies, descriptions, and audio cues upon clearing levels. |
| 🥊 **3D Dual-Hand & Throw Rig** | Articulated gloved hands with jointed finger flexing, 2nd-order spring-damped inertia sway, physical object pick-up, and explosive velocity throwing. |
| 🕯️ **Survival Mechanics** | Flashlight battery management, dynamic sanity erosion with post-processing distortion, quickening heartbeats, and a hunting spectral presence. |
| ⚡ **Offline Fallback Engine** | Runs 100% offline with zero dependencies via a local procedural AI puzzle generator if no internet or API keys are detected. |

---

## 🎯 Game Modes

1. 📖 **Story Mode**:
   - Relaxed exploration experience.
   - Unlimited puzzle attempts with no countdown timer.
   - Unlocked by default for new players.

2. ⚖️ **Medium Mode (The Standard Challenge)**:
   - **🔒 Locked** until the full Story Mode campaign is completed.
   - **3-Attempt Limit per Run** (`ATTEMPTS: ☽ ☽ ☽`).
   - 3 wrong keypad entries deduct all pips ($\rightarrow$ `☠ ☠ ☠`), triggering an automatic **GAME OVER** screen and restarting the run.

3. 💀 **Difficult Mode (The Hardcore Descent)**:
   - **🔒 Locked** until Medium Mode is fully completed.
   - **3-Attempt Limit** + **Live Per-Room Countdown Timer** (`⏱️ 3:30`).
   - Clock ticks live on room entry. Timer reaching `0:00` OR entering 3 wrong codes triggers **GAME OVER** and restarts from Room 1.

---

## 🛠️ Technology Stack & Architecture

### 🖥️ Frontend Stack
- **Core**: HTML5, Vanilla JavaScript (ES Modules), Vanilla CSS Design Tokens
- **3D Render Engine**: **Three.js** (WebGL 2, PBR Shader Materials, Volumetric Fog, Dynamic Shadow Maps, Custom Particle Systems)
- **3D Physics Engine**: **@dimforge/rapier3d-compat** (Rigid body physics, raycasting colliders, kinematic character movement)
- **Animations & Kinetics**: **GSAP (GreenSock)** (Hand rig IK, UI transitions, camera shakes, modal animations)

### ⚙️ Backend & AI Stack
- **Backend API Server**: Python 3.11, Flask REST API, SQLAlchemy, SQLite
- **AI Integrations**: OpenAI API (`gpt-4o`, `gpt-3.5-turbo`)
- **Adaptive Difficulty Algorithm**: Exponential Moving Average (EMA) over player performance telemetry

---

## 🏰 The Ten Haunted Rooms

1. 📚 **The Haunted Library**: Mahogany bookshelves, reading lecterns, candles, ancestral wall paintings, and hanging scrolls.
2. 🏛️ **The Ancient Temple**: Ancient stone pillars, central sacrificial altar, and burning fire braziers.
3. ⛓️ **The Forgotten Prison**: Heavy metal cell bars, 14-link hanging ceiling chains, and interrogation tables.
4. 🧪 **The Abandoned Laboratory**: Chemical test tubes, beakers, glowing green slime vats, and experiment desks.
5. 🏥 **The Abandoned Hospital**: Metal gurneys/beds, medical privacy curtains, heart monitors, and IV stands.
6. 🏰 **The Haunted Mansion**: Grand stone fireplace, grandfather clock, antique furniture, and ancestral portraits.
7. ⚔️ **The Medieval Castle**: Stone hall, heraldic wall banners, armor statues, throne, and wall torches.
8. 📻 **The Secret Bunker**: Reinforced steel walls, radar consoles, map tables, and emergency red beacons.
9. 💻 **The Cyber AI Facility**: Server racks, cyan glowing holographic terminals, and glass pod chambers.
10. 🌌 **The Final Convergence**: Floating spectral runic circle, floating books, wisps, and the final AI altar.

---

## 📁 Project Directory Map

```
game/
├── client/                               (Frontend Application)
│   ├── index.html                        (Entry HTML structure)
│   └── src/
│       ├── main.js                       (App bootstrap & modal wiring)
│       ├── Game.js                       (Main orchestrator & state machine)
│       ├── ai/AIClient.js                (OpenAI API & procedural fallback)
│       ├── player/
│       │   ├── FPSController.js          (WASD movement & mouse look)
│       │   ├── FirstPersonHands.js       (3D gloved hand rig & throw physics)
│       │   ├── InteractionSystem.js      (Raycasting & object pick-up)
│       │   ├── ProgressionManager.js     (Persistent mode unlock & sequential rooms)
│       │   ├── AttemptsTracker.js        (3-attempt limit & Game Over logic)
│       │   └── LevelTimer.js             (Nightmare mode live countdown clock)
│       ├── world/
│       │   ├── BaseRoom.js               (3D room geometry & collision shell)
│       │   ├── RoomManager.js            (Level progression & loader)
│       │   ├── rooms/Rooms1to5.js        (Rooms 1–5 implementations)
│       │   ├── rooms/Rooms6to10.js       (Rooms 6–10 implementations)
│       │   ├── props/PropFactory.js      (3D mesh prop generators)
│       │   └── materials/MaterialLibrary.js (PBR materials & shaders)
│       ├── puzzles/PuzzleManager.js      (Keypad, Riddle, Sequence puzzle UI)
│       └── ui/
│           ├── screens/HUD.js            (In-game overlay, achievement & level banners)
│           ├── screens/GameOverlays.js   (Game Over screen & AI Chatbot dialogue)
│           ├── screens/DifficultyScreen.js (Mode picker with lock indicators)
│           └── styles/main.css           (Modern dark CSS design system)
│
├── server/                               (Backend Python Flask API)
│   ├── app.py                            (Flask entry point)
│   ├── routes/ai.py                      (AI puzzle & dialogue endpoints)
│   ├── routes/game.py                    (Leaderboards & saves endpoints)
│   └── services/
│       ├── openai_service.py             (GPT API integration)
│       └── difficulty_service.py         (Adaptive EMA skill calculator)
│
└── DEPLOY.md                             (Complete Deployment Guide)
```

---

## 🚀 How to Run & Deploy

For detailed deployment instructions across Local, Netlify, Vercel, Render, and Docker environments, see **[DEPLOY.md](file:///c:/Users/admin/Desktop/game/DEPLOY.md)**.

### Quick Start:
```bash
# Install frontend dependencies
npm install

# Run local development server
npm run dev

# Build production bundle
npm run build
```

---

© 2026–2027 **AI-Powered Escape Room Team** — Thakur College of Science & Commerce. All Rights Reserved.
