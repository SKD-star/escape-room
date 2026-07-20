"""Leaderboard — best completion runs."""
from datetime import datetime, timezone

from extensions import db


class LeaderboardEntry(db.Model):
    __tablename__ = "leaderboard"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    username = db.Column(db.String(32), nullable=False)  # denormalized for fast reads
    completion_time_s = db.Column(db.Integer, nullable=False, index=True)
    rooms_cleared = db.Column(db.Integer, default=0, nullable=False)
    puzzles_solved = db.Column(db.Integer, default=0, nullable=False)
    hints_used = db.Column(db.Integer, default=0, nullable=False)
    ending = db.Column(db.String(32), default="standard")
    score = db.Column(db.Integer, default=0, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "username": self.username,
            "completion_time_s": self.completion_time_s,
            "rooms_cleared": self.rooms_cleared,
            "puzzles_solved": self.puzzles_solved,
            "hints_used": self.hints_used,
            "ending": self.ending,
            "score": self.score,
            "date": self.created_at.isoformat() if self.created_at else None,
        }
