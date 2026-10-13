ARG SOURCE_DATE_EPOCH=0

# Conserva PostgreSQL 16 y pgvector de la imagen usada actualmente por Compose.
FROM pgvector/pgvector:pg16@sha256:7b822b0aac60967beb1ea5e576b8602c94c300a157d187f385ae3e0da199b90a

ARG SOURCE_DATE_EPOCH

# pgBackRest realizará los respaldos físicos e incrementales en pasos posteriores.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates=20250419~deb12u1 \
        libssh2-1=1.10.0-3+deb12u1 \
        pgbackrest=2.59.3-1.pgdg12+1 \
    && install -d -o postgres -g postgres -m 750 /etc/pgbackrest \
    && rm -rf \
        /var/cache/ldconfig/aux-cache \
        /var/lib/apt/lists/* \
        /var/log/apt/* \
        /var/log/dpkg.log

COPY --chown=postgres:postgres --chmod=640 pgbackrest.conf /etc/pgbackrest/pgbackrest.conf
