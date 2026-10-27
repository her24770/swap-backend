#!/bin/sh
set -eu

RAIZ=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$RAIZ"

IMAGEN=${1:-api}
PLATAFORMA=${PLATFORM:-linux/amd64}
EPOCH=${SOURCE_DATE_EPOCH:-$(git log -1 --format=%ct)}

if [ "${ALLOW_DIRTY:-0}" != "1" ] && [ -n "$(git status --porcelain)" ]; then
    echo "El repositorio debe estar limpio para verificar exactamente un commit." >&2
    exit 2
fi

case "$IMAGEN" in
    api)
        CONTEXTO=.
        DOCKERFILE=Dockerfile
        TARGET=production
        ;;
    embeddings)
        CONTEXTO=embeddings
        DOCKERFILE=embeddings/Dockerfile
        TARGET=
        ;;
    postgres)
        CONTEXTO=docker/postgres
        DOCKERFILE=docker/postgres/Dockerfile
        TARGET=
        ;;
    *)
        echo "Uso: $0 {api|embeddings|postgres}" >&2
        exit 2
        ;;
esac

TEMPORAL=$(mktemp -d)
trap 'rm -rf -- "$TEMPORAL"' EXIT HUP INT TERM

construir() {
    DESTINO=$1
    if [ -n "$TARGET" ]; then
        set -- --target "$TARGET"
    else
        set --
    fi

    docker buildx build \
        --no-cache \
        --pull=false \
        --platform "$PLATAFORMA" \
        --file "$DOCKERFILE" \
        "$@" \
        --build-arg "SOURCE_DATE_EPOCH=$EPOCH" \
        --provenance=false \
        --sbom=false \
        --output "type=oci,dest=$DESTINO,rewrite-timestamp=true" \
        "$CONTEXTO"
}

digest() {
    tar -xOf "$1" index.json | sed -n 's/.*"digest":"\([^"]*\)".*/\1/p'
}

echo "Construyendo $IMAGEN dos veces para $PLATAFORMA (SOURCE_DATE_EPOCH=$EPOCH)..."
construir "$TEMPORAL/primera.tar"
construir "$TEMPORAL/segunda.tar"

PRIMER_DIGEST=$(digest "$TEMPORAL/primera.tar")
SEGUNDO_DIGEST=$(digest "$TEMPORAL/segunda.tar")

if [ -z "$PRIMER_DIGEST" ] || [ "$PRIMER_DIGEST" != "$SEGUNDO_DIGEST" ]; then
    echo "Build no reproducible: ${PRIMER_DIGEST:-sin digest} != ${SEGUNDO_DIGEST:-sin digest}" >&2
    exit 1
fi

echo "Build reproducible: $PRIMER_DIGEST"
