# Deployment Guide

## Option A — Docker (recommended)

```bash
cp .env.example .env       # fill SECRET_KEY, JWT_SECRET_KEY, MYSQL_PASSWORD, (OPENAI_API_KEY)
docker compose up -d --build
```

Services:
- `web` — nginx serving the built game + reverse proxy → http://localhost:8080
- `api` — Flask via gunicorn
- `db` — MySQL 8 with a persistent volume

First-run initialization:
```bash
docker compose exec api python scripts/init_db.py
docker compose exec api python scripts/seed.py
docker compose exec api python scripts/create_admin.py admin admin@example.com <password>
```

## Option B — Manual VPS

### 1. Build the frontend
```bash
npm ci && npm run build          # → client/dist/
```

### 2. Run the API with gunicorn
```bash
pip install -r requirements.txt gunicorn
gunicorn -w 4 -b 127.0.0.1:5000 'app:create_app()' --chdir server
```

### 3. nginx
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    root /srv/escape-room/client/dist;
    index index.html;

    location / { try_files $uri /index.html; }

    location /api/   { proxy_pass http://127.0.0.1:5000; proxy_set_header Host $host; }
    location /admin/ { proxy_pass http://127.0.0.1:5000; proxy_set_header Host $host; }

    # Static asset caching
    location /assets/ { expires 30d; add_header Cache-Control "public, immutable"; }

    gzip on;
    gzip_types application/javascript text/css application/wasm;
}
```

### 4. systemd unit (`/etc/systemd/system/escape-api.service`)
```ini
[Unit]
Description=Escape Room API
After=network.target mysql.service

[Service]
WorkingDirectory=/srv/escape-room/server
EnvironmentFile=/srv/escape-room/.env
ExecStart=/srv/escape-room/venv/bin/gunicorn -w 4 -b 127.0.0.1:5000 'app:create_app()'
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

## Production checklist

- [ ] `FLASK_ENV=production` in `.env` (disables debug)
- [ ] Strong `SECRET_KEY` / `JWT_SECRET_KEY` (32+ random bytes each)
- [ ] MySQL configured (`MYSQL_HOST` set) — do not ship SQLite to production
- [ ] HTTPS via certbot/Let's Encrypt (`certbot --nginx`)
- [ ] Restrict CORS origins in `server/app.py` to your domain
- [ ] Database backups (`mysqldump` cron or managed DB snapshots)
- [ ] `docker compose logs -f api` or journald for monitoring
- [ ] OpenAI usage limits set in the OpenAI dashboard (cost control)
