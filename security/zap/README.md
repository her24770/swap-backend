# Pruebas dinámicas de seguridad con OWASP ZAP

Cubre SWAP-574, SWAP-575 y SWAP-576. Todo corre contra una **copia aislada**
de Swap (nunca contra producción): mismas imágenes de Docker que producción,
pero con su propia base de datos, Redis, red y secretos.

## Requisitos

- Docker (`docker-compose` en Mac, `docker compose` en el servidor — el
  script detecta cuál hay).
- Haber corrido `docker build --target production -t swap-backend-api:latest .`
  y `docker build -t swap-backend-embeddings:latest ./embeddings` al menos una
  vez (o pasar `ZAP_API_IMAGE`/`ZAP_EMBEDDINGS_IMAGE` con otra imagen ya construida).

## Uso

```bash
cd security/zap

# 1. Levantar la copia aislada (puerto 3220) y cargar datos de prueba
./run-zap.sh up

# 2. Reproducción manual de hallazgos que dependen de lógica de negocio /
#    topología del proxy (rate limit compartido, fuerza bruta, timing, etc.)
./validar-hallazgos.sh

# 3. Escaneo rápido de CI (Baseline, ~1 min): anónimo + autenticado
./run-zap.sh ci-baseline

# 4. Escaneos exhaustivos con ZAP (manual/auditoría profunda): 
#    anónimo, autenticado por rol y pasivo contra producción (~30-40 min por rol)
./run-zap.sh scan anonimo usuario moderador superadmin produccion

# 5. Apagar la copia y borrar sus datos
./run-zap.sh down
```

## Escaneo rápido en CI (`ci-baseline`)

Para el pipeline de integración continua (cubriendo la tarea **ST-TT-S9-08-3**), se incluye el comando `./run-zap.sh ci-baseline`, diseñado para correr de forma automatizada en cada Pull Request:

1. **Efímero y ligero:** Levanta la copia aislada, construye automáticamente un mock ultra-ligero de embeddings (`mock-embeddings/`) para no descargar 500 MB de modelos de ML en el runner, y ejecuta los seeds.
2. **Plan Baseline (`plans/api-baseline.yaml`):** Importa el OpenAPI vivo y realiza análisis pasivo tanto sin sesión como con el usuario de prueba (`vendedor@uvg.edu.gt`), omitiendo ataques agresivos para completar la auditoría en ~1 minuto.
3. **Criterio de fallo:** Evalúa el `reporte.json`. Si detecta vulnerabilidades de severidad **Alta** (`riskcode == "3"` o `High`), el proceso finaliza con código de error `1`, fallando el check del PR y bloqueando el despliegue a producción. Si no hay alertas altas, finaliza con código `0`.
4. **Artefactos:** Los resultados (`reporte.html`, `reporte.json` y `reporte.md`) se guardan en `reports/ci-baseline/` y en GitHub Actions se publican como artefacto descargable (`zap-report-baseline-<run_id>`).
5. **Limpieza:** Al finalizar (incluso ante cancelaciones o fallos), apaga y elimina automáticamente los contenedores y volúmenes efímeros.

Cada fase de `scan` exhaustivo puede correrse por separado (`./run-zap.sh scan anonimo`)
y los reportes quedan en `reports/<fecha-hora>/<fase>/` (HTML, JSON y
Markdown). `reports/` no se sube al repo — puede contener rutas, payloads y
metadatos de la app real; se adjunta a mano en Jira (SWAP-574) como evidencia.


## Qué hace cada pieza

| Archivo | Rol |
|---|---|
| `docker-compose.zap.yml` | Copia aislada: Postgres, Redis, embeddings, API y un nginx que replica el bloque real de producción (mismos `proxy_set_header`, para que `req.ip` se comporte igual). |
| `mock-embeddings/` | Servidor HTTP mínimo en Python sin dependencias externas para simular el servicio de IA en pipelines de CI sin descargar modelos pesados. |
| `nginx.conf` | El nginx de la copia (sin TLS). |
| `plans/api-baseline.yaml` | Escaneo rápido para CI: importa OpenAPI, analiza tráfico pasivo anónimo y autenticado, omitiendo ataques agresivos. |
| `plans/api-anonimo.yaml` | Escaneo activo sin sesión: importa el OpenAPI y ataca cada endpoint como visitante no autenticado. |
| `plans/api-autenticado.yaml` | Igual, pero inyectando el JWT de un rol (usuario / moderador / superadmin) en cada petición vía Replacer. |
| `plans/produccion-pasivo.yaml` | Solo lectura contra `swap.jhgo.online`: páginas públicas + spider superficial. Excluye `/api/` y `/socket.io/` a propósito (rate limit compartido con usuarios reales). |
| `run-zap.sh` | Orquesta todo: levanta/apaga la copia, exporta el OpenAPI vivo, corre escaneo baseline (`ci-baseline`) o completo (`scan`) y evalúa alertas de severidad alta. |
| `validar-hallazgos.sh` | Reproduce a mano, con contenedores `curl` como clientes separados, los hallazgos que un escaneo automático no puede confirmar solo (ver abajo). |

## Por qué existe `validar-hallazgos.sh`

El rate limiting de Swap tiene dos capas (`src/autenticacion/rateLimiter.ts`):

- Un límite **global por IP** en memoria (120 req/min) para toda la API.
- Un límite **por bucket en Redis** (5 intentos / 15 min) solo para
  login/códigos de verificación.

Ambos usan `req.ip`, y Express no tiene configurado `trust proxy` — así que,
detrás de nginx, **todas las peticiones externas llegan con la misma IP** (la
del proxy). Un escáner corriendo desde un solo cliente no puede ver el efecto
que esto tiene sobre *otros* usuarios reales; para eso hacen falta clientes
separados (contenedores `curl` distintos) atacando y consultando al mismo
tiempo. Eso es lo que hace `validar-hallazgos.sh`:

- **V1** — confirma con qué IP ve Express a clientes distintos.
- **V2** — un cliente agota el límite global; ¿se bloquea también a otro cliente que nunca pidió nada?
- **V3** — un cliente falla 5 logins contra la cuenta de otro; ¿se bloquea el login de un tercero?
- **V4** — ¿alternar intentos fallidos con un login propio exitoso resetea el contador de intentos fallidos contra la víctima?
- **V5** — diferencia de tiempo de respuesta entre correo existente/inexistente (enumeración de cuentas).
- **V6** — ¿una cabecera `X-Forwarded-For` falsa evade el límite hoy?

El resultado queda en `reports/validacion-<fecha>.txt` (texto plano, se sube
tal cual a Jira o se resume en el informe final).

## Notas

- La copia impone límites de memoria/CPU a cada contenedor (ver
  `docker-compose.zap.yml`) y `run-zap.sh` aborta si el servidor tiene menos
  de `ZAP_MIN_FREE_MB` (2500 MB por defecto) libres, para no afectar a los
  demás proyectos que comparten el mismo servidor.
- El escaneo activo respeta el rate limit real de la API (120 req/min): usa
  1 hilo y ~700 ms de espera entre peticiones, y espera la ventana de 60s
  antes de empezar. Por eso cada fase autenticada puede tomar 30-40 minutos.
- El informe final (SWAP-576) vive en `docs/seguridad/informe-zap.md`, un
  nivel arriba de esta carpeta.
