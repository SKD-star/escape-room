"""Auth helpers — JWT issue/verify + route decorators + rate limiting."""
import time
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import current_app, g, jsonify, request

from models import User

# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

def issue_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc)
        + timedelta(hours=current_app.config["JWT_EXPIRES_HOURS"]),
    }
    return jwt.encode(payload, current_app.config["JWT_SECRET_KEY"], algorithm="HS256")


def _decode_token() -> dict | None:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    try:
        return jwt.decode(
            header[7:], current_app.config["JWT_SECRET_KEY"], algorithms=["HS256"]
        )
    except jwt.PyJWTError:
        return None


def auth_required(fn):
    """Route decorator — 401 unless a valid JWT is presented. Sets g.user."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        payload = _decode_token()
        if payload is None:
            return jsonify({"error": "Authentication required"}), 401
        user = User.query.get(int(payload["sub"]))
        if user is None or not user.is_active:
            return jsonify({"error": "Account not found or disabled"}), 401
        g.user = user
        return fn(*args, **kwargs)
    return wrapper


def auth_optional(fn):
    """Sets g.user when a valid token is present, otherwise g.user = None."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        payload = _decode_token()
        g.user = User.query.get(int(payload["sub"])) if payload else None
        return fn(*args, **kwargs)
    return wrapper


def admin_required(fn):
    @wraps(fn)
    @auth_required
    def wrapper(*args, **kwargs):
        if g.user.role != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return fn(*args, **kwargs)
    return wrapper


# ---------------------------------------------------------------------------
# Simple in-memory rate limiter (per IP + route bucket)
# ---------------------------------------------------------------------------

_BUCKETS: dict[str, list[float]] = {}


def rate_limit(max_calls: int, per_seconds: int):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            key = f"{request.remote_addr}:{request.endpoint}"
            now = time.monotonic()
            bucket = [t for t in _BUCKETS.get(key, []) if now - t < per_seconds]
            if len(bucket) >= max_calls:
                return jsonify({"error": "Too many requests, slow down"}), 429
            bucket.append(now)
            _BUCKETS[key] = bucket
            return fn(*args, **kwargs)
        return wrapper
    return decorator
