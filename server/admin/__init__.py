"""Admin dashboard — server-rendered Jinja2 panel.

Login uses the same JWT API; this blueprint serves the SPA-ish admin UI and
JSON data endpoints guarded by admin_required.
"""
import json
from datetime import datetime, timedelta, timezone

from flask import Blueprint, g, jsonify, render_template, request
from sqlalchemy import func

from extensions import db
from models import (
    AILog, AnalyticsEvent, GameSave, LeaderboardEntry,
    PuzzleBank, PuzzleRecord, RoomMeta, User,
)
from models.puzzle_bank import VALID_TYPES
from api.security import admin_required

bp = Blueprint(
    "admin", __name__,
    url_prefix="/admin",
    template_folder="templates",
    static_folder="static",
)


@bp.get("/")
def dashboard_page():
    return render_template("admin.html")


# ---------------------------------------------------------------------------
# JSON data endpoints (all admin-only)
# ---------------------------------------------------------------------------

@bp.get("/api/stats")
@admin_required
def stats():
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    total_users = db.session.query(func.count(User.id)).scalar() or 0
    new_users = db.session.query(func.count(User.id)).filter(
        User.created_at >= week_ago).scalar() or 0
    total_saves = db.session.query(func.count(GameSave.id)).scalar() or 0
    puzzles_solved = db.session.query(func.count(PuzzleRecord.id)).filter(
        PuzzleRecord.solved.is_(True)).scalar() or 0
    puzzles_failed = db.session.query(func.count(PuzzleRecord.id)).filter(
        PuzzleRecord.solved.is_(False)).scalar() or 0
    ai_calls = db.session.query(func.count(AILog.id)).scalar() or 0
    ai_openai = db.session.query(func.count(AILog.id)).filter(
        AILog.provider == "openai").scalar() or 0
    events_7d = db.session.query(func.count(AnalyticsEvent.id)).filter(
        AnalyticsEvent.created_at >= week_ago).scalar() or 0

    # Players active in the last 15 minutes (distinct sessions with events)
    active_since = datetime.now(timezone.utc) - timedelta(minutes=15)
    active_now = db.session.query(
        func.count(func.distinct(AnalyticsEvent.session_id))
    ).filter(AnalyticsEvent.created_at >= active_since).scalar() or 0

    bank_puzzles = db.session.query(func.count(PuzzleBank.id)).scalar() or 0

    # Events per day for chart
    daily = (
        db.session.query(
            func.date(AnalyticsEvent.created_at).label("day"),
            func.count(AnalyticsEvent.id),
        )
        .filter(AnalyticsEvent.created_at >= week_ago)
        .group_by("day").order_by("day").all()
    )

    return jsonify({
        "total_users": total_users,
        "new_users_7d": new_users,
        "total_saves": total_saves,
        "puzzles_solved": puzzles_solved,
        "puzzles_failed": puzzles_failed,
        "solve_rate": round(puzzles_solved / max(1, puzzles_solved + puzzles_failed), 3),
        "ai_calls": ai_calls,
        "ai_openai_share": round(ai_openai / max(1, ai_calls), 3),
        "events_7d": events_7d,
        "active_now": active_now,
        "bank_puzzles": bank_puzzles,
        "events_daily": [{"day": str(d), "count": c} for d, c in daily],
    })


@bp.get("/api/users")
@admin_required
def users():
    q = User.query
    search = (request.args.get("q") or "").strip()
    if search:
        like = f"%{search}%"
        q = q.filter((User.username.ilike(like)) | (User.email.ilike(like)))
    page = max(1, int(request.args.get("page", 1)))
    rows = q.order_by(User.created_at.desc()).paginate(page=page, per_page=20,
                                                       error_out=False)
    return jsonify({
        "users": [u.to_dict(include_stats=True) | {"is_active": u.is_active}
                  for u in rows.items],
        "pages": rows.pages,
        "page": page,
    })


@bp.post("/api/users/<int:user_id>/toggle")
@admin_required
def toggle_user(user_id: int):
    user = User.query.get_or_404(user_id)
    if user.role == "admin":
        return jsonify({"error": "Cannot disable an admin"}), 400
    user.is_active = not user.is_active
    db.session.commit()
    return jsonify({"id": user.id, "is_active": user.is_active})


