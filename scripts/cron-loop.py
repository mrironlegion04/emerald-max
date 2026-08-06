#!/usr/bin/env python3
"""
Container cron loop — runs the app's scheduled jobs on a fixed cadence.

Jobs:
  * PM work-order generation   every PM_INTERVAL_MINUTES (default 30)
  * Overdue-notification digest once per day at DIGEST_HOUR (default 6)

This is meant to run inside a python:3.12-slim container (see the `cron`
service in docker-compose.yml), but works on a host too:

  APP_URL=http://localhost:3000 CRON_SECRET=... python3 scripts/cron-loop.py

Environment:
  APP_URL              — base URL of the Next.js app (default: http://localhost:3000)
  CRON_SECRET          — Bearer token for authentication (must match .env CRON_SECRET)
  PM_INTERVAL_MINUTES  — PM generation interval (default: 30)
  DIGEST_HOUR          — local hour (0-23) to run the digest (default: 6)
  TZ                   — timezone for DIGEST_HOUR (default: container/UTC)
"""

import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta

APP_URL = os.environ.get("APP_URL", "http://localhost:3000")
CRON_SECRET = os.environ.get("CRON_SECRET", "")
PM_INTERVAL = int(os.environ.get("PM_INTERVAL_MINUTES", "30"))
DIGEST_HOUR = int(os.environ.get("DIGEST_HOUR", "6"))
SLEEP_SECONDS = int(os.environ.get("SLEEP_SECONDS", "30"))


def post(path, label):
    """POST an authenticated cron endpoint and log the outcome."""
    url = f"{APP_URL}{path}"
    req = urllib.request.Request(url, method="POST")
    if CRON_SECRET:
        req.add_header("Authorization", f"Bearer {CRON_SECRET}")

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = resp.read().decode()
            print(f"[{datetime.now().isoformat()}] OK {label} ({resp.status}): {body}", flush=True)
            return resp.status == 200
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        print(f"[{datetime.now().isoformat()}] ERROR {label} ({e.code}): {body}", flush=True)
        return False
    except Exception as e:
        print(f"[{datetime.now().isoformat()}] ERROR {label}: {e}", flush=True)
        return False


def seconds_until(hour):
    """Seconds until the next occurrence of `hour` (local time, next day if passed)."""
    now = datetime.now()
    nxt = now.replace(hour=hour, minute=0, second=0, microsecond=0)
    if nxt <= now:
        nxt = (now + timedelta(days=1)).replace(hour=hour, minute=0, second=0, microsecond=0)
    return (nxt - now).total_seconds()


def main():
    print(
        f"[{datetime.now().isoformat()}] cron-loop started: PM every {PM_INTERVAL} min, "
        f"digest daily at {DIGEST_HOUR:02d}:00 ({os.environ.get('TZ', 'UTC')}), app: {APP_URL}",
        flush=True,
    )

    last_pm = 0.0
    next_digest = time.time() + seconds_until(DIGEST_HOUR)

    while True:
        now = time.time()

        if now - last_pm >= PM_INTERVAL * 60:
            post("/api/cron/pm-generate", "PM generation")
            last_pm = now

        if now >= next_digest:
            post("/api/notifications/digest", "digest")
            next_digest = time.time() + seconds_until(DIGEST_HOUR)

        time.sleep(SLEEP_SECONDS)


if __name__ == "__main__":
    main()
