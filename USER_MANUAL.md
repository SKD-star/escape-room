# 📖 USER MANUAL — AI Powered Escape Room

*A complete guide for players. No spoilers — puzzle solutions live in
[WALKTHROUGH.md](WALKTHROUGH.md) if you get stuck.*

> 📖 **This manual is also in the game.** Press **Manual** on the main menu or in
> the pause menu (`Esc`) to read it any time — including a **Chapters** tab that
> briefs all ten levels and shows each one's time limit per difficulty.

---

## 1. What is this game?

You wake up in a haunted library with no memory of how you got there. A
mysterious intelligence has trapped you inside **ten escape rooms** — each one
locked by a puzzle that the AI generates freshly for every playthrough. Solve
the puzzle, escape the room, survive whatever walks in the dark, and uncover
the truth across three possible endings.

- **Genre:** first-person 3D horror escape room
- **Session length:** 45–90 minutes for a full run
- **Runs in:** any modern browser (Chrome, Edge, Firefox) — no install

---

## 2. Starting the game

1. In the project folder, run:
   ```
   npm start
   ```
2. Open **http://localhost:3000** in your browser.
3. Click **New Game**.
4. Pick a difficulty:

   | Mode | Best for | Room clock |
   |---|---|---|
   | 🌿 **Story** | First-timers, puzzle lovers — no monster, gentle sanity | None |
   | ⚖ **Normal** | The intended experience | Generous countdown |
   | 💀 **Nightmare** | Veterans — everything is faster, meaner, ×1.5 score | Tight countdown that bites |

5. A short story intro plays. **Click / any key** = next line, **Esc** = skip.
6. You're in. Click once inside the window so the game captures your mouse.

> 💡 Playing without an account works fine (progress saves in your browser).
> **Sign In** from the main menu enables cloud saves and the leaderboard.

---

## 3. Controls

### Keyboard & mouse

| Input | Action |
|---|---|
| `W` `A` `S` `D` | Walk |
| **Mouse** | Look around |
| **Right mouse (hold)** | Focus zoom — see far details |
| `Shift` (hold) | Sprint — drains the stamina bar |
| `C` | Crouch — slow, quiet |
| `Space` | Jump |
| `E` | **Interact** — pick up / read / open / talk / use |
| `F` | Flashlight on/off *(throws instead while holding an item)* |
| `R` | Reset a held item's rotation |
| `Tab` | Inventory |
| `J` | Journal (all notes you've found) |
| `Q` | Objective reminder |
| `P` | Photo mode — saves a clean screenshot |
| `F5` / `F9` | Quick save / quick load |
| `Esc` | Pause menu (also releases the mouse) |

### Gamepad (plug in and play)

| Button | Action |
|---|---|
| Left stick / Right stick | Move / Look |
| `A` / `B` / `X` / `Y` | Jump / Crouch / Interact / Flashlight |
| `LT` (hold) | Focus zoom |
| `RB` (hold) | Sprint |
| `Start` / `Back` | Pause / Inventory |

---

## 4. Reading the screen (HUD)

```
   compass (N/E/S/W)                    ┌ speedrun timer (optional)
        ▼                               ▼
┌──────────────────────────────────────────────┐
│ OBJECTIVE          THE HAUNTED LIBRARY       │ ← room title (fades out)
│ what to do now         CHAPTER I             │
│                                              │
│                  · (crosshair)               │ ← turns GOLD on usable things
│                [E] Interact                  │ ← press E when this shows
│                                              │
│ 👁│ (sanity)      ━━━ (stamina)    🔦▮▮▮ (battery)
└──────────────────────────────────────────────┘
```

| Element | Meaning |
|---|---|
| **Gold crosshair + `E Interact`** | You're aiming at something usable — press `E` |
| **Objective (top-left)** | What to do next |
| **Compass (top)** | Direction you're facing; N is highlighted |
| **Eye + bar (bottom-left)** | **Sanity** — appears when it drops; red = critical |
| **Thin bar (bottom-center)** | **Stamina** — appears while sprinting |
| **🔦 + bar (bottom-right)** | **Flashlight battery** — blinks red when low |
| **Toasts (bottom)** | Story beats, pickups, hints, warnings |

---

## 5. How to play — the core loop

Every room follows the same rhythm:

### Step 0 — Read the briefing 📋
As you enter each level, a **Briefing** card slides in at the top-left: one line
on *what this room is* and a **Tip** pointing you at the puzzle (never the
answer). Missed it? It's always in the in-game **Manual → Chapters**.

### Step 1 — Follow the gold diamond 🔶
A glowing **gold marker** floats above the room's puzzle object (a lectern,
altar, keypad, terminal…). That is always your main goal.

