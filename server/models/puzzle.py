"""Puzzle history + AI generation logs."""
from datetime import datetime, timezone

from extensions import db


class PuzzleRecord(db.Model):
    """One puzzle attempt by one player (history for adaptive difficulty)."""
    __tablename__ = "puzzle_history"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), index=True)
    room_id = db.Column(db.String(48), nullable=False)
    puzzle_type = db.Column(db.String(48), nullable=False)
    difficulty = db.Column(db.Float, default=0.5, nullable=False)
    solved = db.Column(db.Boolean, default=False, nullable=False)
    solve_time_s = db.Column(db.Integer, default=0, nullable=False)
    hints_used = db.Column(db.Integer, default=0, nullable=False)
    ai_generated = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    def to_dict(self) -> dict:
        return {
            "room_id": self.room_id,
            "puzzle_type": self.puzzle_type,
            "difficulty": self.difficulty,
            "solved": self.solved,
            "solve_time_s": self.solve_time_s,
            "hints_used": self.hints_used,
            "ai_generated": self.ai_generated,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class AILog(db.Model):
    """Every AI request/response — inspectable from the admin dashboard."""
    __tablename__ = "ai_logs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), index=True)
    kind = db.Column(db.String(32), nullable=False)  # puzzle | hint | dialogue | story
    provider = db.Column(db.String(32), default="fallback")  # openai | fallback
    model = db.Column(db.String(48))
    prompt_summary = db.Column(db.String(255))
    response_json = db.Column(db.Text)
    latency_ms = db.Column(db.Integer, default=0)
    success = db.Column(db.Boolean, default=True, nullable=False)
    error = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "kind": self.kind,
            "provider": self.provider,
            "model": self.model,
            "prompt_summary": self.prompt_summary,
            "latency_ms": self.latency_ms,
            "success": self.success,
            "error": self.error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
