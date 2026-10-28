import prisma from "../persistencia/prismaClient.js";
import redis from "../persistencia/redisClient.js";

const TIMEOUT_MS = 150;

function conTimeout<T>(promesa: Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("health timeout")), TIMEOUT_MS);
        promesa.then(
            resultado => { clearTimeout(timeout); resolve(resultado); },
            error => { clearTimeout(timeout); reject(error); },
        );
    });
}

export async function comprobarDependencias(): Promise<string[]> {
    const resultados = await Promise.allSettled([
        conTimeout(prisma.$queryRaw`SELECT 1`),
        conTimeout(redis.ping()),
    ]);

    return resultados.flatMap((resultado, indice) =>
        resultado.status === "rejected" ? [indice === 0 ? "postgres" : "redis"] : []
    );
}
