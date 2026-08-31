import redis from "../persistencia/redisClient.js";
import { Request, Response, NextFunction } from "express";

const MAX_INTENTOS = 5;
const VENTANA_SEGUNDOS = 60 * 15; // 15 minutos
const PREFIX = "login_intentos:";
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
