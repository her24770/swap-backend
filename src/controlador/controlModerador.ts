import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { ServicioJWT, PayloadToken } from "../autenticacion/ServicioJWT.js";
import { ServicioBcrypt } from "../autenticacion/ServicioBcrypt.js";
import { registrarIntento, estaBloqueado, limpiarIntentos } from "../autenticacion/rateLimiter.js";
import {
    buscarModeradorPorUsuario,
    buscarModeradorPorId,
    buscarTodosLosModeradores,
    guardarModerador,
    actualizarModerador,
    eliminarModerador,
    contarModeradoresPorTipo,
} from "../repository/repositorioModerador.js";
import { obtenerTipoModeradorPorNombre } from "../repository/repositorioTipoModerador.js";
import { errorResponse, exitoResponse } from "../servicios/Response.js";
import { interpretarEstadoCuenta } from "../servicios/servicioEstadoCuenta.js";

function moderadorPublico(moderador: { id_moderador: number; usuario: string; tipoRel: { tipo_moderador: string } }) {
    return {
        id_moderador: moderador.id_moderador,
        usuario: moderador.usuario,
        nivel: moderador.tipoRel.tipo_moderador,
    };
}

/*
    POST /api/moderador/login
    Login separado del de Usuario: la tabla Moderador es independiente
    (usuario + password propios, sin email_institucional). Reutiliza el
    mismo mecanismo de cookie/JWT que iniciarSesion (controlAuth.ts) para
    que autenticar() y los middlewares de permisos (permisosModerador.ts)
    funcionen sin cambios. El rol del JWT es dinamico segun el nivel del
    moderador (tipoRel.tipo_moderador: "moderador" o "superadmin").
*/
export async function iniciarSesionModerador(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const ip = req.ip ?? "unknown";

        if (await estaBloqueado("login", ip)) {
            errorResponse(res, "Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.", 429);
            return;
        }

        const { usuario: nombreUsuario, password } = req.body;

        const moderador = await buscarModeradorPorUsuario(nombreUsuario);
        if (!moderador) {
            errorResponse(res, "Credenciales invalidas", 401);
            return;
        }

        const esPasswordCorrecta = await ServicioBcrypt.compararPassword(password, moderador.password);
        if (!esPasswordCorrecta) {
            await registrarIntento("login", ip);
            errorResponse(res, "Credenciales invalidas", 401);
            return;
        }

        await limpiarIntentos("login", ip);

        // Verificar estado de la cuenta (SWAP-422, generalizado a Moderador)
        const estadoCuenta = interpretarEstadoCuenta(moderador.tiempo_suspendido);
        if (estadoCuenta.bloqueada) {
            errorResponse(res, "Tu cuenta de moderador ha sido bloqueada.", 403);
            return;
        }
        if (estadoCuenta.suspendidaHasta) {
            errorResponse(
                res,
                `Tu cuenta de moderador está suspendida hasta ${estadoCuenta.suspendidaHasta.toLocaleString("es-GT")}.`,
                403
            );
            return;
        }
        if (estadoCuenta.expirada) {
            await actualizarModerador(moderador.id_moderador, { tiempo_suspendido: 0 });
        }

        const nivel = moderador.tipoRel.tipo_moderador;

        const payload: PayloadToken = {
            sub: String(moderador.id_moderador),
            email: moderador.usuario,
            rol: nivel,
            ver: moderador.sesion_version,
        };
        const token = ServicioJWT.generarToken(payload);

        res.cookie("swap-token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 8, // 8h igual que JWT_EXPIRACION
        });

        exitoResponse(
            res,
            { rol: nivel, moderador: { id_moderador: moderador.id_moderador, usuario: moderador.usuario, nivel } },
            "Inicio de sesion exitoso",
            200
        );
    } catch (error) {
        next(error);
    }
}

/*
    GET /api/moderador/me
    Endpoint minimo protegido (autenticar + soloModerador de permisosModerador.ts)
    para que el frontend pueda verificar la sesion antes de renderizar el panel.
*/
export async function obtenerSesionModeradorActual(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idModerador = Number(req.usuario?.sub);

        if (!idModerador) {
            errorResponse(res, "Moderador no autenticado", 401);
            return;
        }

        const moderador = await buscarModeradorPorId(idModerador);
        if (!moderador) {
            errorResponse(res, "Moderador no encontrado", 404);
            return;
        }

        const nivel = moderador.tipoRel.tipo_moderador;

        exitoResponse(
            res,
            { rol: nivel, moderador: { id_moderador: moderador.id_moderador, usuario: moderador.usuario, nivel } },
            "Sesion obtenida exitosamente",
            200
        );
    } catch (error) {
        next(error);
    }
}

