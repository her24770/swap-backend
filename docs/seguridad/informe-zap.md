# Informe de pruebas dinámicas de seguridad — OWASP ZAP

Cubre SWAP-574 (ejecución), SWAP-575 (validación y priorización) y SWAP-576
(este informe y el plan de mitigación).

**Fecha de ejecución:** 2026-09-28 y 2026-09-29
**Ejecutado por:** Josue Hernández González
**Objetivo:** `swap-backend` (copia aislada, imagen `swap-backend-api:latest`
idéntica a la desplegada en `develop`) + escaneo pasivo del sitio real
`swap.jhgo.online`.

## Resumen ejecutivo

Se ejecutaron cinco escaneos dinámicos (sin sesión, como usuario, como
moderador, como superadmin, y un escaneo pasivo contra el sitio real) más
seis pruebas manuales dirigidas a validar cómo se comporta el sistema cuando
varios usuarios comparten la misma dirección IP detrás del proxy de
producción — algo que un escáner automático corriendo desde un solo cliente
no puede ver por sí solo.

El hallazgo más importante **no lo produjo un escáner, sino un accidente
real durante la prueba**: una petición malformada (con el cuerpo
multipart truncado) contra un endpoint de subida de archivos hizo que el
proceso completo de la API se cayera con una excepción sin capturar. La
causa es puntual y ya está identificada en el código (`middlewareMulter.ts`).
Esto afecta a las seis rutas que reciben archivos (`publicacion`, `anuncio`,
`certificacion`, `imagen/upload`, `imagen/perfil`, `reporte`) y representa
un vector de denegación de servicio trivial de explotar por cualquier
usuario autenticado.

La segunda familia de hallazgos, confirmada con pruebas manuales
reproducibles, muestra que el sistema de límites de tasa (rate limiting) —
que en teoría protege contra fuerza bruta y abuso — en la práctica **castiga
a usuarios legítimos en vez de al atacante**, porque Express no distingue la
IP real de cada cliente detrás del proxy de nginx. Un solo atacante puede
bloquear el login de todos los demás usuarios del sistema con 5 intentos
fallidos contra una cuenta ajena, y además puede evadir por completo el
límite de intentos contra una víctima específica.

El resto de los hallazgos (headers informativos, cookie de idioma sin
banderas de seguridad, CSP permisiva en el frontend, credenciales visibles
en la URL en los formularios de login/registro) son de severidad menor pero
igual de fáciles de corregir, y se documentan con su evidencia exacta más
abajo.

## Metodología

1. **Copia aislada, no producción.** Se construyó un stack Docker separado
   (`security/zap/docker-compose.zap.yml`) que reutiliza la misma imagen que
   corre en producción (`swap-backend-api:latest`, sin rebuild — el código
   de esta rama no toca `src/`), pero con base de datos, Redis, red y
   secretos propios. Se pobló con `prisma/seed.ts` y `prisma/seedPruebas.ts`
   (usuario normal, moderador y superadmin de prueba). Un `nginx` réplica
   exactamente el bloque `/api/` y `/socket.io/` del sitio real, para que
   `req.ip` en Express se comporte igual que en producción.
2. **Tres planes de automatización de ZAP** (`security/zap/plans/`):
   anónimo, autenticado (uno por rol, inyectando el JWT vía Replacer), y
   pasivo contra `swap.jhgo.online` excluyendo `/api/` y `/socket.io/`
   (para no arriesgar el rate limit compartido con usuarios reales).
3. **Ritmo deliberadamente lento.** El escaneo activo se limitó a 1 hilo y
   700 ms entre peticiones (~85 req/min), por debajo del límite real de la
   API (120 req/min), para obtener resultados representativos en vez de una
   ráfaga de 429 y para no competir por CPU con los otros 10+ proyectos que
   comparten el mismo servidor.
4. **Validación manual con clientes independientes**
   (`security/zap/validar-hallazgos.sh`). El rate limiting de Swap opera por
   IP, y un solo escáner no puede observar su efecto sobre *otros* clientes.
   Se usaron contenedores `curl` separados actuando como usuarios distintos,
   atacando y consultando al mismo tiempo, para confirmar si el límite de
   uno afecta al otro. Resultado completo en
   `security/zap/reports/validacion-servidor.txt` (no versionado, evidencia
   adjunta en Jira).
