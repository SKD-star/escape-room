"""Shared Flask extension singletons (avoids circular imports)."""
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
