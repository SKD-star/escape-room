"""User account + password reset models."""
from datetime import datetime, timedelta, timezone
import secrets

import bcrypt

from extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(32), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(128), nullable=False)
    role = db.Column(db.String(16), default="player", nullable=False)  # player | admin
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    last_login = db.Column(db.DateTime)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    # Rolling gameplay stats used by the adaptive-difficulty engine
    puzzles_solved = db.Column(db.Integer, default=0, nullable=False)
    puzzles_failed = db.Column(db.Integer, default=0, nullable=False)
    hints_used = db.Column(db.Integer, default=0, nullable=False)
    total_playtime_s = db.Column(db.Integer, default=0, nullable=False)
    avg_solve_time_s = db.Column(db.Float, default=0.0, nullable=False)
    skill_rating = db.Column(db.Float, default=0.5, nullable=False)  # 0..1

    saves = db.relationship("GameSave", backref="user", lazy="dynamic",
                            cascade="all, delete-orphan")
    achievements = db.relationship("UserAchievement", backref="user", lazy="dynamic",
                                   cascade="all, delete-orphan")

    # -- password helpers -------------------------------------------------
    def set_password(self, raw: str) -> None:
        self.password_hash = bcrypt.hashpw(raw.encode(), bcrypt.gensalt(12)).decode()

    def check_password(self, raw: str) -> bool:
        try:
            return bcrypt.checkpw(raw.encode(), self.password_hash.encode())
        except ValueError:
            return False

    def to_dict(self, include_stats: bool = False) -> dict:
        data = {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_stats:
            data.update({
                "puzzles_solved": self.puzzles_solved,
                "puzzles_failed": self.puzzles_failed,
                "hints_used": self.hints_used,
                "total_playtime_s": self.total_playtime_s,
                "skill_rating": round(self.skill_rating, 3),
            })
        return data


class PasswordReset(db.Model):
    __tablename__ = "password_resets"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    token = db.Column(db.String(64), unique=True, nullable=False, index=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, default=False, nullable=False)

    @classmethod
    def issue(cls, user_id: int) -> "PasswordReset":
        return cls(
            user_id=user_id,
            token=secrets.token_urlsafe(32),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )

    @property
    def is_valid(self) -> bool:
        expires = self.expires_at
        if expires.tzinfo is None:  # SQLite strips tzinfo
            expires = expires.replace(tzinfo=timezone.utc)
        return not self.used and expires > datetime.now(timezone.utc)
