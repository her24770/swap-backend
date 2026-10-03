import redis from "../persistencia/redisClient.js";

const PREFIX = "blacklist:";

export async function revocarToken(token: string, ttlSegundos: number): Promise<void> {
    await redis.set(`${PREFIX}${token}`, "1", { EX: ttlSegundos });
}

export async function estaRevocado(token: string): Promise<boolean> {
    const val = await redis.get(`${PREFIX}${token}`);
    return val !== null;
}
