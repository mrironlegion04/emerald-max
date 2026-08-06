# Cron runner for the max app (PM work-order generation + notification digest).
# The job schedule lives in cron-loop.py; env (APP_URL, CRON_SECRET, etc.) is
# provided at runtime by docker-compose — never baked into the image.
FROM python:3.12-slim

RUN useradd --create-home --uid 10001 cronuser
WORKDIR /cron

COPY scripts/cron-loop.py /cron/cron-loop.py

USER cronuser
CMD ["python3", "/cron/cron-loop.py"]
