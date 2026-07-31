"""AI service — puzzle / hint / dialogue / story generation.

Provider chain:
  1. An OpenAI-compatible LLM when a key is configured. OpenRouter keys
     (``sk-or-…``) are detected automatically and served from its free model
     pool, so no paid account is required.
  2. Procedural fallback generator (always available, fully offline)

Every call is logged to ai_logs for the admin dashboard.
"""
from __future__ import annotations

import json
import logging
import random
import re
import time

from flask import current_app

from extensions import db
from models import AILog, PuzzleBank

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Provider resolution
#
# One code path serves every OpenAI-compatible endpoint. The key prefix picks
# the base URL and the model chain, so a player can paste either a paid OpenAI
# key or a $0 OpenRouter key and everything downstream behaves identically.
# ---------------------------------------------------------------------------

OPENROUTER_BASE = "https://openrouter.ai/api/v1"

# Free OpenRouter models, tried in order — measured against the live free tier:
# gpt-oss returns clean JSON most consistently, nemotron is close behind but
# spends tokens thinking, and gemma's shared pool answers 429 most of the day
# so it sits last among the named models.
#
# The roster rotates every few weeks, so the final entry is OpenRouter's own
# free-tier router: it picks whatever zero-cost model is live at request time,
# which keeps the chatbot alive even after every model above it is delisted.
FREE_MODELS = [
    "openai/gpt-oss-20b:free",
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "google/gemma-4-31b-it:free",
    "openrouter/free",
]

OPENAI_MODELS = ["gpt-4o-mini"]

_MOODS = {"calm", "ominous", "helpful", "amused"}

_clients: dict[str, object] = {}


def _resolved_key(custom_key: str | None = None) -> str:
    return (custom_key or "").strip() or current_app.config.get("AI_API_KEY", "").strip()


def _is_openrouter(key: str) -> bool:
    return key.startswith("sk-or-")


def _base_url(key: str) -> str | None:
    configured = current_app.config.get("AI_BASE_URL", "").strip()
    if configured:
        return configured
    return OPENROUTER_BASE if _is_openrouter(key) else None


def _model_chain(key: str) -> list[str]:
    """Models to try, best first. An explicit AI_MODEL always wins."""
    configured = current_app.config.get("AI_MODEL", "").strip()
    if configured:
        return [configured]
    return FREE_MODELS if _is_openrouter(key) else OPENAI_MODELS


def _client(custom_key: str | None = None):
    """Lazy, per-key OpenAI SDK client pointed at the right endpoint."""
    key = _resolved_key(custom_key)
    if not key:
        raise ValueError("No AI API key provided.")
    if key not in _clients:
        from openai import OpenAI
        headers = {}
        if _is_openrouter(key):
            # OpenRouter uses these for its public app rankings; both optional.
            headers = {
                "HTTP-Referer": current_app.config.get("AI_SITE_URL", ""),
                "X-Title": current_app.config.get("AI_SITE_NAME", ""),
            }
        _clients[key] = OpenAI(
            api_key=key,
            base_url=_base_url(key),
            default_headers=headers or None,
            timeout=30.0,
            max_retries=1,
        )
    return _clients[key]


def _ai_enabled(custom_key: str | None = None) -> bool:
    return bool(_resolved_key(custom_key))


_JSON_BLOCK = re.compile(r"\{.*\}", re.DOTALL)
_THINK_BLOCK = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)


def _parse_json(content: str) -> dict:
    """Parse a model reply that is *supposed* to be JSON.

    Free models frequently ignore ``response_format``, wrap the object in a
    ```json fence, or prepend a <think> block. Strict json.loads would throw
    away perfectly good answers, so peel those off before parsing.
    """
    text = _THINK_BLOCK.sub("", content or "").strip()
    if text.startswith("```"):
        text = text.split("```")[1] if "```" in text[3:] else text[3:]
        text = text.removeprefix("json").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = _JSON_BLOCK.search(text)
        if not match:
            raise
        return json.loads(match.group(0))


