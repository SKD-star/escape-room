"""Game API — saves, leaderboard, achievements, analytics, settings."""
import json
from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request

from extensions import db
from models import (
    AnalyticsEvent, Achievement, GameSave, LeaderboardEntry,
    PuzzleRecord, UserAchievement, UserSetting,
)
from services.difficulty import update_skill_rating
from .security import auth_optional, auth_required, rate_limit

bp = Blueprint("game", __name__, url_prefix="/api")

MAX_STATE_BYTES = 256 * 1024  # save-state payload cap


def _json() -> dict:
    return request.get_json(silent=True) or {}


# ---------------------------------------------------------------------------
# Saves
# ---------------------------------------------------------------------------

@bp.get("/saves")
@auth_required
def list_saves():
    saves = g.user.saves.order_by(GameSave.updated_at.desc()).all()
    return jsonify({"saves": [s.to_dict(include_state=False) for s in saves]})


@bp.get("/saves/<int:slot>")
@auth_required
def get_save(slot: int):
    save = g.user.saves.filter_by(slot=slot).first()
    if save is None:
        return jsonify({"error": "No save in that slot"}), 404
    return jsonify({"save": save.to_dict()})


@bp.put("/saves/<int:slot>")
@auth_required
def put_save(slot: int):
    data = _json()
    state = data.get("state_json")
    room_id = data.get("room_id")
    if not state or not room_id:
        return jsonify({"error": "state_json and room_id are required"}), 400
    if not isinstance(state, str):
        state = json.dumps(state)
    if len(state.encode()) > MAX_STATE_BYTES:
        return jsonify({"error": "Save state too large"}), 413
    if not 0 <= slot <= 8:
        return jsonify({"error": "Slot must be 0-8"}), 400

    save = g.user.saves.filter_by(slot=slot).first()
    if save is None:
        save = GameSave(user_id=g.user.id, slot=slot)
        db.session.add(save)
    save.state_json = state
    save.room_id = str(room_id)[:48]
    save.save_type = data.get("save_type", "manual")
    save.playtime_s = int(data.get("playtime_s", 0))
    db.session.commit()
    return jsonify({"save": save.to_dict(include_state=False)})


@bp.delete("/saves/<int:slot>")
@auth_required
def delete_save(slot: int):
    save = g.user.saves.filter_by(slot=slot).first()
    if save:
        db.session.delete(save)
        db.session.commit()
    return jsonify({"message": "deleted"})


# ---------------------------------------------------------------------------
# Leaderboard
# ---------------------------------------------------------------------------

@bp.get("/leaderboard")
def leaderboard():
    entries = (
        LeaderboardEntry.query.order_by(LeaderboardEntry.score.desc())
        .limit(50)
        .all()
    )
    return jsonify({"leaderboard": [e.to_dict() for e in entries]})


@bp.post("/leaderboard")
@auth_required
@rate_limit(5, 60)
def submit_run():
    data = _json()
    try:
        time_s = max(1, int(data["completion_time_s"]))
        rooms = max(0, min(10, int(data.get("rooms_cleared", 0))))
        puzzles = max(0, int(data.get("puzzles_solved", 0)))
        hints = max(0, int(data.get("hints_used", 0)))
    except (KeyError, ValueError, TypeError):
        return jsonify({"error": "Invalid run payload"}), 400

    # Score: room + puzzle progress minus time & hint penalties
    score = max(0, rooms * 1000 + puzzles * 250 - time_s // 6 - hints * 100)
    entry = LeaderboardEntry(
        user_id=g.user.id,
        username=g.user.username,
        completion_time_s=time_s,
        rooms_cleared=rooms,
        puzzles_solved=puzzles,
        hints_used=hints,
        ending=str(data.get("ending", "standard"))[:32],
        score=score,
    )
    db.session.add(entry)
    db.session.commit()
    rank = LeaderboardEntry.query.filter(LeaderboardEntry.score > score).count() + 1
    return jsonify({"entry": entry.to_dict(), "rank": rank}), 201


# ---------------------------------------------------------------------------
# Achievements
# ---------------------------------------------------------------------------

@bp.get("/achievements")
@auth_optional
def list_achievements():
    catalogue = Achievement.query.all()
    unlocked: set[int] = set()
    if g.user:
        unlocked = {ua.achievement_id for ua in g.user.achievements}
    return jsonify({
        "achievements": [
            {**a.to_dict(), "unlocked": a.id in unlocked} for a in catalogue
        ]
    })


@bp.post("/achievements/<code>/unlock")
@auth_required
def unlock_achievement(code: str):
    ach = Achievement.query.filter_by(code=code).first()
    if ach is None:
        return jsonify({"error": "Unknown achievement"}), 404
    exists = UserAchievement.query.filter_by(
        user_id=g.user.id, achievement_id=ach.id
    ).first()
    if exists is None:
        db.session.add(UserAchievement(user_id=g.user.id, achievement_id=ach.id))
        db.session.commit()
        return jsonify({"unlocked": ach.to_dict(), "new": True}), 201
    return jsonify({"unlocked": ach.to_dict(), "new": False})


# ---------------------------------------------------------------------------
# Analytics + puzzle history
# ---------------------------------------------------------------------------

@bp.post("/analytics")
@auth_optional
@rate_limit(120, 60)
def track_event():
    data = _json()
    event_type = str(data.get("event_type", ""))[:48]
    if not event_type:
        return jsonify({"error": "event_type required"}), 400
    payload = data.get("payload")
    db.session.add(AnalyticsEvent(
        user_id=g.user.id if g.user else None,
        session_id=str(data.get("session_id", ""))[:64],
        event_type=event_type,
        room_id=str(data.get("room_id", ""))[:48] or None,
        payload_json=json.dumps(payload) if payload is not None else None,
    ))
    db.session.commit()
    return jsonify({"ok": True}), 201


@bp.post("/puzzles/result")
@auth_required
@rate_limit(60, 60)
def puzzle_result():
    data = _json()
    record = PuzzleRecord(
        user_id=g.user.id,
        room_id=str(data.get("room_id", "unknown"))[:48],
        puzzle_type=str(data.get("puzzle_type", "unknown"))[:48],
        difficulty=float(data.get("difficulty", 0.5)),
        solved=bool(data.get("solved", False)),
        solve_time_s=max(0, int(data.get("solve_time_s", 0))),
        hints_used=max(0, int(data.get("hints_used", 0))),
        ai_generated=bool(data.get("ai_generated", False)),
    )
    db.session.add(record)
    update_skill_rating(g.user, record)
    db.session.commit()
    return jsonify({"skill_rating": round(g.user.skill_rating, 3)}), 201


# ---------------------------------------------------------------------------
# Settings sync
# ---------------------------------------------------------------------------

@bp.get("/settings")
@auth_required
def get_settings():
    row = UserSetting.query.filter_by(user_id=g.user.id).first()
    return jsonify({"settings": json.loads(row.settings_json) if row else {}})


@bp.put("/settings")
@auth_required
def put_settings():
    settings = _json().get("settings")
    if not isinstance(settings, dict):
        return jsonify({"error": "settings object required"}), 400
    row = UserSetting.query.filter_by(user_id=g.user.id).first()
    if row is None:
        row = UserSetting(user_id=g.user.id)
        db.session.add(row)
    row.settings_json = json.dumps(settings)[:16384]
    db.session.commit()
    return jsonify({"ok": True})