@bp.get("/api/rooms")
@admin_required
def rooms():
    return jsonify({"rooms": [r.to_dict() for r in
                              RoomMeta.query.order_by(RoomMeta.order_index).all()]})


@bp.post("/api/rooms")
@admin_required
def create_room():
    data = request.get_json(silent=True) or {}
    room_key = (data.get("room_key") or "").strip().lower().replace(" ", "_")[:48]
    name = (data.get("name") or "").strip()[:80]
    theme = (data.get("theme") or "library").strip()[:48]
    if not room_key or not name:
        return jsonify({"error": "room_key and name are required"}), 400
    if RoomMeta.query.filter_by(room_key=room_key).first():
        return jsonify({"error": "A room with that key already exists"}), 409

    next_index = (db.session.query(func.max(RoomMeta.order_index)).scalar() or -1) + 1
    room = RoomMeta(
        room_key=room_key,
        name=name,
        theme=theme,
        order_index=int(data.get("order_index", next_index)),
        base_difficulty=max(0.1, min(0.95, float(data.get("base_difficulty", 0.5) or 0.5))),
        story=(data.get("story") or "").strip() or None,
        enabled=bool(data.get("enabled", True)),
    )
    db.session.add(room)
    db.session.commit()
    return jsonify(room.to_dict()), 201


@bp.post("/api/rooms/<room_key>")
@admin_required
def update_room(room_key: str):
    room = RoomMeta.query.filter_by(room_key=room_key).first_or_404()
    data = request.get_json(silent=True) or {}
    if "enabled" in data:
        room.enabled = bool(data["enabled"])
    if "base_difficulty" in data:
        room.base_difficulty = max(0.1, min(0.95, float(data["base_difficulty"])))
    if "name" in data and str(data["name"]).strip():
        room.name = str(data["name"]).strip()[:80]
    if "theme" in data and str(data["theme"]).strip():
        room.theme = str(data["theme"]).strip()[:48]
    if "order_index" in data:
        room.order_index = int(data["order_index"])
    if "story" in data:
        room.story = str(data["story"]).strip() or None
    db.session.commit()
    return jsonify(room.to_dict())


@bp.post("/api/rooms/<room_key>/move")
@admin_required
def move_room(room_key: str):
    """Shift a room up or down one slot, then normalize all order_index to
    0..n-1 so the ordering stays clean regardless of prior gaps/duplicates."""
    direction = (request.get_json(silent=True) or {}).get("direction")
    if direction not in ("up", "down"):
        return jsonify({"error": "direction must be 'up' or 'down'"}), 400

    rooms = RoomMeta.query.order_by(RoomMeta.order_index, RoomMeta.id).all()
    idx = next((i for i, r in enumerate(rooms) if r.room_key == room_key), None)
    if idx is None:
        return jsonify({"error": "Room not found"}), 404

    swap = idx - 1 if direction == "up" else idx + 1
    if swap < 0 or swap >= len(rooms):
        return jsonify({"error": "Already at the edge"}), 400

    rooms[idx], rooms[swap] = rooms[swap], rooms[idx]
    for i, room in enumerate(rooms):
        room.order_index = i
    db.session.commit()
    return jsonify({"rooms": [r.to_dict() for r in rooms]})


@bp.delete("/api/rooms/<room_key>")
@admin_required
def delete_room(room_key: str):
    room = RoomMeta.query.filter_by(room_key=room_key).first_or_404()
    db.session.delete(room)
    db.session.commit()
    return jsonify({"deleted": room_key})


# ---------------------------------------------------------------------------
# Puzzle bank — admin-authored puzzles served in-game
# ---------------------------------------------------------------------------

@bp.get("/api/puzzle-bank")
@admin_required
def puzzle_bank():
    q = PuzzleBank.query
    theme = (request.args.get("theme") or "").strip()
    if theme:
        q = q.filter(PuzzleBank.theme == theme)
    rows = q.order_by(PuzzleBank.theme, PuzzleBank.difficulty).all()
    return jsonify({"puzzles": [p.to_dict() for p in rows]})


