import prisma from "../../src/persistencia/prismaClient";
import redis from "../../src/persistencia/redisClient";

export function verificarEntornoIntegracion(): void {
    if (process.env.NODE_ENV !== "test" || process.env.RUN_INTEGRATION !== "true") {
        throw new Error("La limpieza solo puede ejecutarse con NODE_ENV=test y RUN_INTEGRATION=true.");
    }

    const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
    const nombreBase = databaseUrl.pathname.slice(1);
    if (!nombreBase.endsWith("_test")) {
        throw new Error(`Base de integración insegura: "${nombreBase}" debe terminar en _test.`);
    }

    const redisUrl = new URL(process.env.REDIS_URL ?? "");
    if (redisUrl.pathname !== "/15") {
        throw new Error("Redis de integración debe usar exclusivamente la base lógica 15.");
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
}

export async function cerrarEntornoIntegracion(): Promise<void> {
    await prisma.$disconnect();
    if (redis.isOpen) await redis.quit();
}

