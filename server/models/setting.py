"""Per-user settings synced across devices (audio/video/controls)."""
from extensions import db


class UserSetting(db.Model):
    __tablename__ = "user_settings"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)
    settings_json = db.Column(db.Text, nullable=False, default="{}")
