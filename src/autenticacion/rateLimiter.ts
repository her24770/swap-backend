import redis from "../persistencia/redisClient.js";
import { Request, Response, NextFunction } from "express";

const MENSAJE_LIMITE = "Demasiadas solicitudes. Intenta nuevamente más tarde.";
export const MENSAJE_RATE_LIMITER_NO_DISPONIBLE =
    "Servicio de control de solicitudes temporalmente no disponible. Intenta nuevamente más tarde.";

export class RateLimiterNoDisponibleError extends Error {
    readonly cause?: unknown;

    constructor(cause?: unknown) {
        super(MENSAJE_RATE_LIMITER_NO_DISPONIBLE);
        this.name = "RateLimiterNoDisponibleError";
        this.cause = cause;
    }
}

type Bucket =
    | "api_global"
    | "socket_evento"
    | "login"
    | "solicitar_codigo_registro"
    | "verificar_codigo_registro"
    | "solicitar_codigo_recuperacion"
    | "verificar_codigo_recuperacion";

const LIMITES: Record<Bucket, { maxIntentos: number; ventanaSegundos: number }> = {
    api_global: { maxIntentos: 120, ventanaSegundos: 60 },
    socket_evento: { maxIntentos: 60, ventanaSegundos: 60 },
    login: { maxIntentos: 5, ventanaSegundos: 60 * 15 },
    solicitar_codigo_registro: { maxIntentos: 3, ventanaSegundos: 60 * 15 },
    verificar_codigo_registro: { maxIntentos: 5, ventanaSegundos: 60 * 10 },
    solicitar_codigo_recuperacion: { maxIntentos: 3, ventanaSegundos: 60 * 15 },
    verificar_codigo_recuperacion: { maxIntentos: 5, ventanaSegundos: 60 * 10 },
};

const INCREMENTAR_CON_TTL = `
local intentos = redis.call("INCR", KEYS[1])
if intentos == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return intentos
`;

function construirClave(bucket: Bucket, identificador: string): string {
    return `rate:${bucket}:${identificador}`;
}

async function ejecutarRedis<T>(operacion: () => Promise<T>): Promise<T> {
    try {
        return await operacion();
    } catch (error) {
        throw new RateLimiterNoDisponibleError(error);
    }
}

/**
 * INCR y EXPIRE se ejecutan en un único script para que ninguna instancia
 * pueda dejar un contador sin TTL si termina entre ambas operaciones.
 */
async function incrementarContador(bucket: Bucket, identificador: string): Promise<number> {
    const resultado = await ejecutarRedis(() => redis.eval(INCREMENTAR_CON_TTL, {
        keys: [construirClave(bucket, identificador)],
        arguments: [String(LIMITES[bucket].ventanaSegundos)],
    }));
    return Number(resultado);
}

/**
 * Límite distribuido para todas las rutas HTTP. Ante una caída de Redis se
 * aplica fail-closed: no se ejecuta la ruta y se responde 503.
 */
export async function rateLimitGlobal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const intentos = await incrementarContador("api_global", req.ip || "desconocida");
        if (intentos > LIMITES.api_global.maxIntentos) {
            res.status(429).json({ success: false, message: MENSAJE_LIMITE });
            return;
        }
        next();
    } catch (error) {
        console.error("Rate limiter no disponible:", error);
        res.status(503).json({ success: false, message: MENSAJE_RATE_LIMITER_NO_DISPONIBLE });
    }
}

/**
 * Límite distribuido para eventos sensibles de Socket.IO. Los consumidores
 * deben rechazar el evento si esta función lanza RateLimiterNoDisponibleError.
 */
export async function permitirEventoSocket(idUsuario: number, evento: string): Promise<boolean> {
    const intentos = await incrementarContador("socket_evento", `${idUsuario}:${evento}`);
    return intentos <= LIMITES.socket_evento.maxIntentos;
}

/**
 * Conservado por compatibilidad con las suites existentes. Ya no elimina
 * contadores: al residir en Redis, estos sobreviven reinicios del proceso.
 */
export function reiniciarRateLimiters(): void {
    // Sin estado local que reiniciar.
}

/**
 * Identifica de forma estable los intentos de login contra una cuenta concreta.
 * El arreglo serializado evita ambigüedades entre los separadores de una IPv6
 * y los caracteres válidos del correo.
 */
export function construirIdentificadorLogin(ip: string, correoObjetivo: string): string {
    return JSON.stringify([ip, correoObjetivo.trim().toLowerCase()]);
}

export async function registrarIntento(bucket: Bucket, identificador: string): Promise<void> {
    await incrementarContador(bucket, identificador);
}

export async function estaBloqueado(bucket: Bucket, identificador: string): Promise<boolean> {
    const intentos = await ejecutarRedis(() => redis.get(construirClave(bucket, identificador)));
    return parseInt(intentos ?? "0") >= LIMITES[bucket].maxIntentos;
}

export async function limpiarIntentos(bucket: Bucket, identificador: string): Promise<void> {
    await ejecutarRedis(() => redis.del(construirClave(bucket, identificador)));
}