5. **Recursos del servidor protegidos.** El script aborta si hay menos de
   2.5 GB de RAM disponible; se verificó antes, durante y después de cada
   fase que el resto de los proyectos del servidor siguieran arriba y sin
   degradación (`docker ps`, `free -h`).

## Alcance y limitaciones

- El escaneo autenticado de los roles **moderador** y **superadmin**
  excluyó las rutas que reciben `multipart/form-data` (ver hallazgo
  crítico abajo) — se relanzaron con esa exclusión después de que el mismo
  tipo de petición tumbara la API durante la fase de **usuario**. La fase de
  **usuario** por tanto solo cubre completamente la parte del escaneo previa
  al crash; el resto de su ventana de tiempo (~35 de los 40 minutos)
  corrió contra una API caída y no aportó señal real.
- El escaneo pasivo contra producción excluyó `/api/` y `/socket.io/` a
  propósito — nunca se atacó activamente el sitio real.
- ZAP con reglas activas de intensidad "medium" no ejecuta pruebas de lógica
  de negocio (p. ej. IDOR real entre acuerdos, tutorías); esa cobertura ya
  la dan `docs/matriz-endpoints.md` y la suite de integración existente.

## Hallazgos

### CRÍTICO

#### C1 — Caída total del proceso por subida de archivo malformada (DoS)

**Descripción.** Un archivo `multipart/form-data` cuyo cuerpo llega
truncado o mal formado (falta el boundary final) hace que `busboy` (usado
internamente por `multer`) emita un evento `'error'` en el stream del
archivo. `src/servicios/middlewareMulter.ts` (función `crearUpload`,
`_handleFile`) escucha `file.stream.on("data", ...)` y `.on("end", ...)`
pero **nunca** `.on("error", ...)`. Un `EventEmitter` sin listener de
`'error'` hace que Node relance la excepción como no capturada, y el
proceso completo termina (`process.exit`).

**Evidencia.** Reproducido el 2026-09-28 08:07:44 UTC durante el escaneo
autenticado como "usuario": `PATCH /api/v1/publicacion/10` con un payload
multipart de prueba generado por ZAP. Log del contenedor:

```
node:events:502
      throw er; // Unhandled 'error' event
      ^
Error: Unexpected end of form
    at Multipart._final (/app/node_modules/busboy/lib/types/multipart.js:588:17)
Emitted 'error' event on FileStream instance at:
    at emitErrorNT (node:internal/streams/destroy:169:8)
Node.js v20.20.2
```

`docker inspect swap-zap-api` confirma `ExitCode: 1` a esa misma hora. A
partir de ahí, nginx respondió `502 Bad Gateway` a **todo** el tráfico
(incluidas las fases de `moderador` y `superadmin`, que tuvieron que
relanzarse) hasta reiniciar el contenedor manualmente.

**Alcance real.** Cualquier ruta que use `uploadImagen` o `uploadPdf`
(`middlewareMulter.ts`) es vulnerable por el mismo motivo:

| Ruta | Método |
|---|---|
| `/publicacion` | POST |
| `/publicacion/:id` | PATCH, PUT |
| `/anuncio` | POST |
| `/anuncio/:id_anuncio` | PATCH, PUT |
| `/certificacion` | POST |
| `/imagen/upload` | POST |
| `/imagen/perfil/:id` | PUT |
| `/reporte` | POST |

**Impacto.** Cualquier usuario autenticado (`soloUsuario` es el único
requisito de casi todas estas rutas) puede tumbar la API completa para
**todos los usuarios** con una sola petición HTTP malformada, sin necesitar
herramientas especiales — cualquier cliente HTTP que permita mandar un
cuerpo multipart incompleto (curl con `--data-binary` truncado, una
conexión cortada a mitad de subida, o directamente una petición armada a
mano) lo dispara. En producción, `restart: unless-stopped` reinicia el
contenedor, pero cada caída implica una ventana real de indisponibilidad
(en la prueba, ~15-20 segundos hasta que el health check volvió a dar 200) y
un atacante puede repetirlo en bucle.

**Mitigación recomendada.** Agregar un manejador de error al stream del
archivo en `_handleFile` (`middlewareMulter.ts`), devolviendo el error a
`multer` en vez de dejar que se propague sin capturar:

