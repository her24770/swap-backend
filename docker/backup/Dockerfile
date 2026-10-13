# Imagen mínima con los clientes oficiales pg_dump/pg_restore de PostgreSQL 16.
ARG SOURCE_DATE_EPOCH=0

FROM rclone/rclone:1.74.1@sha256:eb8788b795f0009324e9572b0e2acb9b56885327c2746b07d67a9d3b893a6602 AS rclone

FROM postgres:16-alpine@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea

ARG SOURCE_DATE_EPOCH

# rclone implementa las operaciones S3 compatibles con Cloudflare R2.
COPY --from=rclone /usr/local/bin/rclone /usr/local/bin/rclone

COPY postgres-backup /usr/local/bin/postgres-backup
COPY entrypoint /usr/local/bin/backup-entrypoint

RUN chmod +x /usr/local/bin/postgres-backup /usr/local/bin/backup-entrypoint

ENTRYPOINT ["backup-entrypoint"]