def _clean_payload(ptype: str, payload: dict) -> tuple[dict | None, str | None]:
    """Validate a puzzle payload for its type. Returns (payload, error)."""
    if not isinstance(payload, dict):
        return None, "payload must be an object"
    if ptype == "keypad":
        code = str(payload.get("code", "")).strip()
        if not code.isdigit():
            return None, "keypad needs a numeric 'code'"
        return {"code": code, "clue": str(payload.get("clue", "")).strip()}, None
    if ptype == "riddle":
        riddle = str(payload.get("riddle", "")).strip()
        answer = str(payload.get("answer", "")).strip().lower()
        if not riddle or not answer:
            return None, "riddle needs 'riddle' and 'answer'"
        return {"riddle": riddle, "answer": answer}, None
    if ptype == "sequence":
        seq = payload.get("sequence")
        if isinstance(seq, str):
            seq = [s.strip() for s in seq.split(",") if s.strip()]
        if not isinstance(seq, list) or len(seq) < 3:
            return None, "sequence needs at least 3 symbols"
        return {"sequence": [str(s).strip() for s in seq][:8],
                "clue": str(payload.get("clue", "")).strip()}, None
    return None, "unknown puzzle type"


@bp.post("/api/puzzle-bank")
@admin_required
def create_puzzle():
    data = request.get_json(silent=True) or {}
    ptype = (data.get("type") or "").strip()
    if ptype not in VALID_TYPES:
        return jsonify({"error": f"type must be one of {', '.join(VALID_TYPES)}"}), 400
    payload, err = _clean_payload(ptype, data.get("payload") or {})
    if err:
        return jsonify({"error": err}), 400
    puzzle = PuzzleBank(
        theme=(data.get("theme") or "library").strip()[:32],
        type=ptype,
        title=(data.get("title") or "The Mechanism").strip()[:120],
        narrative=(data.get("narrative") or "").strip(),
        difficulty=max(0.0, min(1.0, float(data.get("difficulty", 0.5) or 0.5))),
        payload_json=json.dumps(payload),
        enabled=bool(data.get("enabled", True)),
        created_by=g.user.id,
    )
    db.session.add(puzzle)
    db.session.commit()
    return jsonify(puzzle.to_dict()), 201


@bp.post("/api/puzzle-bank/<int:puzzle_id>")
@admin_required
def update_puzzle(puzzle_id: int):
    puzzle = PuzzleBank.query.get_or_404(puzzle_id)
    data = request.get_json(silent=True) or {}
    if "enabled" in data:
        puzzle.enabled = bool(data["enabled"])
    if "difficulty" in data:
        puzzle.difficulty = max(0.0, min(1.0, float(data["difficulty"])))
    if "title" in data and str(data["title"]).strip():
        puzzle.title = str(data["title"]).strip()[:120]
    if "narrative" in data:
        puzzle.narrative = str(data["narrative"]).strip()
    if "theme" in data and str(data["theme"]).strip():
        puzzle.theme = str(data["theme"]).strip()[:32]
    if "payload" in data:
        payload, err = _clean_payload(data.get("type", puzzle.type), data["payload"])
        if err:
            return jsonify({"error": err}), 400
        puzzle.payload_json = json.dumps(payload)
    db.session.commit()
    return jsonify(puzzle.to_dict())


@bp.delete("/api/puzzle-bank/<int:puzzle_id>")
@admin_required
def delete_puzzle(puzzle_id: int):
    puzzle = PuzzleBank.query.get_or_404(puzzle_id)
    db.session.delete(puzzle)
    db.session.commit()
    return jsonify({"deleted": puzzle_id})


# ---------------------------------------------------------------------------
# Live player monitoring
# ---------------------------------------------------------------------------

