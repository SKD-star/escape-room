"""Admin dashboard — server-rendered Jinja2 panel.

Login uses the same JWT API; this blueprint serves the SPA-ish admin UI and
JSON data endpoints guarded by admin_required.
"""
import json
from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, render_template, request
from sqlalchemy import func

from extensions import db
from models import (
    AILog, AnalyticsEvent, GameSave, LeaderboardEntry,
    PuzzleRecord, RoomMeta, User,
)
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


@bp.post("/api/rooms/<room_key>")
@admin_required
def update_room(room_key: str):
    room = RoomMeta.query.filter_by(room_key=room_key).first_or_404()
    data = request.get_json(silent=True) or {}
    if "enabled" in data:
        room.enabled = bool(data["enabled"])
    if "base_difficulty" in data:
        room.base_difficulty = max(0.1, min(0.95, float(data["base_difficulty"])))
    db.session.commit()
    return jsonify(room.to_dict())


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
    return jsonify({"leaderboard": [e.to_dict() for e in entries]})


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
