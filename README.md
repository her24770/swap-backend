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
| ORM | Prisma *(pendiente de configurar)* |
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

## Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose installed

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

Edita `.env` con tus valores reales. Variables clave:


### 3. Levantar todos los servicios

```bash
docker compose up -d --build
```

La API estará disponible en `http://localhost:3001`

### 4. Verificar que todo corre

```bash
# Ver logs en tiempo real
docker compose logs -f

# Verificar el health endpoint
curl http://localhost:3001/health
```

### Comandos útiles

```bash
# Detener servicios (conserva los datos)
docker compose down

# Detener y eliminar volúmenes (borra datos de DB y Redis)
docker compose down -v

# Reconstruir solo el backend
docker compose up -d --build api

# Ver logs de un servicio específico
docker compose logs -f backend
```

## API

Base URL: `http://localhost:3001/api`

| Resource | Endpoints |
|---|---|
| Health | `GET /health` |
| Users | `/api/users` |
| Publications | `/api/publications` |
| Tutoring | `/api/tutoring` |
| Moderation | `/api/moderation` |

Documentación completa: *coming soon*

## Database (Prisma)

> Prisma está incluido en las dependencias pero pendiente de configurar el schema.

Una vez configurado el `prisma/schema.prisma`, los comandos serán:

```bash
# Correr migraciones dentro del contenedor
docker compose exec backend npx prisma migrate dev

# Abrir Prisma Studio
docker compose exec backend npx prisma studio
```

## Development

Para desarrollo local (requiere Node.js instalado):

```bash
npm install
npm run dev   # hot-reload con ts-node-dev
```

## Contributing

1. Crear rama desde `main`: `git checkout -b feature/nombre-feature`
2. Hacer commits con mensajes descriptivos
3. Abrir un Pull Request hacia `main`

## Team

Swap — Universidad del Valle de Guatemala  
CC3090 Ingeniería de Software I, Semestre I 2026