```ts
_handleFile: (_req, file, callback) => {
    const chunks: Buffer[] = [];
    file.stream.on("data", chunk => chunks.push(chunk));
    file.stream.on("end", () => { /* ... */ });
    file.stream.on("error", callback); // <- agregar esta línea
},
```

Complementar con un `process.on("uncaughtException", ...)` a nivel de
aplicación que loguee y cierre ordenadamente (defensa en profundidad), ya
que este patrón de "stream sin listener de error" puede repetirse en otras
partes del código que consuman streams.

---

### ALTO

#### A1 — Rate limiting sin `trust proxy`: un atacante bloquea a usuarios legítimos

**Descripción.** `src/app.ts` no configura `app.set("trust proxy", ...)`.
Express, sin esa configuración, no confía en la cabecera `X-Forwarded-For`
que agrega nginx y usa la conexión TCP directa como `req.ip` — que, detrás
de un proxy inverso, es siempre la IP del proxy. El resultado: **todo el
tráfico externo real llega a Express con la misma IP**, y tanto el límite
global (`rateLimiter.ts`, 120 req/min) como el bucket de login/códigos
(Redis, 5 intentos/15 min) usan `req.ip` como clave. Esto rompe la premisa
básica de un rate limiter por IP: no distingue usuarios.

**Evidencia (V1, V2, V3 — `validacion-servidor.txt`).**

- V1: dos contenedores cliente con IPs de red distintas (`172.24.0.x` /
  `192.168.32.x` según el entorno) generan la misma entrada en los logs de
  nginx como origen — confirmando que, del lado de Express, se ven idénticos.
- V2: un cliente A agota el límite global (125 peticiones a `/auth/me`,
  recibe 120×401 + 5×429). Un cliente B, que nunca había hecho ninguna
  petición, recibe **HTTP 429** en su primer intento.
- V3: un cliente A falla 5 veces el login contra la cuenta de otra persona
  (`vendedor123@uvg.edu.gt`). Un cliente B intenta iniciar sesión con **su
  propia contraseña correcta** (`vendedor@uvg.edu.gt`) y recibe
  `{"success":false,"message":"Demasiados intentos fallidos..."}` (429).

**Impacto.** Cualquier persona con acceso a la app puede, sin necesitar
ninguna cuenta, bloquear el acceso al sistema para **todos los demás
usuarios reales** detrás del mismo proxy: basta con fallar 5 logins contra
cualquier correo existente (ni siquiera necesita ser una cuenta real —
alcanza con un correo con formato válido) para que nadie más pueda iniciar
sesión durante 15 minutos. Es una denegación de servicio de autenticación
trivial y de bajísimo costo para el atacante.

**Mitigación recomendada.** En `src/app.ts`, antes de cualquier middleware
que use `req.ip`:

```ts
// Confiar solo en el proxy propio (nginx en el mismo host), nunca en
// cualquier X-Forwarded-For entrante — evitar reabrir la puerta de V6.
app.set("trust proxy", "loopback"); // o el número de saltos exacto detrás de nginx
```

Con esto, `req.ip` refleja la IP real del cliente que llega a nginx
(columna `X-Real-IP` que ya se está enviando, ver `swap.jhgo.online` nginx
config). Repetir V2 y V3 después del cambio para confirmar que cada IP
tiene su propio contador.

#### A2 — Bypass del límite de intentos de login (fuerza bruta ilimitada)

**Descripción.** `limpiarIntentos("login", ip)` se llama tras **cualquier**
login exitoso de esa IP (`controlAuth.ts`), sin distinguir si el login
exitoso es del mismo usuario contra el que se venían acumulando fallos.
Combinado con A1 (todos comparten IP), esto significa que basta con
intercalar un login exitoso propio entre los intentos fallidos contra la
víctima para resetear el contador antes de llegar al límite.

**Evidencia (V4).** Un atacante alterna 4 contraseñas incorrectas contra
`vendedor123@uvg.edu.gt` con 1 login exitoso propio
(`vendedor@uvg.edu.gt`), repetido 5 veces (20 intentos fallidos totales
contra la víctima, el límite nominal es 5). Ninguna ronda se bloqueó — las
5 rondas terminaron en `HTTP 200`.

