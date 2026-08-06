# MinIO setup

CMMS stores user-uploaded attachments (photos, files) in the MinIO bucket
`max-attachments`. Backups of both the database and the attachments bucket are
covered below.

> **Where the data physically lives**: the production MinIO runs as the Docker
> container `minio` (see `docker-compose.yml` in the monorepo root) with the
> named volume `minio_data` mounted at `/data` (host path
> `/var/lib/docker/volumes/emerald_minio_data/_data`).
> `~/emerald/services/minio/minio_data/` and
> `~/emerald/services/minio/max-attachments/` are a **legacy local install and
> are NOT used by the Docker MinIO** — do not back up or restore against them.
> The tracked policy files live in `~/emerald/services/minio/policies/`.

## Buckets

| Bucket | Purpose |
| --- | --- |
| `max-attachments` | App uploads (photos, files). Lives in the `minio_data` volume. |
| `max-backups` | Off-site(ish) copies: DB dumps (`cmms-*.dump`) and `attachments/` mirror. |

## Users & policies

Application/backup credential: `max_user`. It is a non-admin access key with two
policies attached:

```
mc admin user add localminio max_user <password>
mc admin policy attach localminio max-policy            --user max_user
mc admin policy attach localminio max-backups-policy    --user max_user
```

Policy source of truth (tracked in the monorepo):

- `~/emerald/services/minio/policies/max-policy.json` — read/write on
  `max-attachments`. Used by the app (uploads) and by `backup-attachments.sh`
  (reads the source bucket).
- `~/emerald/services/minio/policies/max-backups-policy.json` — read/write on
  `max-backups`. Used by `backup.sh` (uploads DB dumps) and by
  `backup-attachments.sh` (writes the `attachments/` mirror).

Recreate them from the JSON files with:

```
mc admin policy create localminio max-policy         policies/max-policy.json
mc admin policy create localminio max-backups-policy policies/max-backups-policy.json
mc admin policy attach localminio max-policy         --user max_user
mc admin policy attach localminio max-backups-policy --user max_user
```

## Backups

| What | Script | Schedule (crontab) |
| --- | --- | --- |
| PostgreSQL database | `scripts/backup.sh` | daily 02:30 |
| Attachments bucket | `scripts/backup-attachments.sh` | daily 03:00 |

`backup-attachments.sh` mirrors `max-attachments` to `backups/attachments/`
locally (an independent copy on the app host), then mirrors that up to
`max-backups/attachments/`. `mc mirror` is incremental, and deleted objects are
kept locally (no `--remove`), giving a short deletion-retention window.

## Restores

- Database: `./scripts/restore.sh /path/to/cmms-<ts>.dump --yes`
- Attachments:
  `ATTACHMENTS_RESTORE_TARGET=max-attachments ./scripts/restore-attachments.sh --yes`

### Test-restore drill

Run the drill after any change to the backup pipeline (and periodically) so a
real restore is not the first time the flow is exercised:

```bash
# 1. Create a scratch bucket for the target.
#    NOTE: max_user's policies only cover max-attachments/max-backups, so a
#    scratch bucket must be created and written with the MinIO root/admin
#    credentials (MINIO_ROOT_USER / MINIO_ROOT_PASSWORD). The restore script
#    reads MAX_MINIO_ACCESS_KEY / MAX_MINIO_SECRET_KEY from .env — export the
#    root creds over them for the drill only.
mc mb localminio/max-attachments-restore-test

# 2. Mirror the attachment backup into the scratch bucket (root creds).
MAX_MINIO_ACCESS_KEY="$MINIO_ROOT_USER" \
MAX_MINIO_SECRET_KEY="$MINIO_ROOT_PASSWORD" \
ATTACHMENTS_RESTORE_TARGET=max-attachments-restore-test \
  ./scripts/restore-attachments.sh --yes

# 3. Compare object counts with the live bucket (should be equal).
mc ls --recursive localminio/max-attachments | wc -l
mc ls --recursive localminio/max-attachments-restore-test | wc -l

# 4. Clean up.
mc rm --recursive --force localminio/max-attachments-restore-test
mc rb --force localminio/max-attachments-restore-test
```

The script verifies the restore itself (source vs target object counts) and
fails loudly instead of printing `RESTORE_OK` when `mc mirror` silently hit an
Access Denied.

For a full disaster recovery (new host): restore the DB dump, then run the
attachments restore, then point the app at the restored data. The DB stores
object keys only — the files themselves are restored from `max-backups`.
