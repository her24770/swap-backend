import { Request, Response, NextFunction } from "express";
import { ServicioJWT, PayloadToken } from "../autenticacion/ServicioJWT.js";
import { ServicioBcrypt } from "../autenticacion/ServicioBcrypt.js";
import { revocarToken } from "../autenticacion/blacklist.js";
import { registrarIntentoFallido, estaBloqueado, limpiarIntentos } from "../autenticacion/rateLimiter.js";
import {
    buscarUsuarioPorEmail,
    buscarUsuarioPorCarnet,
    buscarUsuarioPorId,
    guardarUsuario,
} from "../repository/repositorioUsuario.js";
import { errorResponse, exitoResponse } from "../servicios/Response.js";
import { construirUrlR2 } from "../servicios/servicioR2.js";

/**
 * POST /api/auth/registro
 * Crea un nuevo usuario en la base de datos.
 * Retorna 409 si el correo o carnet ya están registrados.
 */
export async function registro(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const reqData = req.body;

        // Verificar email duplicado
        const emailExistente = await buscarUsuarioPorEmail(reqData.email_institucional);
        if (emailExistente) {
            errorResponse(res, "El correo institucional ya está registrado.", 409);
            return;
        }

        // Verificar carnet duplicado
        const carnetExistente = await buscarUsuarioPorCarnet(reqData.carnet);
        if (carnetExistente) {
            errorResponse(res, "El carnet ya esta registrado", 409);
            return;
        }

        // Hashear contraseña
        reqData.password = await ServicioBcrypt.hashearPassword(reqData.password);

        if (!reqData.url_foto_perfil) {
            reqData.url_foto_perfil = construirUrlR2("perfil", "default", "png");
        }

        // Guardar usuario
        const nuevoUsuario = await guardarUsuario(reqData);

        const payload: PayloadToken = {
            sub: String(nuevoUsuario.id_usuario),
            email: nuevoUsuario.email_institucional,
            rol: "usuario",
        };
        const token = ServicioJWT.generarToken(payload);
        const { password: _, ...usuarioPublico } = nuevoUsuario;

        res.cookie("swap-token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 8,
        });

        exitoResponse(res, { rol: "usuario", usuario: usuarioPublico }, "Usuario creado exitosamente", 201);
    } catch (error) {
        next(error);
    }
}

export async function cerrarSesion(req: Request, res: Response): Promise<void> {
    const token = req.cookies?.["swap-token"];
    if (token) {
        try {
            const payload = ServicioJWT.verificarToken(token);
            const ttl = (payload.exp ?? 0) - Math.floor(Date.now() / 1000);
            if (ttl > 0) await revocarToken(token, ttl);
        } catch {
            // token ya expirado, no hace falta revocar
        }
    }
    res.clearCookie("swap-token", { httpOnly: true, sameSite: "lax" });
    exitoResponse(res, [], "Sesion cerrada exitosamente", 200);
}

export async function iniciarSesion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const ip = req.ip ?? "unknown";

        if (await estaBloqueado(ip)) {
            errorResponse(res, "Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.", 429);
            return;
        }

        const reqData = req.body;

        // Verificar email
        const usuario = await buscarUsuarioPorEmail(reqData.email_institucional);
        if (usuario) {
            // Verificar contraseña
            const esPasswordCorrecta = await ServicioBcrypt.compararPassword(reqData.password, usuario.password);
            if (!esPasswordCorrecta) {
                await registrarIntentoFallido(ip);
                errorResponse(res, "Credenciales invalidas", 401);
                return;
            }

            await limpiarIntentos(ip);

            // Generar token
            const payload: PayloadToken = {
                sub: String(usuario.id_usuario),
                email: usuario.email_institucional,
                rol: "usuario",
            };
            const token = ServicioJWT.generarToken(payload);
            const { password: _, ...usuarioPublico } = usuario;

            res.cookie("swap-token", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                maxAge: 1000 * 60 * 60 * 8, // 8h igual que JWT_EXPIRACION
            });

            exitoResponse(res, { rol: "usuario", usuario: usuarioPublico }, "Inicio de sesion exitoso", 200);
            return;
        }

        errorResponse(res, "Credenciales invalidas", 401);
        return;
    } catch (error) {
        next(error);
    }
}

export async function obtenerSesionActual(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.usuario?.sub);

        if (!idUsuario) {
            errorResponse(res, "Usuario no autenticado", 401);
            return;
        }

        const usuario = await buscarUsuarioPorId(idUsuario);
        if (!usuario) {
            errorResponse(res, "Usuario no encontrado", 404);
            return;
        }

        const { password: _, ...usuarioPublico } = usuario;
        exitoResponse(res, { rol: req.usuario?.rol ?? "usuario", usuario: usuarioPublico }, "Sesión obtenida exitosamente", 200);
    } catch (error) {
        next(error);
    }
}