def _chat(messages: list[dict], max_tokens: int = 700, temperature: float = 0.9,
          custom_key: str | None = None, **kwargs) -> tuple[dict, str]:
    """One chat completion, walking the model chain. Returns (data, model).

    Each model in the chain gets one shot; a dead/delisted/rate-limited model
    simply hands off to the next one instead of failing the whole request.
    """
    key = _resolved_key(custom_key)
    client = _client(custom_key)
    json_mode = not _is_openrouter(key)  # free models reject response_format
    last_exc: Exception | None = None

    for model in _model_chain(key):
        try:
            resp = client.chat.completions.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                messages=messages,
                **({"response_format": {"type": "json_object"}} if json_mode else {}),
                **kwargs,
            )
            return _parse_json(resp.choices[0].message.content), model
        except Exception as exc:  # noqa: BLE001 — try the next model
            last_exc = exc
            log.warning("AI model %s failed (%s)", model, exc)

    raise last_exc or RuntimeError("No AI model available")


def _chat_json(system: str, user: str, max_tokens: int = 700, custom_key: str | None = None) -> dict:
    data, _ = _chat(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        max_tokens=max_tokens, custom_key=custom_key,
    )
    return data


def _log(kind: str, provider: str, prompt_summary: str, response: dict,
         latency_ms: int, user_id: int | None, error: str | None = None) -> None:
    try:
        db.session.add(AILog(
            user_id=user_id,
            kind=kind,
            provider=provider,
            model=response.get("model") if provider != "fallback" else None,
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


def _provider_name(custom_key: str | None = None) -> str:
    return "openrouter" if _is_openrouter(_resolved_key(custom_key)) else "openai"


def _run(kind: str, prompt_summary: str, llm_fn, fallback_fn, user_id: int | None) -> dict:
    """Try the LLM, fall back to procedural generation. Always returns a dict."""
    start = time.monotonic()
    if _ai_enabled():
        provider = _provider_name()
        try:
            result = llm_fn()
            result["provider"] = provider
            _log(kind, provider, prompt_summary, result,
                 int((time.monotonic() - start) * 1000), user_id)
            return result
        except Exception as exc:  # noqa: BLE001
            log.warning("%s %s failed (%s) — using fallback", provider, kind, exc)
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

    def via_llm() -> dict:
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
                via_llm, lambda: _fallback_puzzle(theme, difficulty), user_id)


def generate_hint(puzzle: dict, tier: int, user_id: int | None = None) -> dict:
    tier = max(0, min(2, tier))

    def via_llm() -> dict:
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

    return _run("hint", f"hint:t{tier}", via_llm, fallback, user_id)


def _dialogue_briefing(room_theme: str, context: dict) -> str:
    """Flatten the live room state the client sent into a readable briefing.

    Everything here is optional — the chatbot must still answer sensibly when
    the client is old, offline-ish or mid-load and sends nothing at all.
    """
    ctx = context if isinstance(context, dict) else {}
    lines: list[str] = [f"Room theme: {room_theme}."]

    if ctx.get("room_name"):
        lines.append(f"Room name: {ctx['room_name']} (chapter {ctx.get('chapter', '?')}).")
    if ctx.get("objective"):
        lines.append(f"Player's current objective: {ctx['objective']}")

    puzzle = ctx.get("puzzle") if isinstance(ctx.get("puzzle"), dict) else {}
    if puzzle:
        lines.append(
            f"Room mechanism: a {puzzle.get('type', 'lock')} titled "
            f"'{puzzle.get('title', 'the mechanism')}'."
        )
        if puzzle.get("clue"):
            lines.append(f"The clue the player already has: {str(puzzle['clue'])[:600]}")
        if puzzle.get("riddle"):
            lines.append(f"The riddle inscribed: {str(puzzle['riddle'])[:300]}")
        if puzzle.get("solution"):
            lines.append(
                f"SECRET SOLUTION (never state it verbatim): {str(puzzle['solution'])[:120]}"
            )
        lines.append(f"Mechanism solved already: {'yes' if puzzle.get('solved') else 'no'}.")

    if ctx.get("inventory"):
        lines.append("Player is carrying: " + ", ".join(str(i)[:40] for i in ctx["inventory"][:12]) + ".")
    else:
        lines.append("Player is carrying nothing yet.")
    if ctx.get("needed_key"):
        lines.append(f"The exit door still needs: {ctx['needed_key']}.")
    if ctx.get("landmarks"):
        lines.append("Notable things in this room: " + ", ".join(str(i)[:40] for i in ctx["landmarks"][:14]) + ".")
    if ctx.get("notes"):
        lines.append("Notes/inscriptions the player has read: "
                     + " | ".join(str(n)[:120] for n in ctx["notes"][:5]) + ".")

    status = []
    if ctx.get("sanity") is not None:
        status.append(f"sanity {int(float(ctx['sanity']) * 100)}%")
    if ctx.get("battery") is not None:
        status.append(f"flashlight battery {int(float(ctx['battery']) * 100)}%"
                      + (" (on)" if ctx.get("flashlight_on") else " (off)"))
    if ctx.get("time_in_room_s") is not None:
        status.append(f"{int(ctx['time_in_room_s'])}s spent in this room")
    if ctx.get("failed_attempts"):
        status.append(f"{int(ctx['failed_attempts'])} failed mechanism attempts")
    if ctx.get("hints_used"):
        status.append(f"{int(ctx['hints_used'])} hints spent")
    if status:
        lines.append("Player status: " + ", ".join(status) + ".")
    if ctx.get("difficulty"):
        lines.append(f"Difficulty mode: {ctx['difficulty']}.")
    if ctx.get("rooms_cleared") is not None:
        lines.append(f"Rooms cleared so far: {ctx['rooms_cleared']} of 10.")

    return "\n".join(lines)


def generate_dialogue(npc: str, room_theme: str, player_message: str,
                      history: list[dict] | None = None,
                      user_id: int | None = None,
                      api_key: str | None = None,
                      context: dict | None = None) -> dict:
    npc = (npc or "The Librarian")[:48]
    room_theme = (room_theme or "library")[:32]
    clean_msg = (player_message or "").strip()
    ctx = context if isinstance(context, dict) else {}
    briefing = _dialogue_briefing(room_theme, ctx)

    def via_llm() -> dict:
        system = (
            f"You are '{npc}', the resident spirit and guide of the {room_theme.replace('_', ' ')} "
            "in a horror escape-room game. You are a full conversational companion, not a "
            "menu of canned lines: the player types freely and you answer them directly.\n\n"
            "HOW YOU BEHAVE:\n"
            "1. Answer the player's actual question first, in your own words, using the LIVE ROOM "
            "STATE below. Never repeat a sentence you have already used in this conversation.\n"
            "2. You may talk about anything inside this world: the room, its objects and lore, the "
            "mechanism, the notes, the items the player carries, the presence that hunts them, the "
            "flashlight and sanity, how the escape works, and your own history. Small talk is fine — "
            "answer it in character, then steer gently back to the room.\n"
            "3. If asked about the real world or anything outside the game, stay in character: you "
            "only remember these halls, and you turn the question back to the room.\n"
            "4. GUIDANCE LADDER — be genuinely useful, but make them work: first answer point them "
            "at what to observe; if they say they are still stuck, narrow it to the exact objects; "
            "if they plainly demand the answer, give the first element only (first digit / first "
            "symbol) and tell them to earn the rest. NEVER write out the full solution verbatim.\n"
            "5. Track the conversation. Refer back to what they already told you or already tried.\n"
            "6. Voice: hushed, archaic, faintly threatening, but warm to a persistent visitor. "
            "2-4 sentences. No emoji, no stage directions, no markdown headings. Always write "
            "in English, including the suggestions.\n\n"
            "LIVE ROOM STATE:\n" + briefing + "\n\n"
            "Reply with NOTHING but a single JSON object — no prose, no code fence: "
            "{\"line\": str, \"mood\": \"calm\"|\"ominous\"|\"helpful\"|\"amused\", "
            "\"suggestions\": [2-3 very short follow-up questions the player might ask next, "
            "each under 6 words]}."
        )
        messages = [{"role": "system", "content": system}]
        for h in (history or [])[-16:]:
            role = h.get("role", "user")
            messages.append({
                "role": role if role in ("user", "assistant") else "user",
                "content": str(h.get("content", ""))[:600],
            })
        messages.append({"role": "user", "content": clean_msg[:600]})
        # 700, not 420: the free reasoning models burn a chunk of the budget
        # thinking, and a truncated reply is unparseable JSON.
        data, model = _chat(messages, max_tokens=700, temperature=0.85,
                            custom_key=api_key, presence_penalty=0.5, frequency_penalty=0.35)
        if not isinstance(data.get("line"), str) or not data["line"].strip():
            raise ValueError("model returned no line")
        sugg = data.get("suggestions")
        data["suggestions"] = [str(s)[:48] for s in sugg][:3] if isinstance(sugg, list) else []
        # Free models write prose in `mood` ("eerie and mysterious"); the UI
        # only understands the four it was given.
        data["mood"] = data.get("mood") if data.get("mood") in _MOODS else "calm"
        data["model"] = model
        return data

    def fallback() -> dict:
        return _fallback_dialogue(npc, room_theme, clean_msg, history or [], ctx)

    # A key the player pasted themselves overrides the server's own.
    if api_key and api_key.strip():
        provider = _provider_name(api_key)
        try:
            start = time.monotonic()
            result = via_llm()
            result["provider"] = provider
            _log("dialogue", provider, f"npc:{npc}", result,
                 int((time.monotonic() - start) * 1000), user_id)
            return result
        except Exception as exc:  # noqa: BLE001
            log.warning("Player-supplied key dialogue failed: %s", exc)

    return _run("dialogue", f"npc:{npc}", via_llm, fallback, user_id)


# --- offline conversational engine -----------------------------------------
# Not a canned-line table: it reads the same live room state the model gets,
# tracks what has already been said, and escalates its guidance the more the
# player pushes — so a keyless / offline install still feels like a chatbot.

_TOPIC_WORDS = {
    "mechanism": ["code", "number", "digit", "keypad", "lock", "combination", "password",
                  "sequence", "symbol", "order", "ritual", "riddle", "answer", "solve",
                  "puzzle", "mechanism", "panel"],
    "exit": ["door", "exit", "escape", "leave", "out", "key", "unlock", "gate", "open"],
    "items": ["item", "carry", "inventory", "hold", "pick", "found", "have", "collected"],
    "search": ["where", "look", "search", "find", "hidden", "secret", "behind", "under"],
    "self": ["who", "you", "your", "name", "ghost", "spirit", "dead", "alive", "why are you",
             "librarian", "keeper"],
    "survival": ["dark", "sanity", "light", "flashlight", "torch", "battery", "presence",
                 "haunt", "monster", "afraid", "scared", "die", "timer", "time",
                 "following", "watching", "chasing", "alone", "safe"],
    "lore": ["story", "history", "happened", "lore", "before", "past", "place", "room",
             "who built", "why"],
    "stuck": ["stuck", "help", "hint", "clue", "nudge", "lost", "no idea", "confused"],
}

_PRESSURE_WORDS = ["just tell", "tell me the", "give me the", "what is the code",
                   "what is the answer", "spoil", "i give up", "stop being", "straight answer"]


def _topic_of(msg: str) -> str:
    scored = [(sum(1 for w in words if w in msg), topic) for topic, words in _TOPIC_WORDS.items()]
    hits, topic = max(scored)
    return topic if hits else "open"


def _fallback_dialogue(npc: str, room_theme: str, message: str,
                       history: list[dict], ctx: dict) -> dict:
    msg = (message or "").lower()
    place = room_theme.replace("_", " ")
    puzzle = ctx.get("puzzle") if isinstance(ctx.get("puzzle"), dict) else {}
    clue = str(puzzle.get("clue") or "").strip()
    solution = str(puzzle.get("solution") or "").strip()
    landmarks = [str(x) for x in (ctx.get("landmarks") or [])][:6]
    inventory = [str(x) for x in (ctx.get("inventory") or [])][:8]
    needed = str(ctx.get("needed_key") or "").strip()

    # How hard is the player pushing? Drives the guidance ladder.
    asks = sum(1 for h in history if h.get("role") == "user")
    demanding = any(p in msg for p in _PRESSURE_WORDS)
    # Each renewed demand buys one more element — never the whole answer.
    demands = 1 + sum(
        1 for h in history
        if h.get("role") == "user" and any(p in str(h.get("content", "")).lower() for p in _PRESSURE_WORDS)
    )
    topic = _topic_of(msg)

    said = {str(h.get("content", "")) for h in history if h.get("role") == "assistant"}
    mood = "helpful"

    def revealed(count: int) -> str:
        """The first `count` elements of the solution, capped below the full answer."""
        if not solution:
            return ""
        parts = [p for p in solution.replace(",", " ").split() if p]
        if len(parts) == 1:
            parts = list(solution)
        keep = max(1, min(count, len(parts) - 1))
        return " ".join(parts[:keep])

    if topic == "mechanism" or topic == "stuck":
        head = revealed(demands)
        if demanding and head:
            remaining = "the rest" if demands < 2 else "what still follows"
            line = (f"You would have it handed to you? Then take this much and no more: it begins with "
                    f"'{head}'. {remaining.capitalize()} you will earn from the {place} itself.")
            mood = "ominous"
        elif asks >= 3 and clue:
            line = ("Then stop reading and start counting. " + clue.replace("\n", " ")[:220]
                    + " Take them strictly in the order they are named.")
        elif clue:
            line = (f"The {place} already told you how. Recall the inscription: "
                    f"\"{clue.splitlines()[0][:140]}\" — every line of it names something you can touch.")
        else:
            line = (f"The mechanism answers to the {place}, not to me. Walk it slowly and count what "
                    "repeats — the room never places a thing twice by accident.")
    elif topic == "exit":
        if needed:
            line = (f"The door will not part for empty hands. It wants the {needed.replace('_', ' ')} — "
                    "search where the room hides its shame: behind, beneath, above.")
        else:
            line = ("You hold what the door asked for. Feed the mechanism its answer and the way out "
                    "will remember it was ever a door.")
    elif topic == "items":
        line = ("You carry " + (", ".join(inventory) if inventory else "nothing yet")
                + ". " + ("Each of those was left for a reason — turn them over."
                          if inventory else "Empty hands open nothing here. Search the corners."))
        mood = "calm"
    elif topic == "search":
        line = (("Look to " + ", ".join(landmarks[:3]) + " — the room keeps its secrets in plain arrangement.")
                if landmarks else
                f"Search the edges of the {place}. What is hidden is always beside what is obvious.")
    elif topic == "self":
        line = (f"I am {npc}. I stayed when the rest were carried out, and I have watched every visitor "
                f"since decide the {place} was smarter than they were. So far, they were right.")
        mood = "calm"
    elif topic == "survival":
        bat = ctx.get("battery")
        if bat is not None and float(bat) < 0.3:
            line = ("Your light is nearly spent — I can hear it thinning. Burn it only where you must look; "
                    "the dark takes your reason faster than it takes your body.")
            mood = "ominous"
        else:
            line = ("Keep the beam lit while you search. Light steadies the mind, and what walks these halls "
                    "dislikes being seen almost as much as it dislikes being ignored.")
            mood = "ominous"
    elif topic == "lore":
        line = (f"This {place} was not built to hold you. It was built to ask something, and it has been "
                "asking a long time. You are simply the first in a while to answer.")
        mood = "calm"
    else:
        subject = message.strip().rstrip("?")[:60] or "your question"
        line = (f"\"{subject}\" — the {place} has an answer for that, though it will not say it plainly. "
                "Tell me what you have already searched and I will tell you what you have missed.")
        mood = "calm"

    # Never hand back a line this conversation has already heard.
    if line in said:
        line = (f"I have said my piece on that. Ask me something the {place} has not already answered — "
                "what have you touched since we last spoke?")
        mood = "amused"

    suggestions = ["What should I count?", "Where is the key?", "Who were you?"]
    if topic == "mechanism":
        suggestions = ["I am still stuck.", "Which objects exactly?", "What is this place?"]
    elif topic == "exit":
        suggestions = ["Where is it hidden?", "What opens the lock?", "Is something following me?"]

    return {"line": line, "mood": mood, "suggestions": suggestions}


def generate_story(room_theme: str, progress: dict, user_id: int | None = None) -> dict:
    def via_llm() -> dict:
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

    return _run("story", f"story:{room_theme}", via_llm, fallback, user_id)
