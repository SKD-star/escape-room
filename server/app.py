"""
AI Powered Escape Room — Flask application entry point.

Run:  python server/app.py
"""
import logging
import sys
from pathlib import Path

# Allow `python server/app.py` from repo root
sys.path.insert(0, str(Path(__file__).resolve().parent))

from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from extensions import db


def create_app(config_class=Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    db.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}, r"/admin/api/*": {"origins": "*"}})

    # Blueprints
    from api.auth import bp as auth_bp
    from api.game import bp as game_bp
    from api.ai import bp as ai_bp
    from admin import bp as admin_bp
    app.register_blueprint(auth_bp)
    app.register_blueprint(game_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(admin_bp)

    @app.get("/api/health")
    def health():
        return jsonify({
            "status": "ok",
            "database": app.config["SQLALCHEMY_DATABASE_URI"].split(":")[0],
            "ai": "openai" if app.config["OPENAI_API_KEY"] else "fallback",
        })

    @app.errorhandler(404)
    def not_found(_e):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(500)
    def server_error(_e):
        return jsonify({"error": "Internal server error"}), 500

    with app.app_context():
        import models  # noqa: F401 — register models
        db.create_all()

    return app


if __name__ == "__main__":
    application = create_app()
    application.run(host="127.0.0.1", port=Config.PORT, debug=Config.DEBUG)
