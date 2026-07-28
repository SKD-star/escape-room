"""AI service — puzzle / hint / dialogue / story generation.

Provider chain:
  1. OpenAI (JSON mode) when OPENAI_API_KEY is configured
  2. Procedural fallback generator (always available, fully offline)

Every call is logged to ai_logs for the admin dashboard.
"""
from __future__ import annotations

import json
import logging
import random
import time

from flask import current_app

from extensions import db
from models import AILog, PuzzleBank

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# OpenAI client (lazy)
# ---------------------------------------------------------------------------

_client = None


def _openai():
    global _client
    if _client is None:
        from openai import OpenAI
        _client = OpenAI(api_key=current_app.config["OPENAI_API_KEY"])
    return _client


def _openai_enabled() -> bool:
    return bool(current_app.config["OPENAI_API_KEY"])


def _chat_json(system: str, user: str, max_tokens: int = 700) -> dict:
    """One JSON-mode chat completion."""
    resp = _openai().chat.completions.create(
        model=current_app.config["OPENAI_MODEL"],
        response_format={"type": "json_object"},
        max_tokens=max_tokens,
        temperature=0.9,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    return json.loads(resp.choices[0].message.content)


def _log(kind: str, provider: str, prompt_summary: str, response: dict,
         latency_ms: int, user_id: int | None, error: str | None = None) -> None:
    try:
        db.session.add(AILog(
            user_id=user_id,
            kind=kind,
            provider=provider,
            model=current_app.config["OPENAI_MODEL"] if provider == "openai" else None,
            prompt_summary=prompt_summary[:255],
            response_json=json.dumps(response)[:8000],
            latency_ms=latency_ms,
            success=error is None,
            error=(error or "")[:255] or None,
        ))
        db.session.commit()
    except Exception:  # noqa: BLE001 — logging must never break gameplay
        db.session.rollback()
        log.exception("Failed to write AI log")


def _run(kind: str, prompt_summary: str, openai_fn, fallback_fn, user_id: int | None) -> dict:
    """Try OpenAI, fall back to procedural generation. Always returns a dict."""
    start = time.monotonic()
    if _openai_enabled():
        try:
            result = openai_fn()
            result["provider"] = "openai"
            _log(kind, "openai", prompt_summary, result,
                 int((time.monotonic() - start) * 1000), user_id)
            return result
        except Exception as exc:  # noqa: BLE001
            log.warning("OpenAI %s failed (%s) — using fallback", kind, exc)
            error = str(exc)
    else:
        error = None

    start = time.monotonic()
    result = fallback_fn()
    result["provider"] = "fallback"
    _log(kind, "fallback", prompt_summary, result,
         int((time.monotonic() - start) * 1000), user_id, error=error)
    return result


# ---------------------------------------------------------------------------
# Riddle / puzzle content pools for the procedural fallback
# ---------------------------------------------------------------------------

_RIDDLES = [
    {"riddle": "I have keys but open no locks. I have space but no room. You can enter, but you can't go outside.", "answer": "keyboard"},
    {"riddle": "The more you take from me, the bigger I become. What am I?", "answer": "hole"},
    {"riddle": "I speak without a mouth and hear without ears. I am born in air. What am I?", "answer": "echo"},
    {"riddle": "I am not alive, but I grow. I don't have lungs, but I need air. Water kills me.", "answer": "fire"},
    {"riddle": "The person who makes it sells it. The person who buys it never uses it. The person who uses it never knows.", "answer": "coffin"},
    {"riddle": "I follow you all day in the light, but vanish when darkness falls. What am I?", "answer": "shadow"},
    {"riddle": "What has a heart that doesn't beat?", "answer": "artichoke"},
    {"riddle": "I have cities but no houses, forests but no trees, and water but no fish.", "answer": "map"},
    {"riddle": "Feed me and I live, give me a drink and I die. What am I?", "answer": "fire"},
    {"riddle": "What can travel around the world while staying in a corner?", "answer": "stamp"},
    {"riddle": "I am always in front of you but can never be seen. What am I?", "answer": "future"},
    {"riddle": "What breaks yet never falls, and what falls yet never breaks?", "answer": "day"},
]

_THEME_WORDS = {
    "library": ["tome", "whisper", "shelf", "candle", "ink"],
    "temple": ["idol", "ritual", "stone", "serpent", "offering"],
    "prison": ["chain", "warden", "cell", "rust", "freedom"],
    "laboratory": ["serum", "specimen", "vial", "voltage", "mutation"],
    "hospital": ["ward", "morgue", "gurney", "pulse", "scalpel"],
    "mansion": ["portrait", "heir", "cellar", "mirror", "dust"],
    "castle": ["throne", "crest", "dungeon", "torch", "banner"],
    "bunker": ["cipher", "radio", "hatch", "protocol", "fallout"],
    "cyber": ["kernel", "daemon", "firewall", "neural", "override"],
    "boss": ["soul", "abyss", "verdict", "gate", "eternity"],
}

_HINT_TIERS = [
    "Look again at the {focus}. Something about it doesn't belong.",
    "The {focus} is the key. Compare it with what you've collected.",
    "Direct answer path: interact with the {focus}, then apply the clue in order.",
]


def _bank_puzzle(theme: str, difficulty: float) -> dict | None:
    """Prefer an admin-authored puzzle for this theme, closest in difficulty.

    Returns None when the bank has nothing enabled for the theme, so callers
    fall through to procedural generation. Never raises — a broken bank must
    not break gameplay.
    """
    try:
        candidates = PuzzleBank.query.filter_by(theme=theme, enabled=True).all()
        if not candidates:
            return None
        # Bias toward puzzles near the requested difficulty, but keep variety.
        candidates.sort(key=lambda p: abs(p.difficulty - difficulty))
        pool = candidates[: max(1, len(candidates) // 2)]
        return random.choice(pool).to_puzzle()
    except Exception:  # noqa: BLE001 — the bank is a bonus, not a dependency
        db.session.rollback()
        log.exception("Puzzle bank lookup failed")
        return None


def _fallback_puzzle(theme: str, difficulty: float) -> dict:
    authored = _bank_puzzle(theme, difficulty)
    if authored is not None:
        return authored

    words = _THEME_WORDS.get(theme, _THEME_WORDS["library"])
    kind = random.choice(["keypad", "riddle", "sequence"])

    if kind == "keypad":
        digits = 3 + int(difficulty * 3)  # 3..6 digits
        code = "".join(str(random.randint(0, 9)) for _ in range(digits))
        clue_word = random.choice(words)
        return {
            "type": "keypad",
            "title": "The Sealed Mechanism",
            "narrative": f"A cold brass keypad guards the way. Scratched beside it: 'The {clue_word} remembers what the living forget.'",
            "code": code,
            "clue": f"The code is hidden near the {clue_word} — {digits} digits, read them in the order the candles burn.",
            "difficulty": difficulty,
        }
    if kind == "riddle":
        pool = _RIDDLES if difficulty < 0.6 else _RIDDLES[4:]
        r = random.choice(pool)
        return {
            "type": "riddle",
            "title": "A Voice in the Dark",
            "narrative": "Words scrape themselves into the wall as you watch...",
            "riddle": r["riddle"],
            "answer": r["answer"],
            "difficulty": difficulty,
        }
    length = 4 + int(difficulty * 4)  # 4..8 steps
    symbols = ["moon", "eye", "serpent", "key", "skull", "flame", "hourglass", "raven"]
    seq = random.sample(symbols, min(length, len(symbols)))
    symbol_descriptions = {
        "moon": "the pale celestial orb of midnight",
        "eye": "the all-seeing optical core",
        "serpent": "the slithering creature beneath grass",
        "key": "the golden key of the realm",
        "skull": "the silent marker of mortality",
        "flame": "the sacred flickering fire",
        "hourglass": "the falling sands of time",
        "raven": "the dark wings of night",
    }
    riddles = [f"I. {symbol_descriptions.get(s, s)}" for s in seq]
    clue_text = "The Ritual Order:\n" + "\n".join(riddles)
    return {
        "type": "sequence",
        "title": "The Order of Things",
        "narrative": "Ancient symbols glow faintly. They pulsed in an order once — restore it.",
        "sequence": seq,
        "clue": clue_text,
        "difficulty": difficulty,
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_puzzle(theme: str, difficulty: float, user_id: int | None = None,
                    context: str = "") -> dict:
    theme = (theme or "library")[:32]
    difficulty = max(0.0, min(1.0, difficulty))

    def via_openai() -> dict:
        system = (
            "You are the puzzle designer of a AAA horror escape-room game. "
            "Return STRICT JSON with keys: type (one of keypad|riddle|sequence), "
            "title, narrative (2 atmospheric sentences), difficulty (number), and "
            "for keypad: code (string of digits) + clue; "
            "for riddle: riddle + answer (single lowercase word); "
            "for sequence: sequence (array of 4-8 symbol words) + clue. "
            "STRICT PUZZLE DESIGN RULE: In the 'clue' field, NEVER write out explicit passcode digits (e.g., 'code is 1-4-6-2') or list raw symbol answer sequence names directly (e.g., 'serpent, moon, eye'). Instead, write atmospheric riddle verses, poetic descriptions, or observation tasks (e.g., 'I. The slithering creature, II. The pale orb'). "
            "Keep it solvable and creepy. No gore against real persons."
        )
        user = (
            f"Room theme: {theme}. Difficulty: {difficulty:.2f} (0 easy, 1 brutal). "
            f"Extra context: {context or 'none'}. Generate one puzzle."
        )
        result = _chat_json(system, user)
        result.setdefault("difficulty", difficulty)
        return result

    return _run("puzzle", f"puzzle:{theme}:{difficulty:.2f}",
                via_openai, lambda: _fallback_puzzle(theme, difficulty), user_id)


def generate_hint(puzzle: dict, tier: int, user_id: int | None = None) -> dict:
    tier = max(0, min(2, tier))

    def via_openai() -> dict:
        system = (
            "You write hints for a horror escape room. Return JSON {\"hint\": str}. "
            f"Hint tier {tier}: 0=cryptic nudge, 1=clear direction, 2=almost the answer. "
            "Stay in character as a ghostly narrator, max 2 sentences."
        )
        return _chat_json(system, f"Puzzle: {json.dumps(puzzle)[:1500]}", max_tokens=120)

    def fallback() -> dict:
        focus = puzzle.get("clue") or puzzle.get("riddle") or "strange details around you"
        if puzzle.get("type") == "riddle" and tier == 2:
            answer = puzzle.get("answer", "")
            return {"hint": f"The answer begins with '{answer[:1].upper()}' and has {len(answer)} letters."}
        template = _HINT_TIERS[tier]
        return {"hint": template.format(focus=str(focus)[:120])}

    return _run("hint", f"hint:t{tier}", via_openai, fallback, user_id)


def generate_dialogue(npc: str, room_theme: str, player_message: str,
                      history: list[dict] | None = None,
                      user_id: int | None = None) -> dict:
    npc = (npc or "The Librarian")[:48]
    room_theme = (room_theme or "library")[:32]
    clean_msg = (player_message or "").strip()

    def via_openai() -> dict:
        system = (
            f"You are '{npc}', the ghostly room guide and librarian inside the {room_theme} of a horror escape-room game. "
            "You function as an interactive room chatbot. "
            "CRITICAL INSTRUCTIONS:\n"
            "1. Answer ONLY questions related to this specific room, its environment, items, books, notes, puzzle clues, and lore.\n"
            "2. Never use pre-defined or generic canned lines. Address the player's specific question directly with dynamic context.\n"
            "3. Provide subtle puzzle guidance or atmospheric hints when asked, but do not give away explicit passcode numbers directly unless asked.\n"
            "4. If the player asks about topics unrelated to the room, stay in character and remind them that only the room's secrets matter.\n"
            "5. Keep responses concise, mysterious, and helpful (max 3 sentences).\n"
            "Return JSON {\"line\": str, \"mood\": calm|ominous|helpful}."
        )
        messages = [{"role": "system", "content": system}]
        for h in (history or [])[-6:]:
            messages.append({"role": h.get("role", "user"), "content": str(h.get("content", ""))[:400]})
        messages.append({"role": "user", "content": clean_msg[:400]})
        resp = _openai().chat.completions.create(
            model=current_app.config["OPENAI_MODEL"],
            response_format={"type": "json_object"},
            max_tokens=180, temperature=0.9, messages=messages,
        )
        return json.loads(resp.choices[0].message.content)

    def fallback() -> dict:
        msg = clean_msg.lower()

        # Dynamic room context response synthesis for offline / fallback
        if any(w in msg for w in ["book", "scroll", "read", "text", "library", "shelf", "spine", "paper"]):
            line = f"The books in this {room_theme.replace('_', ' ')} remember what was forgotten. Inspect the bookshelves carefully — an ancient scroll rests in the Whisper Section."
            mood = "helpful"
        elif any(w in msg for w in ["code", "number", "keypad", "lock", "password", "lectern", "combination", "digits"]):
            line = "To decipher the lock code, count the physical relics in this chamber: the lecterns, ancestral paintings, lit candles, and stone pillars in order."
            mood = "helpful"
        elif any(w in msg for w in ["key", "door", "exit", "escape", "open", "lever", "alcove"]):
            line = "The brass exit key is hidden behind a secret wall. Search the North wall for a hidden lever between the shelves."
            mood = "helpful"
        elif any(w in msg for w in ["who", "librarian", "you", "ghost", "spirit", "name", "identity"]):
            line = f"I am the Librarian of these forgotten halls. I stay behind to test those who enter the {room_theme.replace('_', ' ')}."
            mood = "calm"
        elif any(w in msg for w in ["time", "dark", "sanity", "light", "flashlight", "timer", "presence", "haunt"]):
            line = "Keep your flashlight burning when exploring the dark. Light restores your clarity, but staying in shadow erodes your mind."
            mood = "ominous"
        elif any(w in msg for w in ["hint", "help", "solve", "stuck", "clue", "where"]):
            line = f"Look around the {room_theme.replace('_', ' ')}. Every candle, painting, and note was placed to give you a piece of the truth."
            mood = "helpful"
        else:
            # Contextually synthesize response addressing player's specific question
            topic = clean_msg[:40] if len(clean_msg) > 0 else "the room"
            line = f"Regarding '{topic}' — seek the answer within the {room_theme.replace('_', ' ')}. Inspect the room's objects and notes carefully."
            mood = "calm"

        return {"line": line, "mood": mood}

    return _run("dialogue", f"npc:{npc}", via_openai, fallback, user_id)


def generate_story(room_theme: str, progress: dict, user_id: int | None = None) -> dict:
    def via_openai() -> dict:
        system = (
            "You are the narrative engine of a horror escape-room game. "
            "Return JSON {\"text\": str} — a 3-4 sentence story beat continuing the "
            "player's journey. Second person, present tense, dread-soaked but PG-16."
        )
        return _chat_json(system, f"Theme: {room_theme}. Progress: {json.dumps(progress)[:800]}",
                          max_tokens=220)

    def fallback() -> dict:
        beats = [
            "The door seals behind you with a sound like a held breath finally released. Whatever waited in the last room is still waiting — patience is all the dead have left.",
            "You step forward and the temperature drops. Somewhere above, footsteps cross a floor that shouldn't exist.",
            "The air tastes of copper and old paper. A voice you almost recognize whispers your name, once, from the wrong direction.",
            "Light flickers as if the room itself is blinking. In the darkness between, the furniture is closer.",
        ]
        return {"text": random.choice(beats)}

    return _run("story", f"story:{room_theme}", via_openai, fallback, user_id)
