# Backups de PostgreSQL

El proyecto usa pgBackRest para guardar respaldos físicos cifrados en un bucket
privado de Cloudflare R2. PostgreSQL archiva los WAL continuamente y conserva
las últimas cuatro cadenas de backups completos.

## Calendario

- Full: domingo a las 03:00, hora de Guatemala.
- Incremental: lunes a sábado a las 03:00, hora de Guatemala.

El calendario se ejecuta dentro del contenedor `postgres`. No depende del
servicio antiguo `postgres-backup`.

## Configuración inicial

Crear un bucket privado de R2 y un token con acceso de lectura y escritura sobre
ese bucket. Configurar en `.env`:

```dotenv
BACKUP_R2_ACCOUNT_ID=
BACKUP_R2_ACCESS_KEY_ID=
BACKUP_R2_SECRET_ACCESS_KEY=
BACKUP_R2_BUCKET_NAME=
BACKUP_ENCRYPTION_KEY=
BACKUP_REPORT_ENVIRONMENT=development
```

La clave de cifrado puede generarse con:

```bash
openssl rand -base64 48
```

Guardar `BACKUP_ENCRYPTION_KEY` fuera del servidor. Sin ella no se pueden
restaurar los backups.

Construir e iniciar los servicios:

```bash
docker compose up -d --build --remove-orphans
```

Inicializar y validar la stanza una sola vez:

```bash
docker compose exec -u postgres postgres pgbackrest --stanza=swap stanza-create
docker compose exec -u postgres postgres pgbackrest --stanza=swap check
```

En producción, agregar `-f docker-compose.prod.yml` a los comandos de Compose.

## Uso

Consultar los backups disponibles:

```bash
docker compose exec -u postgres postgres pgbackrest --stanza=swap info
```

Crear backups manuales:

```bash
docker compose exec -u postgres postgres run-pgbackrest-backup full manual
docker compose exec -u postgres postgres run-pgbackrest-backup incr manual
```

Usar los wrappers anteriores garantiza que la ejecución también genere su
reporte. Invocar `pgbackrest backup` directamente no lo genera.

Seguir la ejecución programada:

```bash
docker compose logs -f postgres
```

## Reportes

Cada backup programado o manual genera una línea JSON en stdout y guarda el
mismo documento en el bucket configurado:

```text
reports/backups/YYYY/MM/DD/<execution-id>.json
```

Las restauraciones ejecutadas con el wrapper generan:

```text
reports/restores/YYYY/MM/DD/<execution-id>.json
```

El reporte contiene ambiente, tipo, resultado, duración, código de salida,
etiqueta, tamaños y rango WAL. Nunca incluye credenciales ni la clave de
cifrado. `BACKUP_REPORT_ENVIRONMENT` permite distinguir `development`,
`staging` y `production`.

Si el backup termina correctamente pero falla la carga de su reporte, el JSON
permanece en stdout y el wrapper devuelve un código distinto de cero. En una
restauración, `status: success` confirma que los archivos fueron restaurados;
`post_restore_validation: pending` recuerda que todavía deben validarse
PostgreSQL y la API.

## Verificación no destructiva

`check` valida la conexión con PostgreSQL, el repositorio R2 y el archivado WAL.
`verify` relee el backup indicado y comprueba su integridad:

```bash
docker compose exec -u postgres postgres pgbackrest --stanza=swap check
docker compose exec -u postgres postgres pgbackrest --stanza=swap --set=<ETIQUETA> verify
```

Obtener `<ETIQUETA>` con el comando `info`.

## Prueba real de restauración

> **Destructivo:** ejecutar únicamente en un entorno local desechable. Estos
> pasos reemplazan por completo el volumen local de PostgreSQL.

1. Crear un full y copiar su etiqueta desde `info`.
2. Detener los procesos que escriben en la base:

   ```bash
   docker compose stop api postgres
   ```

3. Vaciar únicamente el volumen PostgreSQL:

   ```bash
   docker compose run --rm --no-deps --user postgres --entrypoint find postgres /var/lib/postgresql/data -mindepth 1 -delete
   ```

4. Restaurar el punto exacto del full. `immediate` evita reproducir WAL
   posteriores, por ejemplo el WAL que contiene el borrado usado en la prueba:

   ```bash
   docker compose run --rm --no-deps --user postgres postgres run-pgbackrest-restore --set=<ETIQUETA> --type=immediate
   ```

5. Iniciar PostgreSQL, promover la copia restaurada y reactivar la API:

   ```bash
   docker compose up -d --wait postgres
   docker compose exec -u postgres postgres sh -lc 'psql -U "$PGBACKREST_PG1_USER" -d postgres -c "select pg_wal_replay_resume();"'
   docker compose up -d api
   ```

6. Confirmar el resultado:

   ```bash
   docker compose exec -u postgres postgres sh -lc 'psql -U "$PGBACKREST_PG1_USER" -d "$POSTGRES_DB" -Atc "select pg_is_in_recovery();"'
   docker compose exec -u postgres postgres pgbackrest --stanza=swap check
   curl --fail http://127.0.0.1:3001/api/health
   ```

La primera consulta debe devolver `f`, `check` debe finalizar correctamente y
la API debe responder con `{"status":"ok"}`.

## Fallos comunes

- `no valid backups`: todavía no existe un backup full.
- `ArchiveMismatchError`: el volumen pertenece a otro clúster; no crear una
  stanza nueva sobre el repositorio existente.
- Error al descifrar: `BACKUP_ENCRYPTION_KEY` no coincide con la usada al crear
  el backup.
- Error S3 o DNS: comprobar las credenciales, el bucket y la conectividad hacia
  R2 antes de volver a ejecutar `check`.
