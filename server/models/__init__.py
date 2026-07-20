"""Database models package — imports every model so `db.create_all()` sees them."""
from .user import User, PasswordReset
from .save import GameSave
from .achievement import Achievement, UserAchievement
from .leaderboard import LeaderboardEntry
from .analytics import AnalyticsEvent
from .puzzle import PuzzleRecord, AILog
from .room import RoomMeta
from .setting import UserSetting

__all__ = [
    "User", "PasswordReset", "GameSave", "Achievement", "UserAchievement",
    "LeaderboardEntry", "AnalyticsEvent", "PuzzleRecord", "AILog",
    "RoomMeta", "UserSetting",
]
