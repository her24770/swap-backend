import { randomUUID } from "node:crypto";
import { NextFunction, Request, Response } from "express";
import type { Logger } from "pino";
import { catalogarEventoAuditoria, registrarAuditoria, type ResultadoAuditoria } from "./auditoria.js";
import { escribirLog, logger } from "./logger.js";

declare global {
    namespace Express {
        interface Request {
            requestId: string;
            log: Logger;
            auditUserId?: string;
        }
    }
}

function obtenerRequestId(req: Request): string {
    const recibido = req.get("x-request-id");
    if (recibido && /^[A-Za-z0-9._:-]{1,128}$/.test(recibido)) return recibido;
    return randomUUID();
}

function resultadoHttp(status: number): ResultadoAuditoria {
    if (status === 429 || status === 403) return "blocked";
    return status >= 400 ? "failure" : "success";
}

export function observabilidadHttp(req: Request, res: Response, next: NextFunction): void {
    const inicio = process.hrtime.bigint();
    req.requestId = obtenerRequestId(req);
    req.log = logger.child({ requestId: req.requestId });
    res.setHeader("X-Request-ID", req.requestId);

    res.once("finish", () => {
        const duracionMs = Number(process.hrtime.bigint() - inicio) / 1_000_000;
        const resultado = resultadoHttp(res.statusCode);
        const nivel = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
        const ruta = req.originalUrl.split("?")[0];

        escribirLog(nivel, "http.request_completed", {
            requestId: req.requestId,
            userId: req.auditUserId ?? req.usuario?.sub,
            userRole: req.usuario?.rol,
            ip: req.ip,
            method: req.method,
            route: ruta,
            statusCode: res.statusCode,
            result: resultado,
            durationMs: Number(duracionMs.toFixed(2)),
        });

        const eventoAuditoria = catalogarEventoAuditoria(req);
        if (eventoAuditoria) {
            const parametroId = req.params.id;
            const objetivoEnRuta = ruta.match(/\/(\d+)(?:\/|$)/)?.[1];
            registrarAuditoria(req, {
                evento: eventoAuditoria,
                resultado,
                objetivoId: (Array.isArray(parametroId) ? parametroId[0] : parametroId) ?? objetivoEnRuta,
                motivo: res.statusCode >= 400 ? `http_${res.statusCode}` : undefined,
            });
        }

        if (res.statusCode === 429) {
            escribirLog("warn", "security.rate_limit.blocked", {
                requestId: req.requestId,
                userId: req.auditUserId ?? req.usuario?.sub,
                ip: req.ip,
                method: req.method,
                route: ruta,
                result: "blocked",
            });
        }
    });

    next();
}
