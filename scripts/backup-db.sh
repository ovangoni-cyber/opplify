#!/bin/bash
set -e
set -o pipefail
BACKUP_DIR=/opt/opplify/backups
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
cd /opt/opplify
docker compose exec -T db pg_dump -U opplify opplify | gzip > "$BACKUP_DIR/opplify-$TIMESTAMP.sql.gz"
find "$BACKUP_DIR" -name "opplify-*.sql.gz" -mtime +7 -delete
echo "Backup written: $BACKUP_DIR/opplify-$TIMESTAMP.sql.gz"
