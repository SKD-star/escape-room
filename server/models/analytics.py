"""Player analytics events — used by adaptive difficulty and the admin dashboard."""
from datetime import datetime, timezone

from extensions import db


class AnalyticsEvent(db.Model):
    __tablename__ = "analytics_events"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), index=True)
    session_id = db.Column(db.String(64), index=True)
    event_type = db.Column(db.String(48), nullable=False, index=True)
    # e.g. room_entered, puzzle_started, puzzle_solved, puzzle_failed,
    #      hint_requested, item_collected, death, ending_reached, fps_sample
    room_id = db.Column(db.String(48))
    payload_json = db.Column(db.Text)  # arbitrary structured detail
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "event_type": self.event_type,
            "room_id": self.room_id,
            "payload_json": self.payload_json,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
