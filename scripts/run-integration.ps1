$ErrorActionPreference = "Stop"

$COMPOSE_FILE = "docker-compose.integration.yml"

function Cleanup {
    Write-Host "Limpiando contenedores y volúmenes de integración..."
    docker compose -f $COMPOSE_FILE down --volumes --remove-orphans
}

try {
    # Limpiar cualquier ejecución anterior
    Cleanup
    
    # Ejecutar pruebas levantando y esperando la salida de integration-tests
    docker compose -f $COMPOSE_FILE up --build --abort-on-container-exit --exit-code-from integration-tests
    $exitCode = $LASTEXITCODE
}
finally {
    # El bloque finally garantiza la limpieza aun si fallan los tests o se interrumpe el script
    Cleanup
}

if ($exitCode -ne 0) {
    exit $exitCode
}
