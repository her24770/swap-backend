import { Request, Response, NextFunction } from "express";
import { buscarUsuarioPorId, actualizarUsuario } from "../repository/repositorioUsuario.js";
import {
    buscarModeradorPorId,
    actualizarModerador,
    contarModeradoresPorTipo,
} from "../repository/repositorioModerador.js";
import { obtenerJustificanteModeracion, notificarAccionModeracion } from "../servicios/servicioModeracion.js";
import { calcularTiempoSuspendido, AccionEstadoCuenta } from "../servicios/servicioEstadoCuenta.js";
import { errorResponse, exitoResponse } from "../servicios/Response.js";

const ACCIONES_VALIDAS: AccionEstadoCuenta[] = ["bloquear", "suspender", "reactivar"];

function validarAccion(body: unknown): AccionEstadoCuenta | null {
    if (!body || typeof body !== "object") return null;
    const { accion } = body as { accion?: unknown };
    if (typeof accion !== "string" || !ACCIONES_VALIDAS.includes(accion as AccionEstadoCuenta)) return null;
    return accion as AccionEstadoCuenta;
}

function mensajeParaAccion(accion: AccionEstadoCuenta): string {
    if (accion === "bloquear") return "bloqueada";
    if (accion === "suspender") return "suspendida";
    return "reactivada";
}

/*
    PATCH /api/moderador/usuarios/:id/estado
    Cualquier moderador (soloModerador). Bloquea, suspende o reactiva la
    cuenta de un Usuario (estudiante). Sigue el mismo patron de justificante
    + notificacion que ya usa la moderacion de publicaciones.
*/
export async function cambiarEstadoUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.params.id);
        if (isNaN(idUsuario)) {
            errorResponse(res, "El ID del usuario no es valido", 400);
            return;
        }

        const accion = validarAccion(req.body);
        if (!accion) {
            errorResponse(res, "La accion debe ser 'bloquear', 'suspender' o 'reactivar'", 400);
            return;
        }

        const justificante = obtenerJustificanteModeracion(req.body);
        if (!justificante) {
            errorResponse(res, "Debes indicar un motivo para esta accion", 400);
            return;
        }

        const usuario = await buscarUsuarioPorId(idUsuario);
        if (!usuario) {
            errorResponse(res, "Usuario no encontrado", 404);
            return;
        }

        const dias = typeof (req.body as { dias?: unknown }).dias === "number"
            ? (req.body as { dias: number }).dias
            : undefined;

        let tiempoSuspendido: number;
        try {
            tiempoSuspendido = calcularTiempoSuspendido(accion, dias);
        } catch (error) {
            errorResponse(res, (error as Error).message, 400);
            return;
        }

        // El estado y la invalidación se escriben atómicamente para que un
        // fallo intermedio no deje sesiones vigentes en una cuenta bloqueada.
        await actualizarUsuario(idUsuario, {
            tiempo_suspendido: tiempoSuspendido,
            sesion_version: { increment: 1 },
        });

        const detalle = justificante.detalle ? ` Detalle: ${justificante.detalle}` : "";
        await notificarAccionModeracion(
            idUsuario,
            `Tu cuenta fue ${mensajeParaAccion(accion)} por un moderador. Motivo: ${justificante.motivo}.${detalle}`
        );

        exitoResponse(
            res,
            { id_usuario: idUsuario, accion, tiempo_suspendido: tiempoSuspendido },
            "Estado de la cuenta actualizado exitosamente",
            200
        );
    } catch (error) {
        next(error);
    }
}

/*
    PATCH /api/moderador/:id/estado
    Solo superadmin. Bloquea, suspende o reactiva la cuenta de OTRO
    moderador. No permite actuar sobre uno mismo ni dejar al sistema sin
    ningun superadmin activo (mismas protecciones que editarModerador/
    eliminarModeradorController en controlModerador.ts).
*/
export async function cambiarEstadoModerador(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idModerador = Number(req.params.id);
        if (isNaN(idModerador)) {
            errorResponse(res, "El ID del moderador no es valido", 400);
            return;
        }

        const accion = validarAccion(req.body);
        if (!accion) {
            errorResponse(res, "La accion debe ser 'bloquear', 'suspender' o 'reactivar'", 400);
            return;
        }

        const justificante = obtenerJustificanteModeracion(req.body);
        if (!justificante) {
            errorResponse(res, "Debes indicar un motivo para esta accion", 400);
            return;
        }

        if (idModerador === Number(req.usuario?.sub)) {
            errorResponse(res, "No podes cambiar el estado de tu propia cuenta", 400);
            return;
        }

        const moderador = await buscarModeradorPorId(idModerador);
        if (!moderador) {
            errorResponse(res, "Moderador no encontrado", 404);
            return;
        }

        if (
            accion !== "reactivar" &&
            moderador.tipoRel.tipo_moderador === "superadmin" &&
            (await contarModeradoresPorTipo(moderador.id_tipo_moderador)) <= 1
        ) {
            errorResponse(res, "No podes bloquear/suspender al ultimo superadmin del sistema", 400);
            return;
        }

        const dias = typeof (req.body as { dias?: unknown }).dias === "number"
            ? (req.body as { dias: number }).dias
            : undefined;

        let tiempoSuspendido: number;
        try {
            tiempoSuspendido = calcularTiempoSuspendido(accion, dias);
        } catch (error) {
            errorResponse(res, (error as Error).message, 400);
            return;
        }

        await actualizarModerador(idModerador, {
            tiempo_suspendido: tiempoSuspendido,
            sesion_version: { increment: 1 },
        });

        exitoResponse(
            res,
            { id_moderador: idModerador, accion, tiempo_suspendido: tiempoSuspendido },
            "Estado del moderador actualizado exitosamente",
            200
        );
    } catch (error) {
        next(error);
    }
}

/*
    POST /api/moderador/usuarios/:id/advertencia
    Cualquier moderador (soloModerador). Crea una notificacion de advertencia
    para un Usuario, reutilizando el mismo justificante + notificacion que
    el resto de acciones de moderacion (SWAP-416).
*/
export async function crearAdvertenciaUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.params.id);
        if (isNaN(idUsuario)) {
            errorResponse(res, "El ID del usuario no es valido", 400);
            return;
        }

        const justificante = obtenerJustificanteModeracion(req.body);
        if (!justificante) {
            errorResponse(res, "Debes indicar un motivo para la advertencia", 400);
            return;
        }

        const usuario = await buscarUsuarioPorId(idUsuario);
        if (!usuario) {
            errorResponse(res, "Usuario no encontrado", 404);
            return;
        }

        const detalle = justificante.detalle ? ` Detalle: ${justificante.detalle}` : "";
        await notificarAccionModeracion(
            idUsuario,
            `Recibiste una advertencia de un moderador. Motivo: ${justificante.motivo}.${detalle}`
        );

        exitoResponse(res, { id_usuario: idUsuario }, "Advertencia enviada exitosamente", 200);
    } catch (error) {
        next(error);
    }
}
