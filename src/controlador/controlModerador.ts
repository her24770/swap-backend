import { Request, Response, NextFunction } from "express";
import { ServicioJWT, PayloadToken } from "../autenticacion/ServicioJWT.js";
import { ServicioBcrypt } from "../autenticacion/ServicioBcrypt.js";
import { registrarIntentoFallido, estaBloqueado, limpiarIntentos } from "../autenticacion/rateLimiter.js";
import { buscarModeradorPorUsuario, buscarModeradorPorId } from "../repository/repositorioModerador.js";
import { errorResponse, exitoResponse } from "../servicios/Response.js";

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

        if (await estaBloqueado(ip)) {
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
            await registrarIntentoFallido(ip);
            errorResponse(res, "Credenciales invalidas", 401);
            return;
        }

        await limpiarIntentos(ip);

        const nivel = moderador.tipoRel.tipo_moderador;

        const payload: PayloadToken = {
            sub: String(moderador.id_moderador),
            email: moderador.usuario,
            rol: nivel,
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
