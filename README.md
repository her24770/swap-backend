# swap-backend

Backend service for **Swap** — a platform for student tutoring, academic material exchange, and peer-to-peer services.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| Framework | Express.js |
| Language | TypeScript |
| ORM | Prisma |
| Database | PostgreSQL 16 |
| Cache / Pub-Sub | Redis 7 |
| Containerization | Docker + Docker Compose |

## Project Structure

```
swap-backend/
├── src/
│   ├── api_rest/        # Express routers and entry point
│   ├── controlador/     # Controllers (business logic delegation)
│   ├── modelo/          # Domain models
│   ├── repository/      # Data access layer (Prisma queries)
│   ├── persistencia/    # Prisma client setup
│   ├── tiempo_real/     # Socket.io WebSocket handlers
│   └── infraestructura/ # DB, Redis, Cloudinary connectors
├── prisma/
│   └── schema.prisma    # Database schema
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## Services (Docker)

| Container | Image | Port |
|---|---|---|
| `backend` | node:20-alpine | 3001 |
| `postgres` | postgres:16 | 5432 |
| `redis` | redis:7-alpine | 6379 |

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose installed

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/<org>/swap-backend.git
   cd swap-backend
   ```

2. Copy the environment file and fill in the values:
   ```bash
   cp .env.example .env
   ```

3. Start all services:
   ```bash
   docker compose up --build
   ```

4. The API will be available at `http://localhost:3001`

### Environment Variables

See `.env.example` for all required variables. Key ones:

```env
DATABASE_URL=postgresql://user:password@postgres:5432/swap
REDIS_URL=redis://redis:6379
JWT_SECRET=your_secret_here
CLOUDINARY_URL=your_cloudinary_url
PORT=3001
```

## API

Base URL: `http://localhost:3001/api`

| Resource | Endpoints |
|---|---|
| Users | `/api/users` |
| Publications | `/api/publications` |
| Tutoring | `/api/tutoring` |
| Moderation | `/api/moderation` |

Full API documentation: _coming soon_

## Database

Managed with Prisma ORM. To run migrations manually:

```bash
docker compose exec backend npx prisma migrate dev
```

## Contributing

1. Create a branch from `main`: `git checkout -b feature/your-feature`
2. Commit your changes
3. Open a Pull Request

## Team

Swap — Universidad del Valle de Guatemala, CC3090 Ingeniería de Software I, Semestre I 2026
