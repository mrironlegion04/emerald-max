# CMMS Application

A CMMS (Computerized Maintenance Management System) built with Next.js (App Router) + Prisma + PostgreSQL.

## Getting Started

```bash
npm install
npm run db:generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment

Copy `.env.sample` to `.env` and configure:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `CRON_SECRET` | Bearer token protecting the PM-generation cron endpoint (>= 16 chars) |
| `NEXT_PUBLIC_*` | Public client-side configuration |

### Database migrations

Schema changes are managed with Prisma migrations:

```bash
npx prisma migrate dev        # create + apply a migration in development
npx prisma migrate deploy     # apply pending migrations (prod)
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script
```

`migrate diff` (with a shadow database) is the recommended way to preview the SQL a schema change will produce.

## Scheduled jobs

### PM generation (preventive maintenance work orders)

The `POST /api/cron/pm-generate` endpoint scans active maintenance schedules (time-based,
meter-based, and time-or-meter) and generates due work orders. It is locked behind a bearer
token:

```bash
curl -X POST https://<host>/api/cron/pm-generate \
  -H "Authorization: Bearer $CRON_SECRET"
```

Schedule it to run at least daily. Examples:

- **Vercel**: add a cron entry in `vercel.json` (e.g. every hour).
- **Self-hosted (crontab)** — PM generation every 30 min, notification digest daily, DB backup daily:

  ```bash
  crontab -e
  ```

  ```cron
  APP_URL=http://localhost:3000
  CRON_SECRET=<from .env>

  # PM work order generation (every 30 minutes)
  */30 * * * * cd /path/to/max && APP_URL=$APP_URL CRON_SECRET=$CRON_SECRET python3 scripts/pm-cron.py >> /var/log/cmms-pm-cron.log 2>&1

  # Notification digest (daily at 06:00)
  0 6 * * * curl -fsS -X POST $APP_URL/api/notifications/digest -H "Authorization: Bearer $CRON_SECRET" >> /var/log/cmms-digest.log 2>&1

  # Database backup (daily at 02:30) — see the backups section
  30 2 * * * /path/to/max/scripts/backup.sh >> /var/log/cmms-backup.log 2>&1

  # Attachments bucket backup (daily at 03:00) — see the backups section
  0 3 * * * /path/to/max/scripts/backup-attachments.sh >> /var/log/cmms-backup-attachments.log 2>&1
  ```

- **Self-hosted (systemd timer)** — equivalent with a `.service` (runs `pm-cron.py --loop 30`)
  plus a `.timer` (`OnCalendar=*-*-* *:00/30:00`). Keep the Python loop and the log
  collection separate for readability.
- **Docker**: pass `CRON_SECRET` and configure an external scheduler.

### Meter readings

Meter readings are processed inline: recording a reading (`POST /api/assets/[id]/meters/[meterId]/readings`)
triggers meter-event processing (threshold alerts and meter-triggered PMs) synchronously, so no
separate cron is required for meter events.

## Health check

`GET /api/health` is an unauthenticated endpoint that verifies DB connectivity and returns 200/503.

```bash
curl http://localhost:3000/api/health
```

It is used by the Docker `HEALTHCHECK` directive.

## Deployment (Docker)

```bash
docker build -t cmms .
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e CRON_SECRET=... \
  cmms
