import { Request, Response, NextFunction } from "express";
import { ServicioJWT, PayloadToken } from "../autenticacion/ServicioJWT.js";
import { ServicioBcrypt } from "../autenticacion/ServicioBcrypt.js";
import {
    buscarUsuarioPorEmail,
    buscarUsuarioPorCarnet,
    guardarUsuario,
} from "../repository/repositorioUsuario.js";

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
            res.status(409).json({ message: "El correo institucional ya está registrado." });
            return;
        }

        // Verificar carnet duplicado
        const carnetExistente = await buscarUsuarioPorCarnet(reqData.carnet);
        if (carnetExistente) {
            res.status(409).json({ message: "El carnet ya está registrado." });
            return;
        }

        // Hashear contraseña
        const passwordHash = await ServicioBcrypt.hashearPassword(reqData.password);

        // Guardar usuario
        const nuevoUsuario = await guardarUsuario({
            nombre: reqData.nombre,
            carnet: reqData.carnet,
            email_institucional: reqData.email_institucional,
            password: passwordHash,
            url_foto_perfil: reqData.url_foto_perfil ?? "",
            descripcion: reqData.descripcion ?? null,
        });

        res.status(201).json({
            message: "Usuario creado exitosamente.",
            usuario: {
                id_usuario: nuevoUsuario.id_usuario,
                nombre: nuevoUsuario.nombre,
                carnet: nuevoUsuario.carnet,
                email_institucional: nuevoUsuario.email_institucional,
                url_foto_perfil: nuevoUsuario.url_foto_perfil,
                descripcion: nuevoUsuario.descripcion,
            },
        });
    } catch (error) {
        next(error);
    }
}

export async function iniciarSesion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const reqData = req.body;

        // Verificar email
        const usuario = await buscarUsuarioPorEmail(reqData.email_institucional);
        if (usuario) {
            // Verificar contraseña
            const esPasswordCorrecta = await ServicioBcrypt.compararPassword(reqData.password, usuario.password);
            if (!esPasswordCorrecta) {
                res.status(401).json({ message: "Credenciales inválidas." });
                return;
            }

            // Generar token
            const payload: PayloadToken = {
                sub: String(usuario.id_usuario),
                email: usuario.email_institucional,
                rol: "usuario",
            };
            const token = ServicioJWT.generarToken(payload);
            const { password: _, ...usuarioPublico } = usuario;

            res.status(200).json({
                token: token,
                rol: "usuario",
                usuario: usuarioPublico
            });
            return;
        }

        const moderador = ""; //Agregar parte de moderación
        if (moderador == "") {
            res.status(200).json({
                message: "Parte de moderación faltante"
            })
        }

        res.status(401).json({ message: "Credenciales inválidas." });
        return;
    } catch (error) {
        next(error);
    }
}