# syntax=docker/dockerfile:1
# =============================================================
#  AI Powered Escape Room — API image (Flask + gunicorn)
# =============================================================
FROM python:3.12-slim AS api

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY server/ ./server/

WORKDIR /app/server
EXPOSE 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:create_app()"]
