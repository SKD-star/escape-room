"""Authored puzzle bank — hand-written puzzles admins add from the dashboard.

These are served in-game as a preferred source over the procedural fallback
(and as a graceful backstop whenever OpenAI is unavailable), so a designer can
inject bespoke content without touching code.

`payload_json` holds the type-specific fields the client expects:
  keypad   -> {"code": "1234", "clue": "..."}
  riddle   -> {"riddle": "...", "answer": "word"}
  sequence -> {"sequence": ["moon", "eye", ...], "clue": "..."}
"""
import json
from datetime import datetime, timezone

from extensions import db

VALID_TYPES = ("keypad", "riddle", "sequence")


class PuzzleBank(db.Model):
    __tablename__ = "puzzle_bank"

    id = db.Column(db.Integer, primary_key=True)
    theme = db.Column(db.String(32), nullable=False, index=True)
    type = db.Column(db.String(16), nullable=False)  # keypad | riddle | sequence
    title = db.Column(db.String(120), nullable=False, default="The Mechanism")
    narrative = db.Column(db.Text, default="")
    difficulty = db.Column(db.Float, default=0.5, nullable=False)
    payload_json = db.Column(db.Text, nullable=False, default="{}")
    enabled = db.Column(db.Boolean, default=True, nullable=False, index=True)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # -- serialization ----------------------------------------------------
    @property
    def payload(self) -> dict:
        try:
            return json.loads(self.payload_json or "{}")
        except (ValueError, TypeError):
            return {}

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "theme": self.theme,
            "type": self.type,
            "title": self.title,
            "narrative": self.narrative,
            "difficulty": round(self.difficulty, 2),
            "payload": self.payload,
            "enabled": self.enabled,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def to_puzzle(self) -> dict:
        """Shape the client's PuzzleManager understands."""
        return {
            "type": self.type,
            "title": self.title,
            "narrative": self.narrative,
            "difficulty": self.difficulty,
            "source": "bank",
            **self.payload,
        }
