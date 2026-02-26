# AU Study Group Finder

Laravel API + React (Vite) frontend for study group discovery, chat, reports, ratings, and admin analytics.

## Stack
- Backend: Laravel 12, Sanctum, PostgreSQL
- Frontend: React + TypeScript + Vite

## Local Development

1. Install dependencies:
```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
```

2. Configure `.env` (DB, mail, app URLs), then run:
```bash
php artisan migrate
composer run dev
```

## Railway Deployment

Recommended: deploy as **2 services** from the same repo.

- Service A: `api` (Laravel backend)
- Service B: `web` (Vite frontend)

### Service A (Laravel API)

Use these commands in Railway:

- Build command:
```bash
composer install --no-dev --optimize-autoloader && php artisan package:discover --ansi
```

- Start command:
```bash
php artisan migrate --force && php artisan serve --host=0.0.0.0 --port=${PORT:-8080}
```

Required environment variables:
- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_KEY` (generate with `php artisan key:generate --show`)
- `APP_URL=https://<your-api-domain>`
- `FRONTEND_URL=https://<your-web-domain>`
- `DB_CONNECTION=pgsql`
- `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
- `SESSION_DRIVER=database`
- `CACHE_STORE=database`
- `QUEUE_CONNECTION=database`
- `SANCTUM_STATEFUL_DOMAINS=<your-web-domain-without-https>`
- `CORS_ALLOWED_ORIGINS=https://<your-web-domain>`
- `ENFORCE_SINGLE_ADMIN=false` (set to `true` only if you intentionally want one admin account policy)

Optional (email):
- `MAIL_MAILER=smtp`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS`

### Service B (Frontend)

Use these commands in Railway:

- Build command:
```bash
npm ci && npm run build
```

- Start command:
```bash
npx vite preview --host 0.0.0.0 --port ${PORT:-4173}
```

Required environment variables:
- `VITE_BASE_PATH=/` (or your subpath)
- `VITE_API_BASE_URL=https://<your-api-domain>/api`
- `VITE_STORAGE_URL=https://<your-api-domain>/storage`
- `VITE_API_KEY=<gemini-key-if-used>`

## Deploy-Ready Config Added

The repo now supports environment-driven deployment without code edits:
- API URL is read from `VITE_API_BASE_URL` (fallback: same-origin `/api`)
- Storage URL is read from `VITE_STORAGE_URL` (fallback: same-origin `/storage`)
- Vite base path is read from `VITE_BASE_PATH`
- Vite dev proxy target is configurable via `VITE_DEV_API_TARGET`

Files:
- `constants.ts`
- `vite.config.js`
- `vite-env.d.ts`
- `.env.example`

## Pre-Deploy Checklist

```bash
npm run build
php artisan test
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

After deployment, smoke test:
- `POST /api/login`
- `GET /api/discover/leaders`
- `GET /api/admin/dashboard` (admin token)
