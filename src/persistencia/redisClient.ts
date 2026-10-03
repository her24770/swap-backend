import { createClient, RedisClientType } from "redis";

const client: RedisClientType = createClient({
    url: process.env.REDIS_URL,
}) as RedisClientType;

client.on("error", (err) => console.error("Redis error:", err));

export async function conectarRedis(): Promise<void> {
    if (!client.isOpen) await client.connect();
}

export default client;
