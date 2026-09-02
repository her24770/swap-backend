#!/bin/sh
set -eu

COMPOSE_FILE="docker-compose.integration.yml"

cleanup() {
  docker compose -f "$COMPOSE_FILE" down --volumes --remove-orphans
}

# El proyecto Compose tiene nombre propio y almacenamiento tmpfs. Se elimina
# cualquier ejecución anterior y el trap garantiza la retirada aun si fallan tests.
trap cleanup EXIT INT TERM
cleanup
docker compose -f "$COMPOSE_FILE" up --build --abort-on-container-exit --exit-code-from integration-tests