```

Before first start in a new environment, run `npx prisma migrate deploy` against the database.

## Security

### Rotating the admin password

The admin account created by the development seed uses well-known credentials
(`admin@cmms.com` / `admin123`). In this environment that password has already been
rotated. To rotate it again (or on any other install):

```bash
npm run rotate-admin-password                    # generates a strong random password
ADMIN_PASSWORD='<new-password>' npm run rotate-admin-password
npm run rotate-admin-password -- '<new-password>'
```

The script updates the password hash, sets `mustChangePassword=true` (forcing a change on
next login), and bumps `sessionVersion` to invalidate all existing sessions. The generated
password is printed to stdout once — record it securely.

### Production seeding

`npm run db:seed` (`prisma/seed.ts`) refuses to run in production because it creates
accounts with well-known development passwords. Use `npm run seed:prod` (`prisma/seed2.ts`)
instead; it requires `SEED_ADMIN_PASSWORD` (>= 12 chars) and never resets the password of an
existing admin (upserts use `update: {}`).

### Credential hygiene

- `.env` is gitignored and must never be committed. Copy `.env.sample` and fill in real values.
- Documentation uses `CHANGE_ME` placeholders — do not copy them literally into a real setup.
- Rotate secrets periodically: `SESSION_SECRET`, `CRON_SECRET`, the DB password, and the
  MinIO access keys. `SESSION_SECRET` rotation logs everyone out, which is expected.

## Observability

The app logs structured JSON lines (no external dependencies) via `lib/logger.ts`:

```json
{"ts":"2026-08-06T10:30:00.000Z","level":"info","message":"http_request","method":"GET","path":"/work-orders","status":200,"durationMs":42}
```

Every request matched by `proxy.ts` produces one `http_request` line with method,
path, status, and duration. Collect these from stdout/stderr (journald, a log agent, or a
file). All log lines include `ts`, `level`, and `message`; `error`-level lines go to stderr.

## Backups & disaster recovery

Automated PostgreSQL backup + attachments backup, each with an off-site copy to
MinIO/S3, plus restore scripts. The DB dump and the attachments mirror are
complementary: the database stores object keys, the files themselves live in
MinIO `max-attachments` — back up both.

### Database backup

```bash
./scripts/backup.sh
```

This dumps the database (custom-format), writes `backups/cmms-<timestamp>.dump`,
uploads it to MinIO bucket `max-backups`, and prunes local copies older than 14 days.

Configuration (env vars, `.env` is auto-loaded):

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | from `.env` | Source database |
| `BACKUP_DIR` | `./backups` | Local backup directory |
| `BACKUP_RETENTION_DAYS` | `14` | Local retention window |
| `MINIO_ENDPOINT` / `MAX_MINIO_ACCESS_KEY` / `MAX_MINIO_SECRET_KEY` | from `.env` | Upload target |
| `MINIO_BACKUP_BUCKET` | `max-backups` | Remote bucket |
| `DISABLE_MINIO_UPLOAD` | `0` | Set to `1` for local-only backups |
| `POSTGRES_CONTAINER` | `emerald-db` | Docker container running Postgres |

The script prefers to run `pg_dump` inside the Postgres container so the client version
matches the server (host `pg_dump` 16 cannot dump a Postgres 18 server).

### Attachments backup

```bash
./scripts/backup-attachments.sh
```

Mirrors the `max-attachments` bucket to `backups/attachments/` locally (an
independent copy on the app host), then mirrors that up to
`max-backups/attachments/`. `mc mirror` is incremental, and objects deleted
upstream are kept locally (no `--remove`), giving a short deletion-retention
window. Set `DISABLE_MINIO_UPLOAD=1` for a local-only mirror.

The MinIO credential needs read access to `max-attachments` and read/write access
to `max-backups`. The two policies are tracked in the monorepo and documented in
`Docs/Minio.md`:
`~/emerald/services/minio/policies/max-policy.json` and
`~/emerald/services/minio/policies/max-backups-policy.json`.

### Restoring

```bash
./scripts/restore.sh /path/to/backup.dump --yes          # database
./scripts/restore-attachments.sh --yes                   # attachments
```

`--yes` skips the interactive confirmation. The DB restore is destructive
(`pg_restore --clean`): it drops and recreates tables in the target database. By
default the target is `DATABASE_URL` — override with `RESTORE_DATABASE_URL` to
restore into a different database. The attachments restore uses `mc mirror
--overwrite` (objects uploaded after the backup are preserved). Run a
test-restore of the attachments into a scratch bucket first — see the drill in
`Docs/Minio.md`.

### Schedule

Run both backups daily (see the cron/observability section below for how the
host scheduler is wired up). Test restores periodically in a scratch database
and scratch MinIO bucket.

## Database connection pooling

The app runs on Node with Prisma's default connection pool (auto-sized by CPU count).

- **Self-hosted / VPS**: default pooling is fine. If you hit connection limits, reduce the pool
  size by adding `connection_limit=N` to `DATABASE_URL` (e.g. `...?connection_limit=5`).
- **Serverless (Vercel) / Neon**: use the **pooled** endpoint (`-pooler` host) and set
  `connection_limit=1` in the connection string to stay within serverless connection budgets.
