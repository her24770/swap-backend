# Imagen mínima con los clientes oficiales pg_dump/pg_restore de PostgreSQL 16.
FROM postgres:16-alpine@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea

# rclone implementa las operaciones S3 compatibles con Cloudflare R2.
RUN apk add --no-cache rclone=1.74.1-r2

COPY postgres-backup /usr/local/bin/postgres-backup
COPY entrypoint /usr/local/bin/backup-entrypoint

RUN chmod +x /usr/local/bin/postgres-backup /usr/local/bin/backup-entrypoint

ENTRYPOINT ["backup-entrypoint"]