### Step 2 — Explore on the way
- **Notes 📄** — story + puzzle clues. Everything you read is saved in your **Journal (`J`)**.
- **Key items 🗝** — shimmer gold on the floor/furniture. Needed for the best ending.
- **Batteries 🔋** — one hides in a corner of every room (+45% charge).
- **Ghosts 👻** — every room has a spirit. Press `E` and **type anything to
  chat** — they answer (AI-powered) and drop subtle puzzle guidance.

### Step 3 — Solve the puzzle
Press `E` under the gold diamond. You'll get one of three puzzle types:

| Type | What you do |
|---|---|
| **Keypad** | Enter a digit code — it's hidden in the clue text |
| **Riddle** | Type a one-word answer |
| **Sequence** | Click symbols in the correct order — the clue names the first |

Stuck? Press **Request Hint** (3 levels, each more direct). But careful:
**more than 12 hints across the whole run changes your ending…**

### Step 4 — Follow the green diamond 🟢
Solved it? The exit unseals and a **green marker** appears over the door.
Press `E` at the door and walk into the next chapter.

### Level briefings — what each room asks
Same text as the in-game **Manual → Chapters**. Times are the **countdown** on
Normal / Nightmare (Story has none).

| # | Level | What it is & how to read it | ⏱ Normal · Nightmare |
|---|---|---|---|
| 1 | **The Haunted Library** | Books remember more than you do — the code is *written* on the shelves. Read the notes and spines. | 5:15 · 2:59 |
| 2 | **The Ancient Temple** | A ritual. Obey the carvings **in order** — find where the sequence starts. | 5:38 · 3:11 |
| 3 | **The Forgotten Prison** | Cells and tallies. **Count** what prisoners left; the warden's records add up. | 6:00 · 3:24 |
| 4 | **The Abandoned Laboratory** | Meticulous logs. Each pairs a **label to a value** — line them up. | 6:23 · 3:37 |
| 5 | **The Abandoned Hospital** | Charts and tags carry the **digits** — cross-reference a room/patient number. | 6:45 · 3:50 |
| 6 | **The Haunted Mansion** | Portraits are watching, and telling. Trace the family to a **name/date**. | 7:08 · 4:02 |
| 7 | **The Medieval Castle** | Heraldry. Banners and crests fall in a **set order** — restore it. | 7:30 · 4:15 |
| 8 | **The Secret Bunker** | Cold-war codes. **Logbooks and dials** point at the same answer. | 7:53 · 4:28 |
| 9 | **The Cyber AI Facility** | The machine still answers — **ask it** and read its logs. | 8:15 · 4:41 |
| 10 | **The Final Convergence** | Everything folds together — **recall** what solved the earlier rooms. | 9:00 · 5:06 |

---

## 6. Survival — light, sanity, and the thing in the dark

### 🔦 The flashlight
Your best friend. `F` toggles it. It drains battery (~1 minute continuous),
refills partially at each room's entrance, fully with hidden battery pickups.
When the beam starts **stuttering**, either your battery is dying — or
something is near.

### 🧠 Sanity (the eye icon)
Darkness slowly erodes your mind. Low sanity = warped vision, pounding
heartbeat, whispers, trembling hands.
- **Lose it:** standing in darkness, the presence being close, being touched
- **Restore it:** stand in light (candles/torches/flashlight), solve puzzles,
  escape rooms, find secrets
