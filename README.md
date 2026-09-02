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

El seed crea:

- 1 usuario vendedor de prueba (`vendedor@uvg.edu.gt`)
- 1 moderador de prueba (`moderador1`)
- Etiquetas de carrera y cursos (ICC, Biología, etc.)
- 15 publicaciones de muestra (5 materiales · 5 tutorías · 5 negocios)
- Catálogos base: estados, tipos de perfil, tipos de contacto, motivos de reporte, palabras restringidas

### Correr el seed (primera vez o cuando se necesiten datos frescos)

Con los contenedores corriendo, ejecuta desde tu máquina:

```bash
docker compose exec api npm run prisma:seed

docker compose exec api npx tsx prisma/seedPruebas.ts

docker compose exec api npx tsx prisma/backfillEmbeddings.ts
```

> El backfill genera los vectores de búsqueda para todas las publicaciones. Debe correrse después de cada seed de pruebas.

### Credenciales de prueba

| Rol                | Email / Usuario       | Contraseña      |
| ------------------ | --------------------- | --------------- |
| Usuario (vendedor) | `vendedor@uvg.edu.gt` | `Vendedor123!`  |
| Moderador          | `moderador1`          | `Moderador123!` |

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
ejecutar desde el host, se puede copiar `.env.integration.example`, levantar solo
`postgres-integration` y `redis-integration`, y correr `npm run test:integration`.

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
