"""
Configuration — AI Powered Escape Room server.

All values come from environment variables (.env). The database falls
back to SQLite when MYSQL_HOST is unset so the project runs with zero
manual setup in development.
"""
import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR.parent / ".env")


def _database_uri() -> str:
    """DATABASE_URL (managed Postgres) → MySQL (if reachable) → local SQLite.

    On a host like Render, DATABASE_URL is injected for the managed Postgres
    instance. Locally, MySQL is used when configured AND reachable, otherwise
    a zero-setup SQLite file (the reachability probe keeps `npm start` working
    even when XAMPP's MySQL isn't running).
    """
    # 1) Managed database via a single connection string (Render/Heroku/etc.)
    db_url = os.getenv("DATABASE_URL", "").strip()
    if db_url:
        # These hosts emit the legacy `postgres://` scheme; SQLAlchemy needs
        # an explicit driver.
        if db_url.startswith("postgres://"):
            db_url = "postgresql+psycopg2://" + db_url[len("postgres://"):]
        elif db_url.startswith("postgresql://"):
            db_url = "postgresql+psycopg2://" + db_url[len("postgresql://"):]
        return db_url

    # 2) MySQL when configured AND reachable
    host = os.getenv("MYSQL_HOST", "").strip()
    if host:
        port = int(os.getenv("MYSQL_PORT", "3306") or 3306)
        import socket
        try:
            with socket.create_connection((host, port), timeout=1.5):
                pass
        except OSError:
            print(f"[config] MySQL at {host}:{port} unreachable — falling back "
                  "to SQLite. Start MySQL in the XAMPP Control Panel to use it.")
            return f"sqlite:///{BASE_DIR / 'escape_room.db'}"
        user = os.getenv("MYSQL_USERNAME", "root")
        password = os.getenv("MYSQL_PASSWORD", "")
        name = os.getenv("MYSQL_DATABASE", "escape_room")
        return f"mysql+pymysql://{user}:{password}@{host}:{port}/{name}?charset=utf8mb4"
    return f"sqlite:///{BASE_DIR / 'escape_room.db'}"


class Config:
    # Core
    SECRET_KEY = os.getenv("SECRET_KEY") or secrets.token_hex(32)
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or SECRET_KEY
    JWT_EXPIRES_HOURS = int(os.getenv("JWT_EXPIRES_HOURS", "24"))
    ENV = os.getenv("FLASK_ENV", "development")
    DEBUG = ENV == "development"
    PORT = int(os.getenv("PORT", "5000"))

    # Database
    SQLALCHEMY_DATABASE_URI = _database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = (
        {"pool_pre_ping": True, "pool_recycle": 280}
        if SQLALCHEMY_DATABASE_URI.startswith(("mysql", "postgresql"))
        else {}
    )

    # AI — any OpenAI-compatible provider (OpenRouter, OpenAI, Groq, …).
    # OpenRouter keys (sk-or-…) are detected automatically and routed to the
    # free model pool, so the game needs no paid account.
    AI_API_KEY = (
        os.getenv("AI_API_KEY", "")
        or os.getenv("OPENROUTER_API_KEY", "")
        or os.getenv("OPENAI_API_KEY", "")
    ).strip()
    AI_BASE_URL = os.getenv("AI_BASE_URL", "").strip()      # blank → inferred from key
    AI_MODEL = os.getenv("AI_MODEL", "").strip()            # blank → provider default chain
    # Sent to OpenRouter for its public app rankings (harmless elsewhere).
    AI_SITE_URL = os.getenv("AI_SITE_URL", "http://localhost:5173").strip()
    AI_SITE_NAME = os.getenv("AI_SITE_NAME", "AI Powered Escape Room").strip()

    # Legacy aliases — older code/docs still reference these names.
    OPENAI_API_KEY = AI_API_KEY
    OPENAI_MODEL = AI_MODEL

    # Email (forgot password)
    EMAIL_HOST = os.getenv("EMAIL_HOST", "")
    EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587") or 587)
    EMAIL_USERNAME = os.getenv("EMAIL_USERNAME", "")
    EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "")
