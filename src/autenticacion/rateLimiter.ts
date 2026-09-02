import redis from "../persistencia/redisClient.js";

type Bucket =
    | "login"
    | "solicitar_codigo_registro"
    | "verificar_codigo_registro"
    | "solicitar_codigo_recuperacion"
    | "verificar_codigo_recuperacion";

const LIMITES: Record<Bucket, { maxIntentos: number; ventanaSegundos: number }> = {
    login: { maxIntentos: 5, ventanaSegundos: 60 * 15 },
    solicitar_codigo_registro: { maxIntentos: 3, ventanaSegundos: 60 * 15 },
    verificar_codigo_registro: { maxIntentos: 5, ventanaSegundos: 60 * 10 },
    solicitar_codigo_recuperacion: { maxIntentos: 3, ventanaSegundos: 60 * 15 },
    verificar_codigo_recuperacion: { maxIntentos: 5, ventanaSegundos: 60 * 10 },
};

function construirClave(bucket: Bucket, identificador: string): string {
    return `rate:${bucket}:${identificador}`;
}

export async function registrarIntento(bucket: Bucket, identificador: string): Promise<void> {
    const key = construirClave(bucket, identificador);
    const intentos = await redis.incr(key);
    if (intentos === 1) await redis.expire(key, LIMITES[bucket].ventanaSegundos);
}

export async function estaBloqueado(bucket: Bucket, identificador: string): Promise<boolean> {
    const intentos = await redis.get(construirClave(bucket, identificador));
    return parseInt(intentos ?? "0") >= LIMITES[bucket].maxIntentos;
}

export async function limpiarIntentos(bucket: Bucket, identificador: string): Promise<void> {
    await redis.del(construirClave(bucket, identificador));
}
