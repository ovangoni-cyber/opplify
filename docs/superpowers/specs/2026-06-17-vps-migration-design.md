# Migration to self-hosted VPS — Design

## Context

Opplify.ai currently runs on Vercel (Next.js) + Vercel Postgres/Neon (database) — this was set up earlier today as a fast path off Supabase. The user wants full control over infrastructure instead of depending on managed platforms: own VPS, own Postgres instance, own deploy process. No domain yet — initial access is by IP over HTTP; HTTPS via Let's Encrypt is deferred until a domain is pointed at the server.

**Provider:** Hostealo (Spanish VPS provider, Madrid datacenter, KVM, anti-DDoS included). The user has already provisioned a VPS there.

**Recommended specs:** 2 vCPU / 4GB RAM / 40-80GB NVMe — comfortable headroom for Next.js + Postgres running together on one machine. OS: Ubuntu 24.04 LTS.

## Scope

- Containerize the Next.js app (Dockerfile).
- Docker Compose stack: `app` (Next.js) + `db` (Postgres 16) + `nginx` (reverse proxy, port 80, no TLS yet).
- One-time server setup: Docker install, repo clone, `.env.production`, schema load, first `docker compose up -d`.
- Manual deploy script (`deploy.sh`) for future updates — no CI/CD automation.
- Daily Postgres backup via cron + `pg_dump`, 7-day local retention.
- Verification checklist before decommissioning Vercel + Neon.

Out of scope (explicitly deferred): custom domain, HTTPS/Let's Encrypt, automated CI/CD deploys, off-server backup storage (e.g., uploading dumps somewhere external), monitoring/alerting, horizontal scaling.

## Architecture

```
┌─────────────────────────────────────┐
│ VPS (Ubuntu 24.04, Hostealo)         │
│                                       │
│  ┌──────────┐  ┌──────────┐         │
│  │  nginx   │→ │   app    │         │
│  │ :80      │  │ (Next.js)│         │
│  └──────────┘  └────┬─────┘         │
│                       │              │
│                  ┌────▼─────┐        │
│                  │    db    │        │
│                  │(Postgres)│        │
│                  └──────────┘        │
└─────────────────────────────────────┘
```

All three run as Docker Compose services on one `docker-compose.yml`, on a single Docker network (Compose creates this automatically) so `app` can reach `db` by hostname `db`, and `nginx` can reach `app` by hostname `app`. Only `nginx`'s port 80 is published to the host; `app` (3000) and `db` (5432) are reachable only within the Compose network, not from the internet.

## Files

- **Create:** `Dockerfile` — multi-stage build: install deps → `npm run build` → copy build output into a slim `node:20-alpine` runtime stage → `CMD ["npm", "run", "start"]`, listens on port 3000.
- **Create:** `docker-compose.yml` — defines `app`, `db`, `nginx` services as described above.
- **Create:** `nginx.conf` — single `server` block proxying all requests to `app:3000`, forwarding `Host`/`X-Forwarded-For` headers (the app needs the real client IP/host for things like `NEXT_PUBLIC_SITE_URL`-based redirects).
- **Create:** `deploy.sh` — `git pull origin master && docker compose up -d --build`.
- **Create:** `scripts/backup-db.sh` — committed to the repo, so it arrives on the server via `git clone`/`git pull` at `/opt/opplify/scripts/backup-db.sh`, which is the path the cron job (Step 4 below) points at. Runs `docker compose exec -T db pg_dump -U <user> <db>` and writes a gzipped, timestamped file to `/opt/opplify/backups/`, then deletes any file older than 7 days in that directory.
- **Server-only, not committed:** `.env.production` (same shape as `.env.local` today, with `DATABASE_URL` pointing at `postgresql://opplify:<password>@db:5432/opplify` — using the Compose service name `db` as the host, not `localhost`).

## Data flow / setup sequence

1. One-time server setup: SSH in, install Docker + Docker Compose plugin, `git clone` the repo to `/opt/opplify`, write `.env.production` by hand with real secrets (same values as today's `.env.local`/Vercel env vars, except `DATABASE_URL` uses the in-network `db` hostname).
2. `docker compose up -d db` (start only Postgres first) → apply `database/schema.sql` to it via `docker compose exec -T db psql -U opplify -d opplify -f -  < database/schema.sql` (or copy the file in and run it inside the container).
3. `docker compose up -d --build` (start `app` and `nginx` too).
4. Add the backup script to `crontab` (daily, e.g. `0 3 * * *`).
5. Run the verification checklist (below).
6. Once verified, decommission the Vercel project and the Neon database from their dashboards.

## Error handling / rollback

- If a deploy breaks the app: `git checkout <previous-commit> && docker compose up -d --build` rebuilds from the last-known-good commit. Postgres data is untouched by this — it lives in a named Docker volume (`pgdata`), independent of the `app` container's lifecycle.
- If the backup script fails (e.g., disk full): it's a plain shell script with no silent failure handling beyond what `pg_dump`/`cron` already provide — cron emails failures to the local mail spool by default. Not building alerting beyond that (out of scope).
- `nginx` is configured to just proxy — no custom error pages or retry logic; if `app` is down, nginx returns a standard 502, which is acceptable for this stage (no domain/branding to protect yet).

## Verification checklist (before decommissioning Vercel/Neon)

1. `docker compose build` completes with no errors.
2. `curl http://<vps-ip>/` returns 200.
3. `POST http://<vps-ip>/api/auth/register` and `POST .../api/auth/login` work against the VPS's own Postgres (same smoke test pattern used for the Neon migration earlier today).
4. One full `market_research` or `agency_leads` search completes end-to-end through the live site.
5. `scripts/backup-db.sh` has run at least once (manually trigger it) and produced a valid, non-empty gzipped dump file in `/opt/opplify/backups/`.

Only after all 5 pass: delete the Vercel project (Settings → Delete Project) and the Neon database (Storage tab → the database → Delete) from their respective dashboards.

## Testing

This is infrastructure work, not application logic — no new unit tests apply. "Testing" here means the verification checklist above, run manually against the live VPS.
