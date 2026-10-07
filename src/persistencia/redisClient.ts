import { createClient, RedisClientType } from "redis";

const timeoutConfigurado = Number.parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS ?? "5000", 10);
const connectTimeout = Number.isFinite(timeoutConfigurado) && timeoutConfigurado > 0
    ? timeoutConfigurado
    : 5000;

const client: RedisClientType = createClient({
    url: process.env.REDIS_URL,
    // El rate limiter usa una política fail-closed. No se encolan comandos
    // mientras Redis está desconectado: fallan y la API puede responder 503.
    disableOfflineQueue: true,
    socket: { connectTimeout },
}) as RedisClientType;

client.on("error", (err) => console.error("Redis error:", err));

export async function conectarRedis(): Promise<void> {
    if (!client.isOpen) await client.connect();
}

export default client;
