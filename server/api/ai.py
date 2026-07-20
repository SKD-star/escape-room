"""AI API — puzzle/hint/dialogue/story endpoints backed by ai_service."""
from flask import Blueprint, g, jsonify, request

from models import RoomMeta
from services import ai_service
from services.difficulty import target_difficulty
from .security import auth_optional, rate_limit

bp = Blueprint("ai", __name__, url_prefix="/api/ai")


def _json() -> dict:
    return request.get_json(silent=True) or {}


@bp.post("/puzzle")
@auth_optional
@rate_limit(30, 60)
def puzzle():
    data = _json()
    theme = str(data.get("theme", "library"))[:32]
    room = RoomMeta.query.filter_by(room_key=str(data.get("room_id", ""))[:48]).first()
    base = room.base_difficulty if room else float(data.get("base_difficulty", 0.5) or 0.5)
    difficulty = target_difficulty(g.user, base)
    result = ai_service.generate_puzzle(
        theme, difficulty,
        user_id=g.user.id if g.user else None,
        context=str(data.get("context", ""))[:400],
    )
    return jsonify(result)


@bp.post("/hint")
@auth_optional
@rate_limit(20, 60)
def hint():
    data = _json()
    puzzle_data = data.get("puzzle")
    if not isinstance(puzzle_data, dict):
        return jsonify({"error": "puzzle object required"}), 400
    tier = int(data.get("tier", 0) or 0)
    result = ai_service.generate_hint(
        puzzle_data, tier, user_id=g.user.id if g.user else None
    )
    return jsonify(result)


@bp.post("/dialogue")
@auth_optional
@rate_limit(30, 60)
def dialogue():
    data = _json()
    message = str(data.get("message", "")).strip()
    if not message:
        return jsonify({"error": "message required"}), 400
    history = data.get("history")
    result = ai_service.generate_dialogue(
        str(data.get("npc", "The Warden"))[:48],
        str(data.get("theme", "library"))[:32],
        message,
        history=history if isinstance(history, list) else None,
        user_id=g.user.id if g.user else None,
    )
    return jsonify(result)


@bp.post("/story")
@auth_optional
@rate_limit(20, 60)
def story():
    data = _json()
    progress = data.get("progress")
    result = ai_service.generate_story(
        str(data.get("theme", "library"))[:32],
        progress if isinstance(progress, dict) else {},
        user_id=g.user.id if g.user else None,
    )
    return jsonify(result)
