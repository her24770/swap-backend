# swap-backend

Backend service for **Swap** — a platform for student tutoring, academic material exchange, and peer-to-peer services.

## Tech Stack

| Layer            | Technology              |
| ---------------- | ----------------------- |
| Runtime          | Node.js 20              |
| Framework        | Express.js              |
| Language         | TypeScript              |
| Real-time        | Socket.io               |
| Validation       | Zod                     |
| Auth             | JSON Web Token + bcrypt |
| ORM              | Prisma                  |
| Database         | PostgreSQL 16           |
| Cache / Pub-Sub  | Redis 7                 |
| Containerization | Docker + Docker Compose |

## Project Structure

| Carpeta          | Qué va ahí                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| `api_rest/`      | Routers de Express — solo enrutan, sin lógica. Ej: `routerAuth.ts`, `routerPublicacion.ts`                       |
| `controlador/`   | Adaptadores HTTP: leen request, llaman servicios y construyen la respuesta. Ej: `controlPublicacion.ts`           |
| `servicios/`     | Casos de uso y coordinación de reglas, repositorios y proveedores externos. Ej: `servicioPublicacion.ts`          |
| `modelo/`        | Interfaces y tipos TypeScript del dominio. Ej: `Usuario.ts`, `Publicacion.ts`                                    |
| `repository/`    | Queries a Prisma. Solo acceso a datos, sin lógica de negocio. Ej: `repositorioUsuario.ts`                        |
| `persistencia/`  | Singleton de `PrismaClient` — un único cliente para toda la app. Solo `prismaClient.ts`                          |
| `autenticacion/` | Lógica de JWT y bcrypt: generar/verificar tokens, hashear contraseñas. Ej: `servicioJWT.ts`, `servicioBcrypt.ts` |
| `tiempo_real/`   | Handlers de Socket.io — eventos de chat y notificaciones. Ej: `socketHandlers.ts`                                |

## Services (Docker)

| Container  | Image          | Port |
| ---------- | -------------- | ---- |
| `backend`  | node:20-alpine | 3001 |
| `postgres` | postgres:16    | 5432 |
| `redis`    | redis:7-alpine | 6379 |

---

## Getting Started

### 1. Clonar el repositorio

```bash
git clone https://github.com/<org>/swap-backend.git
cd swap-backend
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus valores. Para desarrollo local los valores por defecto funcionan sin cambios.

### 3. Levantar todos los servicios

```bash
docker compose up  --build
```

Esto inicia PostgreSQL, Redis y el backend. El contenedor de la API corre automáticamente `prisma db push` al arrancar, así que el esquema ya queda creado.

### 4. Verificar que todo corre

```bash
curl http://localhost:3001/api/health
# Respuesta esperada: {"status":"ok"}
```

### 5. Explorar y probar la API

Con el backend en ejecución, la documentación interactiva está disponible en:

- Swagger UI canónico: `http://localhost:3001/api/v1/docs`
- Especificación OpenAPI 3.2: `http://localhost:3001/api/v1/openapi.json`
- Alias compatible durante v1: `http://localhost:3001/api/docs`

Swagger UI permite ejecutar cada operación desde el navegador. Las rutas protegidas
aceptan la cookie `swap-token` creada por el inicio de sesión o un JWT configurado
desde el botón **Authorize**.

---

## Datos de prueba (Seed)

> **El seed NO corre automáticamente con Docker.** Cada integrante lo ejecuta manualmente cuando lo necesita.

El seed estructural crea los catálogos y el seed de pruebas cubre todos los módulos:

- 3 usuarios, 2 moderadores y contactos
- Etiquetas de carrera y cursos (ICC, Biología, etc.)
- 27 publicaciones (9 materiales · 9 tutorías · 9 negocios), con etiquetas e imágenes R2
- Horarios, certificaciones, anuncios, conversaciones, mensajes y acuerdos
- Reseñas, reportes, notificaciones, likes y guardados
- Catálogos base: estados, tipos de perfil, tipos de contacto, motivos de reporte, palabras restringidas

### Correr el seed (primera vez o cuando se necesiten datos frescos)

Con los contenedores corriendo, ejecuta desde tu máquina:

