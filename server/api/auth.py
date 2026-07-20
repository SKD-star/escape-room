"""Authentication API — register, login, profile, forgot/reset password."""
import re
from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request

from extensions import db
from models import PasswordReset, User
from services.email_service import send_password_reset
from .security import auth_required, issue_token, rate_limit

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,32}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _json() -> dict:
    return request.get_json(silent=True) or {}


@bp.post("/register")
@rate_limit(10, 60)
def register():
    data = _json()
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not USERNAME_RE.match(username):
        return jsonify({"error": "Username must be 3-32 chars (letters, digits, _)"}), 400
    if not EMAIL_RE.match(email):
        return jsonify({"error": "Invalid email address"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400
    if User.query.filter((User.username == username) | (User.email == email)).first():
        return jsonify({"error": "Username or email already taken"}), 409

    user = User(username=username, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({"token": issue_token(user), "user": user.to_dict()}), 201


@bp.post("/login")
@rate_limit(15, 60)
def login():
    data = _json()
    identifier = (data.get("username") or data.get("email") or "").strip()
    password = data.get("password") or ""

    user = User.query.filter(
        (User.username == identifier) | (User.email == identifier.lower())
    ).first()
    if user is None or not user.check_password(password):
        return jsonify({"error": "Invalid credentials"}), 401
    if not user.is_active:
        return jsonify({"error": "Account disabled"}), 403

    user.last_login = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({"token": issue_token(user), "user": user.to_dict(include_stats=True)})


@bp.get("/me")
@auth_required
def me():
    return jsonify({"user": g.user.to_dict(include_stats=True)})


@bp.post("/forgot-password")
@rate_limit(5, 300)
def forgot_password():
    email = (_json().get("email") or "").strip().lower()
    user = User.query.filter_by(email=email).first()
    # Always answer 200 to avoid account enumeration
    if user:
        reset = PasswordReset.issue(user.id)
        db.session.add(reset)
        db.session.commit()
        send_password_reset(user.email, reset.token)
    return jsonify({"message": "If that email exists, a reset link has been sent."})


@bp.post("/reset-password")
@rate_limit(10, 300)
def reset_password():
    data = _json()
    token = data.get("token") or ""
    password = data.get("password") or ""
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    reset = PasswordReset.query.filter_by(token=token).first()
    if reset is None or not reset.is_valid:
        return jsonify({"error": "Invalid or expired reset token"}), 400

    user = User.query.get(reset.user_id)
    user.set_password(password)
    reset.used = True
    db.session.commit()
    return jsonify({"message": "Password updated. You can log in now."})
