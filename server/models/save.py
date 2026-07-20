"""Game save slots — full serialized game state as JSON."""
from datetime import datetime, timezone

from extensions import db


class GameSave(db.Model):
    __tablename__ = "game_saves"
    __table_args__ = (
        db.UniqueConstraint("user_id", "slot", name="uq_save_user_slot"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    slot = db.Column(db.Integer, default=0, nullable=False)  # 0 = autosave
    save_type = db.Column(db.String(16), default="manual")   # auto | manual | checkpoint
    room_id = db.Column(db.String(48), nullable=False)
    playtime_s = db.Column(db.Integer, default=0, nullable=False)
    # Full engine state: inventory, solved puzzles, flags, player transform…
    state_json = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self, include_state: bool = True) -> dict:
        data = {
            "id": self.id,
            "slot": self.slot,
            "save_type": self.save_type,
            "room_id": self.room_id,
            "playtime_s": self.playtime_s,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_state:
            data["state_json"] = self.state_json
        return data
