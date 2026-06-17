# VPS Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Opplify.ai off Vercel + Vercel Postgres (Neon) onto a self-hosted VPS, running the Next.js app, Postgres, and an nginx reverse proxy as Docker Compose services, with daily backups — then decommission Vercel and Neon.

**Architecture:** One `docker-compose.yml` with three services (`app`, `db`, `nginx`) on the Compose default network. `nginx` is the only service with a port published to the host (80 → container). The app reaches Postgres via the Compose service name `db`, not `localhost`. No domain/HTTPS yet — IP-only access over HTTP. Deploys are a manual `git pull && docker compose up -d --build` run over SSH.

**Tech Stack:** Docker + Docker Compose (v2 plugin), Postgres 16 (official image), nginx (official image), Ubuntu 24.04 LTS.

**Spec:** `docs/superpowers/specs/2026-06-17-vps-migration-design.md`

**VPS access:** `ssh -i ~/.ssh/opplify_vps root@78.40.111.107` (key-based auth already set up — no password needed). Server is freshly reinstalled with Ubuntu 24.04.3 LTS, nothing on it yet.

---

## Task 1: Dockerfile and .dockerignore

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create `.dockerignore`**

```
node_modules
.next
.git
.env*
npm-debug.log
docs
.superpowers
.agents
.claude
```

- [ ] **Step 2: Create `Dockerfile`**

```dockerfile
# Stage 1: install deps and build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
EXPOSE 3000
CMD ["npm", "run", "start"]
```

- [ ] **Step 3: Verify the image builds locally**

Run: `docker build -t opplify-test .`

If Docker isn't installed on the local Windows machine, skip this step — it will be verified for real once built on the VPS in Task 6. Note in your report whether you verified locally or are deferring to Task 6.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat: add Dockerfile for containerized deploy"
```

---

## Task 2: Docker Compose stack and nginx config

**Files:**
- Create: `docker-compose.yml`
- Create: `nginx.conf`

- [ ] **Step 1: Create `nginx.conf`**

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

- [ ] **Step 2: Create `docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:16
    restart: unless-stopped
    env_file:
      - .env.production
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    build: .
    restart: unless-stopped
    env_file:
      - .env.production
    depends_on:
      - db

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - app

volumes:
  pgdata:
```

Note: `db` and `app` both load `.env.production`. The Postgres image reads `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` from its environment to initialize itself on first run — those three vars go in `.env.production` (added in Task 4) alongside the app's own vars (`DATABASE_URL`, `JWT_SECRET`, etc.). `DATABASE_URL`'s host/user/password/db must match those three vars exactly, or the app won't be able to connect to `db`.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml nginx.conf
git commit -m "feat: add docker-compose stack (app, db, nginx)"
```

---

## Task 3: Deploy and backup scripts

**Files:**
- Create: `deploy.sh`
- Create: `scripts/backup-db.sh`

- [ ] **Step 1: Create `deploy.sh`**

```bash
#!/bin/bash
set -e
cd /opt/opplify
git pull origin master
docker compose up -d --build
```

- [ ] **Step 2: Create `scripts/backup-db.sh`**

```bash
#!/bin/bash
set -e
BACKUP_DIR=/opt/opplify/backups
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
cd /opt/opplify
docker compose exec -T db pg_dump -U opplify opplify | gzip > "$BACKUP_DIR/opplify-$TIMESTAMP.sql.gz"
find "$BACKUP_DIR" -name "opplify-*.sql.gz" -mtime +7 -delete
echo "Backup written: $BACKUP_DIR/opplify-$TIMESTAMP.sql.gz"
```

This assumes the Postgres user/db are both named `opplify` — that's what Task 4 sets up. If you change those names in `.env.production`, update this script to match.

- [ ] **Step 3: Make both scripts executable and commit**

```bash
chmod +x deploy.sh scripts/backup-db.sh
git add deploy.sh scripts/backup-db.sh
git commit -m "feat: add deploy and backup scripts"
```

- [ ] **Step 4: Push everything so far to master**

