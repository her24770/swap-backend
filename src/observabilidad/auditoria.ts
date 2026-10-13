import { Request } from "express";
import { escribirLog } from "./logger.js";

export type ResultadoAuditoria = "success" | "failure" | "blocked";

interface EventoAuditoria {
    evento: string;
    resultado: ResultadoAuditoria;
    objetivoId?: string;
    motivo?: string;
    detalles?: Record<string, unknown>;
}

export function registrarAuditoria(req: Request, evento: EventoAuditoria): void {
    escribirLog(evento.resultado === "success" ? "info" : "warn", evento.evento, {
        audit: true,
        requestId: req.requestId,
        userId: req.auditUserId ?? req.usuario?.sub,
        userRole: req.usuario?.rol,
        ip: req.ip,
        method: req.method,
        route: req.originalUrl.split("?")[0],
        result: evento.resultado,
        targetId: evento.objetivoId,
        reason: evento.motivo,
        details: evento.detalles,
    });
}

function rutaSinVersion(req: Request): string {
    return req.originalUrl.split("?")[0].replace(/^\/api(?:\/v1)?/, "");
}

/** Devuelve el evento crítico asociado a una ruta mutante, si corresponde. */
export function catalogarEventoAuditoria(req: Request): string | undefined {
    const ruta = rutaSinVersion(req);
    const metodo = req.method.toUpperCase();

    if (metodo === "POST" && ruta === "/auth/login") return "auth.login";
    if (metodo === "POST" && ruta === "/moderador/login") return "auth.moderator_login";
    if (metodo === "POST" && ruta === "/auth/forgot-password") return "auth.password_recovery_requested";
    if (metodo === "POST" && ruta === "/auth/verify-reset-code") return "auth.password_recovery_code_checked";
    if (metodo === "POST" && ruta === "/auth/reset-password") return "auth.password_reset";

    if (metodo === "POST" && ruta === "/moderador") return "role.moderator_created";
    if (metodo === "PATCH" && /^\/moderador\/\d+$/.test(ruta)) return "role.moderator_changed";
    if (metodo === "DELETE" && /^\/moderador\/\d+$/.test(ruta)) return "role.moderator_deleted";

    if (["POST", "PUT", "PATCH", "DELETE"].includes(metodo) && ruta.startsWith("/acuerdo")) {
        return `agreement.${metodo.toLowerCase()}`;
    }

    if (["POST", "PUT", "PATCH", "DELETE"].includes(metodo)
        && (ruta.startsWith("/moderador/") || ruta.startsWith("/reportes"))) {
        return `moderation.${metodo.toLowerCase()}`;
    }

    return undefined;
}
