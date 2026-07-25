# Complete Fix Plan

## Issue 1: Keys System Fix (HIGH PRIORITY)
**Problem**: Exit door unlock doesn't check if player has collected the room's key item. Pressing E opens the door even without keys.

**Fix**:
1. In `BaseRoom.js`, store `roomKeyItem` for each room.
2. In `addExitDoor()`, check `inventory.has(roomKeyItem)` before allowing unlock.
3. In `Game.js`, modify `PUZZLE_SOLVED` handler to verify key possession.
4. Update each room's `placeKeyItem()` call to register the required key for that room.

**Files**: `BaseRoom.js`, `Game.js`, `Rooms1to5.js`, `Rooms6to10.js`

---

## Issue 2: Timer → 3 Attempts System (HIGH PRIORITY)
**Problem**: Current countdown timer (LevelTimer) doesn't match the requested 3-attempt system.

**Fix**:
1. Create new `AttemptsTracker.js` to replace LevelTimer's role.
2. Track puzzle attempts per room - max 3 attempts.
3. After 3 failed attempts, show "Room Restart" option with a modal.
4. Add attempt counter to HUD.
5. Keep LevelTimer for Normal/Nightmare difficulty modes as supplemental.

**Files**: Create `AttemptsTracker.js`, modify `HUD.js`, `Game.js`, `PuzzleManager.js`

---

## Issue 3: BGM + Volume Controls (MEDIUM PRIORITY)
**Problem**: No proper background music. Settings already has musicVolume but no actual BGM.

**Fix**:
1. Add BGM layer in `AudioEngine.js` - procedural horror ambient music using WebAudio oscillators.
2. Implement the BGM style from the reference YouTube video (dark ambient drone with occasional melodic horror elements).
3. Connect musicVolume setting to BGM gain.
4. Add BGM toggle in settings.

**Files**: `AudioEngine.js`, `settings.js`, `SettingsScreen.js`

---

## Issue 4: Puzzle Clues & Symbols Fix (HIGH PRIORITY)
**Problem**: Room clues are scattered and don't properly connect to puzzle solutions. Symbols puzzle looks AI-generated.

**Fix**:
1. Add proper clue-to-solution mapping in each room.
2. Ensure each note's content directly hints at the puzzle answer.
3. Improve symbol icons with proper Unicode characters and CSS styling.
4. Make sequence puzzle show proper visual feedback.

**Files**: `PuzzleManager.js`, `Rooms1to5.js`, `Rooms6to10.js`, `main.css`

---

## Issue 5: Leaderboard & Achievements UI (MEDIUM PRIORITY)
**Problem**: AI-generated icons and basic styling.

**Fix**:
1. Add proper Unicode/custom icons for achievements.
2. Improve table styling with better glassmorphism.
3. Add animations for leaderboard entries.

**Files**: `MenuScreens.js`, `main.css`

---

## Issue 6: Control Room UI (MEDIUM PRIORITY)
**Problem**: Need to identify what "Control Room" means - likely the `CyberFacility` room (Room 9) or a settings/controls screen.

**Fix**:
1. Improve the Cyber Facility room UI elements.
2. Better terminal screens and interaction prompts.
3. Add glow/scan-line effects to screens.

**Files**: `Rooms6to10.js` (CyberFacility section)

---

## Issue 7: Room Clue Flow (HIGH PRIORITY)
**Problem**: Even when following clues, puzzles don't make sense.

**Fix**:
1. Map each room's notes to specific puzzle solutions.
2. Ensure clue text contains the solution encoded (e.g., riddle answer hidden in note text).
3. Add progressive hint system that reveals more based on attempts.

**Files**: `PuzzleManager.js`, All room files