```bash
docker compose exec api npm run prisma:seed

docker compose exec api npx tsx prisma/seedPruebas.ts

docker compose exec api npx tsx prisma/backfillEmbeddings.ts
```

> El backfill genera los vectores de búsqueda para todas las publicaciones. Debe correrse después de cada seed de pruebas.

El seed de pruebas usa la URL pública de `CLOUDFLARE_R2_PUBLIC_URL` y comprueba por
`HEAD` que cada objeto configurado exista antes de escribir datos. Las claves se
configuran con `SEED_*_KEY` (consulta `.env.example`). Cuando R2 conserva los
valores placeholder, usa recursos públicos de muestra para desarrollo local. Es repetible, usa fechas y
claves lógicas estables, y se bloquea cuando el host o nombre de la base en
`DATABASE_URL` parece de producción. `ALLOW_DEMO_SEED=true` es el desbloqueo explícito.
Al finalizar imprime una tabla de cobertura y aborta si falta alguna relación.

### Casos identificables para pruebas de filtros UX/UI

Estas publicaciones tienen combinaciones deliberadamente específicas. Después de ejecutar la seed pueden localizarse así:

| Vista | Publicación esperada | Propietario | Filtros |
| --- | --- | --- | --- |
| `/es/materiales` | `Calculadora científica Casio fx-991EX` | Adriana Jiménez | Tipo `Alquiler`, etiqueta `Electrónica 1`, precio `Q137–Q137`, calificación `4–4` |
| `/es/negocios` | `Caja de brownies artesanales` | Carlos Méndez | Tipo `Producto`, etiqueta `Repostería`, precio `Q73–Q73`, calificación `5–5` |
| `/es/tutorias` | `Tutoría nocturna de Física 2` | Adriana Jiménez | Etiqueta `Física 2`, precio `Q65–Q65`, calificación `4–4`, viernes, horario `18:00–20:00` |

Si el control deslizante dificulta seleccionar un valor exacto, puede usarse un
rango de cinco quetzales alrededor del precio; las demás condiciones mantienen
el caso identificable.

### Credenciales de prueba

| Rol                | Email / Usuario       | Contraseña      |
| ------------------ | --------------------- | --------------- |
| Usuario (vendedor) | `vendedor@uvg.edu.gt` | `Vendedor123!`  |
| Usuario (vendedor) | `vendedor123@uvg.edu.gt` | `Vendedor123!`  |
| Usuario (comprador) | `estudiante@uvg.edu.gt` | `Estudiante123!` |
| Moderador          | `moderador1`          | `Moderador123!` |
| Superadmin         | `superadmin1`         | `SuperAdmin123!` |

---

## Comandos útiles

```bash
# Ver logs en tiempo real
docker compose logs -f api

# Detener servicios (conserva los datos)
docker compose down

# Detener y eliminar volúmenes (borra datos de DB — equivale a reset completo)
docker compose down -v

# Abrir Prisma Studio (visualizar la BD en el navegador)
docker compose exec api npx prisma studio

# Aplicar cambios al schema sin migraciones (desarrollo)
docker compose exec api npx prisma db push

# Generar cliente Prisma después de cambiar el schema
docker compose exec api npx prisma generate
```

### Backups de PostgreSQL

`postgres-backup` crea diariamente un dump validado y lo guarda en el bucket
R2 configurado con las variables `BACKUP_R2_*`. Después de subirlo, relee el
objeto completo, compara su SHA-256 y guarda un manifiesto JSON con metadatos,
duración, hashes, etapa y resultado de la ejecución. Operaciones manuales:

```bash
docker compose exec postgres-backup postgres-backup backup
docker compose exec postgres-backup postgres-backup list
docker compose exec postgres-backup postgres-backup restore archivo.dump
```

La restauración elimina los objetos actuales de la base destino y exige escribir
su nombre para confirmar. Detener `api` antes de restaurar producción.

---

## Testing

El proyecto utiliza **Vitest** como framework de pruebas y **Supertest** para validar endpoints HTTP.

La configuración de pruebas se encuentra en:

```

vitest.config.ts

```

Los tests están organizados dentro de la carpeta:

```

tests/
├── integration/
│   └── health.test.ts
├── unit/
└── setup.ts

```

### Tipos de pruebas

### Unit Tests

