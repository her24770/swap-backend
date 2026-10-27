ARG SOURCE_DATE_EPOCH=0

FROM rclone/rclone:1.74.1@sha256:eb8788b795f0009324e9572b0e2acb9b56885327c2746b07d67a9d3b893a6602 AS rclone

# Conserva PostgreSQL 16 y pgvector de la imagen usada actualmente por Compose.
FROM pgvector/pgvector:pg16@sha256:7b822b0aac60967beb1ea5e576b8602c94c300a157d187f385ae3e0da199b90a

ARG SOURCE_DATE_EPOCH

# pgBackRest y cron ejecutan el calendario de respaldos físicos dentro del contenedor.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates=20250419~deb12u2 \
        cron=3.0pl1-162 \
        jq=1.6-2.1+deb12u3 \
        libssh2-1=1.10.0-3+deb12u1 \
        pgbackrest=2.59.3-1.pgdg12+1 \
    && install -d -o postgres -g postgres -m 750 /etc/pgbackrest \
    && rm -rf \
        /var/cache/ldconfig/aux-cache \
        /var/lib/apt/lists/* \
        /var/log/apt/* \
        /var/log/dpkg.log

COPY --from=rclone /usr/local/bin/rclone /usr/local/bin/rclone
COPY --chown=postgres:postgres --chmod=640 pgbackrest.conf /etc/pgbackrest/pgbackrest.conf
COPY --chmod=644 pgbackrest.cron /etc/cron.d/pgbackrest
COPY --chmod=755 scheduled-backups-entrypoint /usr/local/bin/scheduled-backups-entrypoint
COPY --chmod=755 publish-pgbackrest-report /usr/local/bin/publish-pgbackrest-report
COPY --chmod=755 run-pgbackrest-backup /usr/local/bin/run-pgbackrest-backup
COPY --chmod=755 run-pgbackrest-restore /usr/local/bin/run-pgbackrest-restore

# Sanitiza saltos de línea Windows (CRLF) a Linux (LF) en los scripts copiados
RUN sed -i 's/\r$//' \
    /usr/local/bin/scheduled-backups-entrypoint \
    /usr/local/bin/publish-pgbackrest-report \
    /usr/local/bin/run-pgbackrest-backup \
    /usr/local/bin/run-pgbackrest-restore \
    /etc/cron.d/pgbackrest \
    /etc/pgbackrest/pgbackrest.conf

ENTRYPOINT ["scheduled-backups-entrypoint"]