- If sanity ever hits rock bottom, your run is marked for the **Dark Ending**

### 👁 The Presence
A dark figure that manifests and drifts toward you (Normal/Nightmare only).
- **Banish it:** hold your flashlight beam on it for ~2 seconds
- **If it touches you:** a scare and a big sanity hit — it never kills you
- **Stealth:** sprinting is loud and attracts it; crouching keeps you quiet

### ⏳ The room clock (Normal & Nightmare)
A countdown appears at the top of the screen and **keeps ticking even while you
work the lock** — each room grants a **time limit** that grows with the level's
complexity (later chapters give more base time; harder difficulty tightens it).
- **Normal — soft clock.** Run it out and you enter **overtime**: the timer turns
  red and your **sanity bleeds**, but you can still finish. It never ends the run.
- **Nightmare — hard deadline.** Run it out and the room **restarts**: it reloads
  with a **fresh puzzle** and a **full timer**. Rooms you already escaped stay
  cleared, so you only lose the room you were in — never the whole run.
- The clock **pauses** in the Esc menu and while reading a note or talking to a
  spirit, so lore never costs you time.
- **Story mode has no clock**, and you can switch it off anywhere in
  **Settings → Controls → Room Countdown**.

> Want a pure puzzle experience? **Settings → Controls** lets you turn off
> the Presence, sanity effects and the room countdown — or just play Story mode.

---

## 7. Inventory & item combining

- `Tab` opens your inventory.
- **Click one item** to inspect it (every item has lore).
- **Click a second item** to try combining them. Two secret pairs combine
  into ending-critical artifacts — experiment with what you collect!

## 8. Saving & loading

| Method | How |
|---|---|
| **Autosave** | Automatic at every room entrance |
| **Quick save/load** | `F5` / `F9` any time in-game |
| **Manual slots** | Pause → Save Game → 3 slots |
| **Continue** | Main menu → Continue resumes your latest save |

Saves keep everything: room, inventory, sanity, battery, journal, difficulty.

## 9. Endings, achievements, score

- **3 endings** — Standard, True (collect + combine the right items), and
  Dark (lean on hints too much / lose your mind). See WALKTHROUGH.md.
- **13 achievements** — some secret. Check Main menu → Achievements.
- **Leaderboard score** = rooms, puzzles and speed, minus hints — multiplied
  by your difficulty (Nightmare pays ×1.5). Sign in to compete.
- **Statistics** — Main menu → Statistics tracks your lifetime playstyle.

## 10. Settings that matter

| Setting | Where | Why you'd change it |
|---|---|---|
| Brightness | Video | Room too dark/bright for your monitor |
| Graphics Quality | Video | Lower it on weak laptops (auto-drops if FPS dips) |
| FOV | Video | Wider view (60–100°) |
| Mouse Sensitivity | Controls | Faster/slower looking |
| Sound Captions | Controls | Deaf/hard-of-hearing accessibility |
| Speedrun Timer | Controls | Live clock + per-room best splits |
| Room Countdown | Controls | Turn the per-room time limit on/off |
| The Presence / Sanity FX | Controls | Turn off the horror layer |

## 11. Quick FAQ

**The screen is black after I click things.** Wait 3 seconds (self-recovery),
or hard-refresh with `Ctrl+Shift+R`.

**My mouse won't look around.** Click once inside the game window. `Esc` frees
the mouse again. The browser bar "press Esc to show cursor" is normal.

**I can't find the puzzle.** Look for the floating **gold diamond**. It's
always there. Check the compass and walk around furniture.

**`E` isn't working.** Get within ~3 meters and center the crosshair until it
turns gold and shows the `E Interact` label.

**It's too scary / I just want puzzles.** Story mode, or toggle off "The
Presence" + "Sanity Effects" in Settings → Controls.

**Where are my screenshots?** `P` saves a PNG to your browser's Downloads.

**More problems?** See the Troubleshooting table in [README.md](README.md).

---

*Have a good escape. The rooms are learning from you.* 👁
