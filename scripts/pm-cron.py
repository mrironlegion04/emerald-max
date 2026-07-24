#!/usr/bin/env python3
"""
PM Work Order Generator — calls the cron endpoint to auto-generate due WOs.

Usage:
  python3 scripts/pm-cron.py                    # run once
  python3 scripts/pm-cron.py --loop 30          # run every 30 minutes
  crontab -e                                    # */30 * * * * cd /path/to/max && python3 scripts/pm-cron.py >> /var/log/pm-cron.log 2>&1

Environment:
  APP_URL      — base URL of the Next.js app (default: http://localhost:3000)
  CRON_SECRET  — Bearer token for authentication (must match .env CRON_SECRET)
"""

import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime


APP_URL = os.environ.get("APP_URL", "http://localhost:3000")
CRON_SECRET = os.environ.get("CRON_SECRET", "")


def generate():
    """Call the PM cron endpoint and return success/failure."""
    url = f"{APP_URL}/api/cron/pm-generate"
    req = urllib.request.Request(url, method="POST")
    if CRON_SECRET:
        req.add_header("Authorization", f"Bearer {CRON_SECRET}")

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = resp.read().decode()
            print(f"[{datetime.now().isoformat()}] OK {resp.status}: {body}")
            return resp.status == 200
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        print(f"[{datetime.now().isoformat()}] ERROR {e.code}: {body}")
        return False
    except Exception as e:
        print(f"[{datetime.now().isoformat()}] ERROR: {e}")
        return False


def main():
    # Parse --loop <minutes> flag
    loop_minutes = 0
    if len(sys.argv) >= 3 and sys.argv[1] == "--loop":
        try:
            loop_minutes = int(sys.argv[2])
        except ValueError:
            print("Usage: python3 pm-cron.py --loop <minutes>")
            sys.exit(1)

    if loop_minutes > 0:
        print(f"Running PM cron every {loop_minutes} minutes. Press Ctrl+C to stop.")
        while True:
            generate()
            time.sleep(loop_minutes * 60)
    else:
        success = generate()
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
