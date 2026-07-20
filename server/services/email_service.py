"""Email service — password reset delivery with console fallback in dev."""
import logging
import smtplib
from email.mime.text import MIMEText

from flask import current_app

log = logging.getLogger(__name__)


def send_password_reset(to_email: str, token: str) -> bool:
    """Send a reset link. Falls back to logging the token when SMTP is unset."""
    cfg = current_app.config
    reset_url = f"http://localhost:3000/?reset_token={token}"
    body = (
        "You requested a password reset for AI Powered Escape Room.\n\n"
        f"Open this link to set a new password (valid 1 hour):\n{reset_url}\n\n"
        "If you didn't request this, ignore this email."
    )

    if not cfg["EMAIL_HOST"] or not cfg["EMAIL_USERNAME"]:
        log.warning("SMTP not configured — reset token for %s: %s", to_email, token)
        return False

    msg = MIMEText(body)
    msg["Subject"] = "Escape Room — Password Reset"
    msg["From"] = cfg["EMAIL_USERNAME"]
    msg["To"] = to_email
    try:
        with smtplib.SMTP(cfg["EMAIL_HOST"], cfg["EMAIL_PORT"], timeout=10) as smtp:
            smtp.starttls()
            smtp.login(cfg["EMAIL_USERNAME"], cfg["EMAIL_PASSWORD"])
            smtp.send_message(msg)
        return True
    except Exception:  # noqa: BLE001 — never break the API on mail failure
        log.exception("Failed to send reset email")
        return False
