# swap-backend

Backend service for **Swap** — a platform for student tutoring, academic material exchange, and peer-to-peer services.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| Framework | Express.js |
| Language | TypeScript |
| Real-time | Socket.io |
| Validation | Zod |
| Auth | JSON Web Token + bcrypt |
| ORM | Prisma |
| Database | PostgreSQL 16 |
| Cache / Pub-Sub | Redis 7 |
| Containerization | Docker + Docker Compose |

## Project Structure

| Carpeta | Qué va ahí |
|---|---|
| `api_rest/` | Routers de Express — solo enrutan, sin lógica. Ej: `routerAuth.ts`, `routerPublicacion.ts` |
| `controlador/` | Lógica de negocio. Recibe la request, llama al repositorio, devuelve respuesta. Ej: `controlUsuario.ts` |
| `modelo/` | Interfaces y tipos TypeScript del dominio. Ej: `Usuario.ts`, `Publicacion.ts` |
| `repository/` | Queries a Prisma. Solo acceso a datos, sin lógica de negocio. Ej: `repositorioUsuario.ts` |
| `persistencia/` | Singleton de `PrismaClient` — un único cliente para toda la app. Solo `prismaClient.ts` |
| `autenticacion/` | Lógica de JWT y bcrypt: generar/verificar tokens, hashear contraseñas. Ej: `servicioJWT.ts`, `servicioBcrypt.ts` |
| `tiempo_real/` | Handlers de Socket.io — eventos de chat y notificaciones. Ej: `socketHandlers.ts` |

## Services (Docker)

| Container | Image | Port |
|---|---|---|
| `backend` | node:20-alpine | 3001 |
| `postgres` | postgres:16 | 5432 |
| `redis` | redis:7-alpine | 6379 |

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
curl http://localhost:3001/health
# Respuesta esperada: {"status":"ok"}
```

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
docker compose exec api npx ts-node --transpile-only prisma/seed.ts
```

### Credenciales de prueba

| Rol | Email / Usuario | Contraseña |
|---|---|---|
| Usuario (vendedor) | `vendedor@uvg.edu.gt` | `Vendedor123!` |
| Moderador | `moderador1` | `Moderador123!` |

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

## Flujo de trabajo recomendado al integrarse al proyecto

1. Clonar el repo y copiar `.env.example` → `.env`
2. `docker compose up -d --build`
3. Verificar `curl http://localhost:3001/health`
4. Correr el seed si necesitas datos: `docker compose exec backend npx ts-node --transpile-only prisma/seed.ts`
5. (Opcional) Abrir Prisma Studio para explorar la BD: `docker compose exec backend npx prisma studio`

---

## Contributing

1. Crear rama desde `develop`: `git checkout -b feature/nombre-feature`
2. Hacer commits con mensajes descriptivos
3. Abrir un Pull Request hacia `develop`

---

## Team

Swap — Universidad del Valle de Guatemala
CC3090 Ingeniería de Software I, Semestre I 2026