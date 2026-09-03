import redis from "../persistencia/redisClient.js";
import { Request, Response, NextFunction } from "express";

// ─── Rate limiting global de API y de eventos de socket (en memoria) ─────────

const LIMITE_API_GLOBAL = 120;
const VENTANA_API_MS = 60_000;
const LIMITE_SOCKET_EVENTOS = 60;
const VENTANA_SOCKET_MS = 60_000;
const apiVentanas = new Map<string, { inicio: number; cantidad: number }>();
const socketVentanas = new Map<string, { inicio: number; cantidad: number }>();

function permitir(ventanas: Map<string, { inicio: number; cantidad: number }>, clave: string, limite: number, ventanaMs: number): boolean {
    const ahora = Date.now();
    const actual = ventanas.get(clave);
    if (!actual || ahora - actual.inicio >= ventanaMs) {
        ventanas.set(clave, { inicio: ahora, cantidad: 1 });
        return true;
    }
    if (actual.cantidad >= limite) return false;
    actual.cantidad += 1;
    return true;
}

export function rateLimitGlobal(req: Request, res: Response, next: NextFunction): void {
    if (!permitir(apiVentanas, req.ip || "desconocida", LIMITE_API_GLOBAL, VENTANA_API_MS)) {
        res.status(429).json({ success: false, message: "Demasiadas solicitudes. Intenta nuevamente más tarde." });
        return;
    }
    next();
}

export function permitirEventoSocket(idUsuario: number, evento: string): boolean {
    return permitir(socketVentanas, `${idUsuario}:${evento}`, LIMITE_SOCKET_EVENTOS, VENTANA_SOCKET_MS);
}

// ─── Rate limiting por identificador (login y códigos de verificación) — Redis ──

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
