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
- **Self-hosted**: a systemd timer or host crontab entry pointing at the curl above.
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

## Database connection pooling

The app runs on Node with Prisma's default connection pool (auto-sized by CPU count).

- **Self-hosted / VPS**: default pooling is fine. If you hit connection limits, reduce the pool
  size by adding `connection_limit=N` to `DATABASE_URL` (e.g. `...?connection_limit=5`).
- **Serverless (Vercel) / Neon**: use the **pooled** endpoint (`-pooler` host) and set
  `connection_limit=1` in the connection string to stay within serverless connection budgets.
