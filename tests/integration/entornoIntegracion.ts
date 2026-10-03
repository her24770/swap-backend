import prisma from "../../src/persistencia/prismaClient";
import redis from "../../src/persistencia/redisClient";
import { reiniciarRateLimiters } from "../../src/autenticacion/rateLimiter";

export function verificarEntornoIntegracion(): void {
    if (process.env.NODE_ENV !== "test" || process.env.RUN_INTEGRATION !== "true") {
        throw new Error("La limpieza solo puede ejecutarse con NODE_ENV=test y RUN_INTEGRATION=true.");
    }

    const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
    const nombreBase = databaseUrl.pathname.slice(1);
    if (!nombreBase.endsWith("_test")) {
        throw new Error(`Base de integración insegura: "${nombreBase}" debe terminar en _test.`);
    }
    if (nombreBase !== "swap_integration_test") {
        throw new Error(`Base de integración inesperada: "${nombreBase}".`);
    }

    const hostsLocales = new Set(["localhost", "127.0.0.1"]);
    const puertosPostgresLocales = new Set(["55432", process.env.INTEGRATION_POSTGRES_PORT].filter(Boolean));
    const postgresCompose = databaseUrl.hostname === "postgres-integration" && databaseUrl.port === "5432";
    const postgresLocal = hostsLocales.has(databaseUrl.hostname) && puertosPostgresLocales.has(databaseUrl.port);
    if (!postgresCompose && !postgresLocal) {
        throw new Error("PostgreSQL de integración debe usar el servicio o puerto aislado documentado.");
    }

    const redisUrl = new URL(process.env.REDIS_URL ?? "");
    if (redisUrl.pathname !== "/15") {
        throw new Error("Redis de integración debe usar exclusivamente la base lógica 15.");
    }
    const puertosRedisLocales = new Set(["56379", process.env.INTEGRATION_REDIS_PORT].filter(Boolean));
    const redisCompose = redisUrl.hostname === "redis-integration" && redisUrl.port === "6379";
    const redisLocal = hostsLocales.has(redisUrl.hostname) && puertosRedisLocales.has(redisUrl.port);
    if (!redisCompose && !redisLocal) {
        throw new Error("Redis de integración debe usar el servicio o puerto aislado documentado.");
    }
}

export async function limpiarEntornoIntegracion(): Promise<void> {
    verificarEntornoIntegracion();
    await prisma.$executeRawUnsafe(`
        DO $$
        DECLARE tabla RECORD;
        BEGIN
            FOR tabla IN
                SELECT tablename
                FROM pg_tables
                WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
            LOOP
                EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', tabla.tablename);
            END LOOP;
        END $$;
    `);

    if (!redis.isOpen) await redis.connect();
    await redis.flushDb();
    reiniciarRateLimiters();
}

export async function cerrarEntornoIntegracion(): Promise<void> {
    await prisma.$disconnect();
    if (redis.isOpen) await redis.quit();
}