/*
    POST /api/moderador
    Solo superadmin (soloSuperadmin en las rutas). Crea una cuenta de
    moderador nueva con el nivel indicado.
*/
export async function crearModerador(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { usuario, password, nivel } = req.body;

        const existente = await buscarModeradorPorUsuario(usuario);
        if (existente) {
            errorResponse(res, "Ya existe un moderador con ese usuario.", 409);
            return;
        }

        const tipoModerador = await obtenerTipoModeradorPorNombre(nivel);
        if (!tipoModerador) {
            errorResponse(res, "El nivel indicado no es valido.", 400);
            return;
        }

        const passwordHasheada = await ServicioBcrypt.hashearPassword(password);

        const moderador = await guardarModerador({
            usuario,
            password: passwordHasheada,
            tipoRel: { connect: { id_tipo_moderador: tipoModerador.id_tipo_moderador } },
        });

        exitoResponse(res, moderadorPublico(moderador), "Moderador creado exitosamente", 201);
    } catch (error) {
        next(error);
    }
}

/*
    GET /api/moderador
    Solo superadmin. Lista todos los moderadores para el panel.
*/
export async function listarModeradores(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const moderadores = await buscarTodosLosModeradores();
        exitoResponse(res, moderadores.map(moderadorPublico), "Moderadores obtenidos exitosamente", 200);
    } catch (error) {
        next(error);
    }
}

/*
    PATCH /api/moderador/:id
    Solo superadmin. Permite cambiar el nivel y/o resetear la contraseña
    de un moderador existente. No deja bajar de nivel al ultimo superadmin
    del sistema (quedaria nadie con acceso a esta seccion).
*/
export async function editarModerador(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            errorResponse(res, "El id del moderador no es valido.", 400);
            return;
        }

        const moderador = await buscarModeradorPorId(id);
        if (!moderador) {
            errorResponse(res, "Moderador no encontrado", 404);
            return;
        }

        const { nivel, password } = req.body;
        const data: Record<string, unknown> = {};

        if (nivel !== undefined) {
            const esUltimoSuperadmin =
                moderador.tipoRel.tipo_moderador === "superadmin" &&
                nivel !== "superadmin" &&
                (await contarModeradoresPorTipo(moderador.id_tipo_moderador)) <= 1;

            if (esUltimoSuperadmin) {
                errorResponse(res, "No podes quitarle el nivel de superadmin al ultimo superadmin del sistema.", 400);
                return;
            }

            const tipoModerador = await obtenerTipoModeradorPorNombre(nivel);
            if (!tipoModerador) {
                errorResponse(res, "El nivel indicado no es valido.", 400);
                return;
            }
            data.tipoRel = { connect: { id_tipo_moderador: tipoModerador.id_tipo_moderador } };
        }

        if (password !== undefined) {
            data.password = await ServicioBcrypt.hashearPassword(password);
        }

        // Fix BG-04: un cambio de nivel o de password no debe dejar viva
        // una sesión ya emitida. Se incrementa dentro del mismo UPDATE para
        // que el cambio crítico y la invalidación sean atómicos.
        if (nivel !== undefined || password !== undefined) {
            data.sesion_version = { increment: 1 };
        }

        const moderadorActualizado = await actualizarModerador(id, data);

        exitoResponse(res, moderadorPublico(moderadorActualizado), "Moderador actualizado exitosamente", 200);
    } catch (error) {
        next(error);
    }
}

/*
    DELETE /api/moderador/:id
    Solo superadmin. No permite auto-eliminarse ni eliminar al ultimo
    superadmin del sistema.
*/
export async function eliminarModeradorController(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            errorResponse(res, "El id del moderador no es valido.", 400);
            return;
        }

        if (id === Number(req.usuario?.sub)) {
            errorResponse(res, "No podes eliminar tu propia cuenta de moderador.", 400);
            return;
        }

        const moderador = await buscarModeradorPorId(id);
        if (!moderador) {
            errorResponse(res, "Moderador no encontrado", 404);
            return;
        }

        if (
            moderador.tipoRel.tipo_moderador === "superadmin" &&
            (await contarModeradoresPorTipo(moderador.id_tipo_moderador)) <= 1
        ) {
            errorResponse(res, "No podes eliminar al ultimo superadmin del sistema.", 400);
            return;
        }

        await eliminarModerador(id);
        exitoResponse(res, [], "Moderador eliminado exitosamente", 200);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
            errorResponse(res, "No se puede eliminar: el moderador tiene reportes asociados.", 409);
            return;
        }
        next(error);
    }
}
