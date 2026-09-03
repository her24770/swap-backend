import { Request, Response, NextFunction } from "express";
import { ServicioJWT, PayloadToken } from "../autenticacion/ServicioJWT.js";
import { ServicioBcrypt } from "../autenticacion/ServicioBcrypt.js";
import { revocarToken } from "../autenticacion/blacklist.js";
import { registrarIntento, estaBloqueado, limpiarIntentos } from "../autenticacion/rateLimiter.js";
import {
    buscarUsuarioPorEmail,
    buscarUsuarioPorCarnet,
    buscarUsuarioPorId,
    guardarUsuario,
    actualizarUsuario,
} from "../repository/repositorioUsuario.js";
import { sincronizarEtiquetasUsuario, verificarEtiquetasExisten } from "../repository/repositorioEtiqueta.js";
import { errorResponse, exitoResponse } from "../servicios/Response.js";
import { construirUrlR2 } from "../servicios/servicioR2.js";
import redis from "../persistencia/redisClient.js";
import {
    construirClaveRecuperacionPassword,
    construirClaveVerificacionRegistro,
    generarCodigoVerificacion,
    TIEMPO_EXPIRACION_CODIGO_SEGUNDOS,
} from "../servicios/servicioCodigos.js";
import { enviarCodigoRecuperacion, enviarCodigoVerificacionRegistro } from "../servicios/servicioEmail.js";
import { interpretarEstadoCuenta } from "../servicios/servicioEstadoCuenta.js";

const MENSAJE_RECUPERACION = "Si el correo existe, recibirás un código.";

/**
 * POST /api/auth/registro
 * Crea un nuevo usuario en la base de datos.
 * Retorna 409 si el correo o carnet ya están registrados.
 */
