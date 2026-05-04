import redis from "../persistencia/redisClient.js";

const MAX_INTENTOS = 5;
const VENTANA_SEGUNDOS = 60 * 15; // 15 minutos
const PREFIX = "login_intentos:";

export async function registrarIntentoFallido(ip: string): Promise<void> {
    const key = `${PREFIX}${ip}`;
    const intentos = await redis.incr(key);
    if (intentos === 1) await redis.expire(key, VENTANA_SEGUNDOS);
}

export async function estaBloqueado(ip: string): Promise<boolean> {
    const intentos = await redis.get(`${PREFIX}${ip}`);
    return parseInt(intentos ?? "0") >= MAX_INTENTOS;
}

export async function limpiarIntentos(ip: string): Promise<void> {
    await redis.del(`${PREFIX}${ip}`);
}