**Impacto.** El límite de 5 intentos/15 min es efectivamente decorativo
para un atacante que tenga (o cree) su propia cuenta en el sistema — puede
probar contraseñas contra cualquier otra cuenta indefinidamente.

**Mitigación recomendada.** Aplicar el bucket de intentos **por combinación
de IP + correo objetivo** en vez de solo IP (o, una vez corregido A1, por
IP real del atacante — que por sí solo ya mitiga la mayor parte del
problema, pero no la reutilización de la propia cuenta como "reseteador").
Alternativamente, no limpiar los intentos de un `identificador` distinto al
que tuvo éxito.

#### A3 — Posible envío de credenciales por GET en login/registro (frontend)

**Descripción.** El escaneo pasivo contra `swap.jhgo.online` registró
peticiones **GET** con `email`, `password` y `confirmar_password` en la
query string, en texto plano:

```
GET /es/login?email=zaproxy%40example.com&password=ZAP
GET /es/registro?apellido=ZAP&confirmar_password=ZAP&email_institucional=...&password=ZAP
```

Esto ocurrió cuando el spider de ZAP completó y envió automáticamente los
formularios de login/registro. Una petición GET con estos parámetros en la
URL implica que el navegador, cualquier proxy intermedio, el historial
local y los logs de acceso de nginx pueden quedar con contraseñas en texto
plano.

**No se confirmó la causa exacta en el código** (está fuera del alcance de
esta sesión modificar o inspeccionar en profundidad el JSX del frontend),
pero el patrón es consistente con un `<form method="get">` no explícito
(el valor por defecto de `method` en HTML es `GET`) o con una construcción
de URL en el cliente que concatena los campos del formulario antes de
navegar.

**Impacto.** Si se confirma, es exposición de credenciales en claro en
múltiples puntos (historial del navegador, logs de servidor/proxy,
posibles integraciones de analítica que registran la URL completa).

**Mitigación recomendada.** Verificar en `swap-frontend` que los
formularios de login y registro usan `method="POST"` explícito (o, si son
componentes controlados con `fetch`/`axios`, que nunca arman la URL con los
valores del formulario). Este ítem requiere revisión del equipo de
frontend — queda fuera del alcance de este informe (solo backend).

---

### MEDIO

#### M1 — Enumeración de cuentas por tiempo de respuesta

**Descripción.** `iniciarSesion` (`controlAuth.ts`) solo ejecuta
`ServicioBcrypt.compararPassword` (costoso, ~50-100 ms) cuando el correo
existe en la base de datos; si no existe, responde de inmediato.

**Evidencia (V5).** Tiempo promedio con correo existente: 44-82 ms.
Con correo inexistente: 3-13 ms. La diferencia es de un orden de magnitud y
estable en ambas corridas (Mac y servidor).

**Impacto.** Permite a un atacante determinar qué correos institucionales
están registrados en Swap sin necesitar ninguna otra información, midiendo
únicamente el tiempo de respuesta del login.

**Mitigación recomendada.** Ejecutar un hash bcrypt "señuelo" (contra una
constante) cuando el usuario no existe, para igualar el tiempo de respuesta
en ambos casos.

#### M2 — CSP permisiva en el frontend (`unsafe-inline` + wildcards)

**Descripción.** La CSP de `swap.jhgo.online` (fuera de `/api/`) incluye:

```
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
connect-src 'self' https://swap.jhgo.online https://swap.jhgo.online wss: https:;
img-src 'self' data: https: blob:
```

`'unsafe-inline'` en `script-src` anula gran parte del valor de tener una
CSP: si existiera un XSS reflejado o almacenado en el frontend, la CSP no
lo bloquearía. Los wildcards `https:` y `wss:` en `connect-src` permiten
conexiones desde el cliente a **cualquier** host HTTPS/WSS, no solo a los
propios servicios de Swap.

**Evidencia.** Confirmado por ZAP ("CSP: Wildcard Directive",
"CSP: script-src unsafe-inline", "CSP: style-src unsafe-inline") en 5 rutas
públicas escaneadas (`/`, `/login`, `/forgot-password`, etc.).

**Impacto.** Reduce la efectividad de la CSP como segunda línea de defensa
contra XSS. Es una mitigación en profundidad, no una vulnerabilidad
explotable por sí sola.

