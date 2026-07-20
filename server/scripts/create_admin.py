"""Create (or promote) an admin user.

Usage:
    python server/scripts/create_admin.py [username] [email] [password]
Defaults to admin / admin@escaperoom.local / prompts for password.
"""
import getpass
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app
from extensions import db
from models import User


def main() -> None:
    username = sys.argv[1] if len(sys.argv) > 1 else "admin"
    email = sys.argv[2] if len(sys.argv) > 2 else "admin@escaperoom.local"
    password = sys.argv[3] if len(sys.argv) > 3 else None
    if not password:
        password = getpass.getpass("Admin password (min 8 chars): ")
    if len(password) < 8:
        print("[X] Password must be at least 8 characters")
        sys.exit(1)

    app = create_app()
    with app.app_context():
        user = User.query.filter(
            (User.username == username) | (User.email == email)
        ).first()
        if user:
            user.role = "admin"
            user.set_password(password)
            print(f"[OK] Existing user '{user.username}' promoted to admin")
        else:
            user = User(username=username, email=email, role="admin")
            user.set_password(password)
            db.session.add(user)
            print(f"[OK] Admin user '{username}' created")
        db.session.commit()


if __name__ == "__main__":
    main()