@bp.get("/api/active-players")
@admin_required
def active_players():
    """Sessions with activity in the last N minutes + their latest event."""
    minutes = max(1, min(120, int(request.args.get("minutes", 15))))
    since = datetime.now(timezone.utc) - timedelta(minutes=minutes)

    # Latest event timestamp per session in the window
    sessions = (
        db.session.query(
            AnalyticsEvent.session_id,
            AnalyticsEvent.user_id,
            func.max(AnalyticsEvent.created_at).label("last_seen"),
            func.count(AnalyticsEvent.id).label("events"),
        )
        .filter(AnalyticsEvent.created_at >= since)
        .filter(AnalyticsEvent.session_id.isnot(None))
        .group_by(AnalyticsEvent.session_id, AnalyticsEvent.user_id)
        .order_by(func.max(AnalyticsEvent.created_at).desc())
        .limit(100)
        .all()
    )

    # Resolve usernames + each session's most recent room in one pass
    user_ids = {s.user_id for s in sessions if s.user_id}
    names = {u.id: u.username for u in User.query.filter(User.id.in_(user_ids)).all()} \
        if user_ids else {}

    players = []
    for s in sessions:
        last_room = (
            db.session.query(AnalyticsEvent.room_id)
            .filter(AnalyticsEvent.session_id == s.session_id)
            .filter(AnalyticsEvent.room_id.isnot(None))
            .order_by(AnalyticsEvent.created_at.desc())
            .first()
        )
        players.append({
            "session_id": s.session_id,
            "username": names.get(s.user_id, "guest"),
            "user_id": s.user_id,
            "events": s.events,
            "room_id": last_room[0] if last_room else None,
            "last_seen": s.last_seen.isoformat() if s.last_seen else None,
        })
    return jsonify({"players": players, "window_minutes": minutes})


@bp.get("/api/puzzle-analytics")
@admin_required
def puzzle_analytics():
    rows = (
        db.session.query(
            PuzzleRecord.room_id,
            PuzzleRecord.puzzle_type,
            func.count(PuzzleRecord.id).label("attempts"),
            func.sum(func.cast(PuzzleRecord.solved, db.Integer)).label("solved"),
            func.avg(PuzzleRecord.solve_time_s).label("avg_time"),
            func.avg(PuzzleRecord.hints_used).label("avg_hints"),
        )
        .group_by(PuzzleRecord.room_id, PuzzleRecord.puzzle_type)
        .all()
    )
    return jsonify({"puzzles": [
        {
            "room_id": r.room_id,
            "puzzle_type": r.puzzle_type,
            "attempts": r.attempts,
            "solved": int(r.solved or 0),
            "avg_time_s": round(float(r.avg_time or 0), 1),
            "avg_hints": round(float(r.avg_hints or 0), 2),
        } for r in rows
    ]})


@bp.get("/api/leaderboard")
@admin_required
def admin_leaderboard():
    entries = LeaderboardEntry.query.order_by(
        LeaderboardEntry.score.desc()).limit(100).all()
    return jsonify({
        "leaderboard": [e.to_dict() | {"id": e.id} for e in entries],
        "total": db.session.query(func.count(LeaderboardEntry.id)).scalar() or 0,
    })


@bp.delete("/api/leaderboard/<int:entry_id>")
@admin_required
def delete_leaderboard_entry(entry_id: int):
    entry = LeaderboardEntry.query.get_or_404(entry_id)
    db.session.delete(entry)
    db.session.commit()
    return jsonify({"deleted": entry_id})


@bp.post("/api/leaderboard/reset")
@admin_required
def reset_leaderboard():
    """Wipe every leaderboard run. Irreversible — the UI double-confirms."""
    deleted = LeaderboardEntry.query.delete()
    db.session.commit()
    return jsonify({"deleted": deleted})


@bp.get("/api/ai-logs")
@admin_required
def ai_logs():
    page = max(1, int(request.args.get("page", 1)))
    rows = AILog.query.order_by(AILog.created_at.desc()).paginate(
        page=page, per_page=25, error_out=False)
    return jsonify({"logs": [l.to_dict() for l in rows.items],
                    "pages": rows.pages, "page": page})


@bp.get("/api/events")
@admin_required
def events():
    page = max(1, int(request.args.get("page", 1)))
    q = AnalyticsEvent.query
    etype = (request.args.get("type") or "").strip()
    if etype:
        q = q.filter(AnalyticsEvent.event_type == etype)
    rows = q.order_by(AnalyticsEvent.created_at.desc()).paginate(
        page=page, per_page=30, error_out=False)
    return jsonify({"events": [e.to_dict() for e in rows.items],
                    "pages": rows.pages, "page": page})