```bash
git push origin HEAD:master
```
Expected: fast-forward push succeeds (same pattern as the earlier Postgres migration — confirm with `git log feat/local-postgres-auth..master --oneline` showing 0 commits, i.e. master has caught up, before pushing, if you're unsure).

---

## Task 4: Server setup — Docker, repo clone, secrets

**Files:** none in the repo — this task runs commands on the VPS over SSH.

- [ ] **Step 1: Install Docker Engine + Compose plugin**

```bash
ssh -i ~/.ssh/opplify_vps root@78.40.111.107 "curl -fsSL https://get.docker.com | sh"
```
Expected: ends with Docker installed successfully, no errors. This script also installs the `docker compose` plugin (v2).

- [ ] **Step 2: Verify Docker and Compose**

```bash
ssh -i ~/.ssh/opplify_vps root@78.40.111.107 "docker --version && docker compose version"
```
Expected: both print version numbers (e.g. `Docker version 27.x`, `Docker Compose version v2.x`).

- [ ] **Step 3: Clone the repo**

```bash
ssh -i ~/.ssh/opplify_vps root@78.40.111.107 "mkdir -p /opt && git clone https://github.com/ovangoni-cyber/opplify.git /opt/opplify"
```
Expected: clone succeeds. (This is a public clone URL over HTTPS — no credentials needed for a public repo. If the repo is private, you'll need to set up a deploy key or personal access token; ask the user if the clone fails with a permission error.)

- [ ] **Step 4: Generate a fresh Postgres password and JWT secret on the server**

```bash
ssh -i ~/.ssh/opplify_vps root@78.40.111.107 "openssl rand -hex 24"
```
Run it twice (once for the DB password, once for `JWT_SECRET`) — note down both outputs, you'll use them in Step 5.

- [ ] **Step 5: Create `.env.production` on the server**

This file is never committed to git. Create it directly on the server via SSH heredoc, using the two values from Step 4 (`<DB_PASSWORD>` and `<JWT_SECRET>` below) and the same third-party API keys already in the project's local `.env.local` (`GOOGLE_PLACES_API_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`) — copy those values over as-is, they're the same Stripe/Google/Anthropic accounts:

```bash
ssh -i ~/.ssh/opplify_vps root@78.40.111.107 "cat > /opt/opplify/.env.production << 'EOF'
DATABASE_URL=postgresql://opplify:<DB_PASSWORD>@db:5432/opplify
JWT_SECRET=<JWT_SECRET>
GOOGLE_PLACES_API_KEY=<copy from .env.local>
ANTHROPIC_API_KEY=<copy from .env.local>
STRIPE_SECRET_KEY=<copy from .env.local>
STRIPE_WEBHOOK_SECRET=<copy from .env.local>
STRIPE_PRICE_STARTER=<copy from .env.local>
STRIPE_PRICE_PRO=<copy from .env.local>
NEXT_PUBLIC_SITE_URL=http://78.40.111.107
TEST_USER_ID=
POSTGRES_USER=opplify
POSTGRES_PASSWORD=<DB_PASSWORD>
POSTGRES_DB=opplify
EOF"
```

Replace every `<...>` placeholder with the real value before running — this is a literal file write, not a template the server fills in.

- [ ] **Step 6: Verify the file landed correctly (without printing secrets to your terminal history any more than necessary)**

```bash
ssh -i ~/.ssh/opplify_vps root@78.40.111.107 "wc -l /opt/opplify/.env.production"
```
Expected: `13 /opt/opplify/.env.production` (13 lines, matching the 13 vars above — adjust if `TEST_USER_ID=` empty line still counts, which it does).

---

## Task 5: Start Postgres and load the schema

**Files:** none — server-side commands.

- [ ] **Step 1: Start only the `db` service**

```bash
ssh -i ~/.ssh/opplify_vps root@78.40.111.107 "cd /opt/opplify && docker compose up -d db"
```
Expected: `db` container created and running. Confirm with:
```bash
ssh -i ~/.ssh/opplify_vps root@78.40.111.107 "docker compose -f /opt/opplify/docker-compose.yml ps"
```
Expected: `db` shows state `running` (or `Up`).

- [ ] **Step 2: Wait for Postgres to be ready, then load the schema**

```bash
ssh -i ~/.ssh/opplify_vps root@78.40.111.107 "cd /opt/opplify && sleep 5 && cat database/schema.sql | docker compose exec -T db psql -U opplify -d opplify"
```
Expected: a sequence of `CREATE EXTENSION`, `CREATE TABLE`, `CREATE INDEX` lines, no errors.

- [ ] **Step 3: Verify tables exist**

```bash
ssh -i ~/.ssh/opplify_vps root@78.40.111.107 "cd /opt/opplify && docker compose exec -T db psql -U opplify -d opplify -c '\dt'"
```
Expected: lists `analyses`, `search_history`, `user_branding`, `user_credits`, `users`.

---

## Task 6: Start the full stack and verify the app responds

**Files:** none — server-side commands.

- [ ] **Step 1: Build and start `app` and `nginx`**

```bash
ssh -i ~/.ssh/opplify_vps root@78.40.111.107 "cd /opt/opplify && docker compose up -d --build"
```
Expected: the `app` image builds (this takes a minute or two — it's running `npm run build` inside the container), then all three containers (`db`, `app`, `nginx`) report running.

- [ ] **Step 2: Check container health**

```bash
ssh -i ~/.ssh/opplify_vps root@78.40.111.107 "docker compose -f /opt/opplify/docker-compose.yml ps"
```
Expected: all three services show `Up`/`running`. If `app` is restarting in a loop, check its logs:
```bash
ssh -i ~/.ssh/opplify_vps root@78.40.111.107 "docker compose -f /opt/opplify/docker-compose.yml logs app --tail 50"
```

- [ ] **Step 3: Hit the site from your local machine**

```bash
curl -s -o /dev/null -w "status: %{http_code}\n" http://78.40.111.107
```
Expected: `status: 200`.

---

## Task 7: Verify auth against the VPS's own Postgres

**Files:** none — this is a smoke test, same pattern used for the earlier Neon migration.

- [ ] **Step 1: Register a test user**

```bash
curl -s -X POST http://78.40.111.107/api/auth/register -H "Content-Type: application/json" -d '{"email":"vps-check@example.com","password":"checkpass123"}'
```
Expected: `{"ok":true}`.

- [ ] **Step 2: Log in as that user**

```bash
curl -s -X POST http://78.40.111.107/api/auth/login -H "Content-Type: application/json" -d '{"email":"vps-check@example.com","password":"checkpass123"}'
```
Expected: a JSON object with a `token` field (a JWT string).

- [ ] **Step 3: Clean up the test user**

```bash
ssh -i ~/.ssh/opplify_vps root@78.40.111.107 "cd /opt/opplify && docker compose exec -T db psql -U opplify -d opplify -c \"DELETE FROM users WHERE email='vps-check@example.com';\""
```
Expected: `DELETE 1`.

---

## Task 8: Run one full search end-to-end through the live VPS site

**Files:** none — manual verification, no automation (this exercises the Google Places + Claude pipeline, which costs real API usage — do it once, deliberately).

- [ ] **Step 1: Register a real account and give it a credit (or use the 1 free credit from registration)**

Already covered by registering normally — every new account gets 1 credit (see `src/app/api/auth/register/route.ts`).

- [ ] **Step 2: Run a search from the browser**

Open `http://78.40.111.107` in a browser, log in, run a `market_research` or `agency_leads` search for any city, and let it complete.

Expected: the streaming analysis completes and shows results, the same as it does locally or on Vercel today. If it errors, check `app` logs (`docker compose logs app --tail 100`) — likely causes are a missing/wrong `GOOGLE_PLACES_API_KEY` or `ANTHROPIC_API_KEY` in `.env.production` (Task 4, Step 5).

---

## Task 9: Daily backup cron

**Files:** none — server-side cron setup.

- [ ] **Step 1: Run the backup script manually once to verify it works**

```bash
ssh -i ~/.ssh/opplify_vps root@78.40.111.107 "/opt/opplify/scripts/backup-db.sh"
```
Expected: prints `Backup written: /opt/opplify/backups/opplify-<timestamp>.sql.gz`.

- [ ] **Step 2: Verify the file exists and is non-empty**

```bash
ssh -i ~/.ssh/opplify_vps root@78.40.111.107 "ls -la /opt/opplify/backups/"
```
Expected: one `.sql.gz` file with a non-zero size (a few KB at minimum, given the data in the DB at this point).

- [ ] **Step 3: Add the daily cron job**

```bash
ssh -i ~/.ssh/opplify_vps root@78.40.111.107 "(crontab -l 2>/dev/null; echo '0 3 * * * /opt/opplify/scripts/backup-db.sh >> /opt/opplify/backups/cron.log 2>&1') | crontab -"
```

- [ ] **Step 4: Verify it's registered**

```bash
ssh -i ~/.ssh/opplify_vps root@78.40.111.107 "crontab -l"
```
Expected: shows the line added in Step 3, running daily at 03:00 server time.

---

## Task 10: Decommission Vercel and Neon

**Only do this after Tasks 6, 7, 8, and 9 have all passed.** This is destructive and not easily reversible — confirm with the user before executing, even though the spec already calls for it.

- [ ] **Step 1: Confirm with the user**

Ask explicitly: "All VPS checks passed — confirm I should now delete the Vercel project and the Neon database?" Do not proceed without an explicit yes.

- [ ] **Step 2: Delete the Vercel project**

Guide the user (this is a dashboard action, not something done over SSH/API in this plan):
1. vercel.com → the `opplify` project → Settings → scroll to "Delete Project" → confirm.

- [ ] **Step 3: Delete the Neon database**

1. vercel.com → Storage tab → the Postgres/Neon database created earlier today → Delete → confirm.

- [ ] **Step 4: Update local notes**

Update `CLAUDE.md`'s Deployment section to reflect the new VPS-based deployment (IP, SSH access, Docker Compose, no more Vercel/Neon). This is a documentation step, not code — write it as its own commit:
```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for VPS deployment"
```