**Mitigación recomendada.** Migrar a CSP basada en nonces o hashes para los
`<script>`/`<style>` inline (Next.js soporta nonces vía middleware), y
acotar `connect-src`/`img-src` a los hosts reales que se usan
(`swap.jhgo.online`, el bucket de R2, WSS del propio backend) en vez de
comodines de esquema completo. Queda fuera del alcance de este informe
(configuración del frontend).

---

### BAJO

#### B1 — Fuga de versión del servidor (`Server` header)

nginx expone `Server: nginx/1.27.5` en todas las respuestas (5 instancias
por fase, todas las fases). Facilita a un atacante identificar CVEs
conocidos para esa versión exacta. Mitigación: `server_tokens off;` en la
configuración de nginx del servidor.

#### B2 — `X-Powered-By` expone Next.js

El frontend responde con la cabecera por defecto de Next.js. Mitigación:
`poweredByHeader: false` en `next.config.js`.

#### B3 — Cookie `NEXT_LOCALE` sin `HttpOnly` ni `Secure`

La cookie de idioma (next-intl) no lleva ninguna de las dos banderas. No es
sensible (solo guarda el idioma preferido), así que el riesgo real es bajo,
pero `Secure` es gratis de agregar dado que el sitio es HTTPS-only.

---

### INFORMATIVO

- **Content-Type Header Missing** en algunas respuestas estáticas del
  frontend (5 instancias).
- **Authentication Request Identified**: ZAP simplemente confirma que
  detectó los endpoints de login — no es un hallazgo, es metadata de la
  herramienta.

## Falsos positivos descartados

- **"Application Error Disclosure"** (2 instancias, fase `usuario`:
  `DELETE /publicacion/10` y `POST /conversacion`, ambos `500`). La
  "evidencia" de ZAP es la línea de estado HTTP genérica, no contenido real
  de la respuesta. El manejador de errores global
  (`src/app.ts`, último middleware) siempre responde
  `{"success": false, "message": "Error interno del servidor"}` sin volcar
  el stack trace al cliente — se verificó el código y se descarta como
  fuga real de información. Sí vale la pena investigar aparte **por qué**
  esas dos peticiones devuelven 500 (robustez, no seguridad), como ítem de
  mantenimiento futuro.
- **Evasión de límite vía `X-Forwarded-For` falso (V6)**: hoy la cabecera
  se ignora por completo (no hay `trust proxy`), así que **no** es
  explotable actualmente. Se documenta como advertencia para cuando se
  corrija A1: `trust proxy` debe configurarse para confiar únicamente en el
  proxy propio, nunca en la cabecera entrante sin validar, o esta vía de
  evasión se reabre.

## Conclusión

| Severidad | Cantidad | Hallazgos |
|---|---|---|
| Crítico | 1 | C1 — Crash por subida de archivo malformada |
| Alto | 3 | A1 — Rate limit sin trust proxy, A2 — Bypass de fuerza bruta, A3 — Credenciales en URL (a confirmar en frontend) |
| Medio | 2 | M1 — Enumeración de cuentas por timing, M2 — CSP permisiva (frontend) |
| Bajo | 3 | B1 — Server header, B2 — X-Powered-By, B3 — Cookie NEXT_LOCALE |
| Informativo | 2 | Content-Type faltante, metadata de ZAP |

**Pendiente para un próximo sprint** (no corregido en esta sesión, ya que
el alcance de SWAP-574/575/576 es ejecutar, validar y reportar, no
remediar):

1. C1 — agregar el manejador de error en `middlewareMulter.ts` (fix de una
   línea, alta prioridad — es la única vulnerabilidad de esta lista que
   permite tumbar el sistema completo).
2. A1 — configurar `trust proxy` en `app.ts` (desbloquea la corrección real
   de A2 también).
3. A2 — atar el contador de intentos de login al par IP+correo objetivo.
4. A3 — confirmar y corregir en `swap-frontend` (fuera de alcance backend).
5. M1, M2, B1-B3 — mejoras de bajo esfuerzo y bajo riesgo, agrupables en un
   solo ticket de "hardening de cabeceras y timing".

Toda la evidencia cruda (reportes HTML/JSON/MD de ZAP por fase, log de
validación manual, logs de nginx) está adjunta en los tickets de Jira
SWAP-574 y SWAP-575, no en este repositorio (`security/zap/reports/` está
excluido de git por contener datos y rutas de la aplicación real).
