#!/usr/bin/env bash
# Kunlik PostgreSQL backup — Docker konteyner ichidan dump oladi va
# konteynerdan TASHQARI, alohida joyga saqlaydi (server konteyner bilan
# birga o'chsa ham backup qolishi uchun).
#
# Cron (server, root yoki deploy user):
#   0 3 * * * /opt/afsona-dub/deploy/backup/pg_backup.sh >> /var/log/afsona-dub-backup.log 2>&1
#
# Talab: /opt/afsona-dub ichida .env va docker-compose.yml bo'lishi kerak.

set -euo pipefail

PROJECT_DIR="/opt/afsona-dub"
BACKUP_DIR="/var/backups/afsona-dub"        # server diskida, konteynerdan tashqarida
RETENTION_DAYS=14

cd "$PROJECT_DIR"
set -a
source .env
set +a

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="$BACKUP_DIR/afsona_dub_${TIMESTAMP}.sql.gz"

docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "$DUMP_FILE"

echo "[$(date)] Backup yaratildi: $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"

# Eski backuplarni tozalash
find "$BACKUP_DIR" -name "afsona_dub_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete

# TAVSIYA: $BACKUP_DIR ni serverdan tashqariga ham sinxronlang, masalan:
#   rclone sync /var/backups/afsona-dub remote:afsona-dub-backups
# yoki Hetzner Storage Box / S3 orqali. Faqat serverning o'zida saqlash
# (server o'lsa backup ham yo'qoladi) yetarli emas.
