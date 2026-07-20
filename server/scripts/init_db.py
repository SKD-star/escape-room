"""Initialize the database — creates all tables. Safe to run repeatedly."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app
from extensions import db


def main() -> None:
    app = create_app()
    with app.app_context():
        db.create_all()
        print(f"[OK] Database ready: {app.config['SQLALCHEMY_DATABASE_URI']}")


if __name__ == "__main__":
    main()