export async function registro(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { codigo_verificacion, etiquetas = [], ...reqData } = req.body;
        reqData.email_institucional = reqData.email_institucional.toLowerCase();

        if (await estaBloqueado("verificar_codigo_registro", reqData.email_institucional)) {
            errorResponse(res, "Demasiados intentos. Solicita un nuevo código.", 429);
            return;
        }

        const claveCodigo = construirClaveVerificacionRegistro(reqData.email_institucional);
        const codigoGuardado = await redis.get(claveCodigo);
        if (!codigoGuardado || codigoGuardado !== codigo_verificacion) {
            await registrarIntento("verificar_codigo_registro", reqData.email_institucional);
            errorResponse(res, "Código de verificación inválido o expirado.", 400);
            return;
        }
        await limpiarIntentos("verificar_codigo_registro", reqData.email_institucional);

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

        if (etiquetas.length > 0) {
            const etiquetasValidas = await verificarEtiquetasExisten(etiquetas);
            if (!etiquetasValidas) {
                errorResponse(res, "Una o más etiquetas no existen en el sistema.", 400);
                return;
            }
        }

        // Hashear contraseña
        reqData.password = await ServicioBcrypt.hashearPassword(reqData.password);

        if (!reqData.url_foto_perfil) {
            reqData.url_foto_perfil = construirUrlR2("perfil", "default", "png");
        }

        // Guardar usuario
        const nuevoUsuario = await guardarUsuario(reqData);
        if (etiquetas.length > 0) {
            await sincronizarEtiquetasUsuario(nuevoUsuario.id_usuario, etiquetas);
        }
        await redis.del(claveCodigo);

        const payload: PayloadToken = {
            sub: String(nuevoUsuario.id_usuario),
            email: nuevoUsuario.email_institucional,
            rol: "usuario",
            ver: nuevoUsuario.sesion_version,
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

export async function solicitarCodigoRegistro(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const email = req.body.email_institucional.toLowerCase();
        const { carnet } = req.body;

        if (await estaBloqueado("solicitar_codigo_registro", email)) {
            errorResponse(res, "Demasiadas solicitudes. Intenta de nuevo más tarde.", 429);
            return;
        }

        const emailExistente = await buscarUsuarioPorEmail(email);
        if (emailExistente) {
            errorResponse(res, "El correo institucional ya está registrado.", 409);
            return;
        }

        const carnetExistente = await buscarUsuarioPorCarnet(carnet);
        if (carnetExistente) {
            errorResponse(res, "El carnet ya esta registrado", 409);
            return;
        }

        const code = generarCodigoVerificacion();
        await redis.set(construirClaveVerificacionRegistro(email), code, {
            EX: TIEMPO_EXPIRACION_CODIGO_SEGUNDOS,
        });
        await enviarCodigoVerificacionRegistro(email, code);
        await registrarIntento("solicitar_codigo_registro", email);

        exitoResponse(res, [], "Código de verificación enviado.", 200);
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

        if (await estaBloqueado("login", ip)) {
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
                await registrarIntento("login", ip);
                errorResponse(res, "Credenciales invalidas", 401);
                return;
            }

            await limpiarIntentos("login", ip);

            // Verificar estado de la cuenta (SWAP-422)
            const estadoCuenta = interpretarEstadoCuenta(usuario.tiempo_suspendido);
            if (estadoCuenta.bloqueada) {
                errorResponse(res, "Tu cuenta ha sido bloqueada. Contacta a un moderador.", 403);
                return;
            }
            if (estadoCuenta.suspendidaHasta) {
                errorResponse(
                    res,
                    `Tu cuenta está suspendida hasta ${estadoCuenta.suspendidaHasta.toLocaleString("es-GT")}.`,
                    403
                );
                return;
            }
            if (estadoCuenta.expirada) {
                await actualizarUsuario(usuario.id_usuario, { tiempo_suspendido: 0 });
            }

            // Generar token
            const payload: PayloadToken = {
                sub: String(usuario.id_usuario),
                email: usuario.email_institucional,
                rol: "usuario",
                ver: usuario.sesion_version,
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

export async function solicitarRecuperacionPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const email = req.body.email.toLowerCase();

        if (await estaBloqueado("solicitar_codigo_recuperacion", email)) {
            errorResponse(res, "Demasiadas solicitudes. Intenta de nuevo más tarde.", 429);
            return;
        }

        const usuario = await buscarUsuarioPorEmail(email);

        if (usuario) {
            const code = generarCodigoVerificacion();
            await redis.set(construirClaveRecuperacionPassword(email), code, {
                EX: TIEMPO_EXPIRACION_CODIGO_SEGUNDOS,
            });
            await enviarCodigoRecuperacion(email, code);
        }

        // Se registra el intento exista o no la cuenta, para no filtrar por timing/límite si el correo está registrado.
        await registrarIntento("solicitar_codigo_recuperacion", email);

        exitoResponse(res, [], MENSAJE_RECUPERACION, 200);
    } catch (error) {
        next(error);
    }
}

export async function verificarCodigoRecuperacion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const email = req.body.email.toLowerCase();
        const { code } = req.body;

        if (await estaBloqueado("verificar_codigo_recuperacion", email)) {
            errorResponse(res, "Demasiados intentos. Solicita un nuevo código.", 429);
            return;
        }

        const codigoGuardado = await redis.get(construirClaveRecuperacionPassword(email));

        if (!codigoGuardado || codigoGuardado !== code) {
            await registrarIntento("verificar_codigo_recuperacion", email);
            errorResponse(res, "Código inválido o expirado.", 400);
            return;
        }

        exitoResponse(res, [], "Código válido.", 200);
    } catch (error) {
        next(error);
    }
}

export async function restablecerPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const email = req.body.email.toLowerCase();
        const { code, newPassword } = req.body;

        if (await estaBloqueado("verificar_codigo_recuperacion", email)) {
            errorResponse(res, "Demasiados intentos. Solicita un nuevo código.", 429);
            return;
        }

        const claveCodigo = construirClaveRecuperacionPassword(email);
        const codigoGuardado = await redis.get(claveCodigo);

        if (!codigoGuardado || codigoGuardado !== code) {
            await registrarIntento("verificar_codigo_recuperacion", email);
            errorResponse(res, "Código inválido o expirado.", 400);
            return;
        }

        const usuario = await buscarUsuarioPorEmail(email);
        if (!usuario) {
            await redis.del(claveCodigo);
            errorResponse(res, "Código inválido o expirado.", 400);
            return;
        }

        const password = await ServicioBcrypt.hashearPassword(newPassword);
        // Password y versión cambian en la misma operación: nunca puede
        // quedar aplicada la contraseña nueva con sesiones antiguas válidas.
        await actualizarUsuario(usuario.id_usuario, {
            password,
            sesion_version: { increment: 1 },
        });
        await redis.del(claveCodigo);
        await limpiarIntentos("verificar_codigo_recuperacion", email);

        exitoResponse(res, [], "Contraseña actualizada correctamente.", 200);
    } catch (error) {
        next(error);
    }
}
