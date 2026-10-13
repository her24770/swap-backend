import pino, { type DestinationStream } from "pino";

const CAMPOS_SENSIBLES = new Set([
    "authorization",
    "cookie",
    "set-cookie",
    "password",
    "newpassword",
    "token",
    "code",
    "codigo",
    "codigo_verificacion",
    "jwt",
    "secret",
    "apikey",
    "api_key",
]);

export type NivelLog = "debug" | "info" | "warn" | "error";
export type ObservadorLog = (evento: string, datos: Record<string, unknown>) => Promise<void>;

const observadores = new Set<ObservadorLog>();

function claveSensible(clave: string): boolean {
    const normalizada = clave.toLowerCase().replace(/-/g, "_");
    return CAMPOS_SENSIBLES.has(normalizada)
        || normalizada.includes("password")
        || normalizada.includes("token")
        || normalizada.startsWith("codigo");
}

/** Redacta por nombre de campo sin mutar el objeto recibido. */
export function sanitizarDatos(valor: unknown, visitados = new WeakSet<object>()): unknown {
    if (valor === null || typeof valor !== "object") return valor;
    if (valor instanceof Date) return valor.toISOString();
    if (valor instanceof Error) {
        const codigo = "code" in valor && typeof valor.code === "string" ? valor.code : undefined;
        return { nombre: valor.name, codigo };
    }
    if (visitados.has(valor)) return "[CIRCULAR]";
    visitados.add(valor);

    if (Array.isArray(valor)) return valor.map((elemento) => sanitizarDatos(elemento, visitados));

    return Object.fromEntries(Object.entries(valor).map(([clave, contenido]) => [
        clave,
        claveSensible(clave) ? "[REDACTED]" : sanitizarDatos(contenido, visitados),
    ]));
}

export function crearLogger(destino?: DestinationStream) {
    return pino({
        level: process.env.LOG_LEVEL ?? "info",
        base: {
            service: "swap-backend",
            environment: process.env.NODE_ENV ?? "development",
        },
        timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
        redact: {
            paths: [
                "password", "newPassword", "token", "code", "codigo", "codigo_verificacion",
                "authorization", "cookie", "headers.authorization", "headers.cookie", "headers.set-cookie",
                "body.password", "body.newPassword", "body.token", "body.code", "body.codigo_verificacion",
                "details.password", "details.newPassword", "details.token", "details.code",
            ],
            censor: "[REDACTED]",
        },
        formatters: {
            level: (label) => ({ level: label }),
        },
    }, destino);
}

export const logger = crearLogger();

export function suscribirEventosLog(observador: ObservadorLog): () => void {
    observadores.add(observador);
    return () => observadores.delete(observador);
}

export function escribirLog(
    nivel: NivelLog,
    evento: string,
    datos: Record<string, unknown> = {},
    mensaje = evento,
): void {
    const datosSanitizados = sanitizarDatos({ event: evento, ...datos }) as Record<string, unknown>;
    logger[nivel](datosSanitizados, mensaje);
    for (const observador of observadores) {
        void observador(evento, datosSanitizados).catch(() => undefined);
    }
}
