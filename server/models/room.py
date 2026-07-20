"""Room metadata — mirrors client room definitions so the admin panel can manage them."""
from extensions import db


class RoomMeta(db.Model):
    __tablename__ = "rooms"

    id = db.Column(db.Integer, primary_key=True)
    room_key = db.Column(db.String(48), unique=True, nullable=False, index=True)
    name = db.Column(db.String(80), nullable=False)
    theme = db.Column(db.String(48), nullable=False)
    order_index = db.Column(db.Integer, default=0, nullable=False)
    story = db.Column(db.Text)
    base_difficulty = db.Column(db.Float, default=0.5, nullable=False)
    enabled = db.Column(db.Boolean, default=True, nullable=False)

    def to_dict(self) -> dict:
        return {
            "room_key": self.room_key,
            "name": self.name,
            "theme": self.theme,
            "order_index": self.order_index,
            "story": self.story,
            "base_difficulty": self.base_difficulty,
            "enabled": self.enabled,
        }