Los tests unitarios validan lógica interna de forma aislada. Las dependencias externas son simuladas mediante mocks para evitar depender de servicios como Redis, PostgreSQL o servicios externos.

Se utilizan principalmente para probar:

- Controladores.
- Middlewares.
- Validaciones con Zod.
- Servicios de autenticación.
- Lógica de negocio.

Ejemplo:

```

tests/unit/controlAuth.test.ts

```

---

### Integration Tests

Los tests de integración validan que diferentes componentes funcionen correctamente juntos.

Actualmente incluyen pruebas de endpoints utilizando `Supertest`, importando directamente la aplicación Express desde `src/app.ts`.

Ejemplo:

```

tests/integration/health.test.ts

```

---

## Ejecutar tests

Después de instalar las dependencias:

```bash
npm install
```

Ejecutar tests en modo desarrollo:

```bash
npm test
```

Ejecutar todos los tests una sola vez:

```bash
npm run test:run
```

Generar reporte de cobertura:

```bash
npm run test:coverage
```

### Contrato e inventario de endpoints

La matriz trazable se genera desde los routers de Express y se cruza con OpenAPI
y las invocaciones HTTP existentes:

```bash
npm run endpoints:inventory
npm run test:contract
```

El resultado queda en `docs/matriz-endpoints.md`. CI debe ejecutar
`test:contract`: falla si una ruta no está documentada o si la seguridad de
OpenAPI no coincide con sus middlewares. La matriz diferencia documentación,
pruebas de autorización y casos funcionales pendientes.

Las decisiones de versionado, idempotencia y compatibilidad de verbos están en
`docs/contrato-rest-v1.md`. La URL canónica es `/api/v1`; `/api` permanece como
alias compatible. Los `PUT` parciales heredados responden con headers de
deprecación y tienen reemplazos `PATCH` documentados.

### Integración aislada

El entorno de integración usa PostgreSQL/pgvector y Redis efímeros, sin reutilizar
volúmenes ni nombres del entorno de desarrollo:

```bash
npm run test:integration:docker
```

El comando elimina una ejecución aislada anterior, crea el esquema, ejecuta las
suites y destruye contenedores, red y volúmenes al finalizar. Además, cada caso
real trunca PostgreSQL reiniciando identidades, vacía Redis DB 15, reinicia los
rate limiters y vuelve a crear sus fixtures. La limpieza valida antes que
`NODE_ENV=test`, que PostgreSQL termine en `_test` y que Redis use DB 15; así
evita truncar por error una base de desarrollo o producción. El comando
`npm run test:integration:down` queda disponible como limpieza manual. Para
la guía completa para el resto del equipo (incluyendo ejecución desde el host y
cómo agregar nuevas IT), consultar
[`docs/guia-pruebas-integracion.md`](docs/guia-pruebas-integracion.md).

---

## Notas de implementación

Para permitir pruebas sin levantar el servidor HTTP completo, la configuración de Express fue separada:

- `src/app.ts`: configuración de Express y rutas, utilizada por los tests.
- `src/index.ts`: arranque del servidor, Socket.io y conexiones a servicios externos.

Esta separación permite importar la aplicación en los tests sin iniciar el servidor ni abrir puertos adicionales.

---

## Flujo de trabajo recomendado al integrarse al proyecto

1. Clonar el repo y copiar `.env.example` → `.env`
2. (Opcional) Instalar dependencias: `npm install` y ejecutar pruebas con `npm test`
3. `docker compose up -d --build`
4. Verificar `curl http://localhost:3001/health`
5. Correr los seeds si necesitas datos:
   ```bash
   docker compose exec api npm run prisma:seed
   docker compose exec api npx tsx prisma/seedPruebas.ts
   docker compose exec api npx tsx prisma/backfillEmbeddings.ts
   ```
6. (Opcional) Abrir Prisma Studio para explorar la BD: `docker compose exec backend npx prisma studio`

---

## Contributing

1. Crear rama desde `develop`: `git checkout -b feature/nombre-feature`
2. Hacer commits con mensajes descriptivos
3. Abrir un Pull Request hacia `develop`

---

## Team

Swap — Universidad del Valle de Guatemala
CC3090 Ingeniería de Software I, Semestre I 2026
