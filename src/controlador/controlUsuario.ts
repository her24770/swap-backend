import { Request, Response, NextFunction } from "express";
import {
    buscarUsuarioPorId,
    actualizarUsuario,
    guardarContacto,
    buscarContactosPorUsuario,
    actualizarContacto,
} from "../repository/repositorioUsuario";

/**
 * GET /api/usuarios/:id
 * Retorna la información pública de un usuario por su ID.
 */
export async function obtenerUsuario(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const id = Number(req.params.id);
        const usuario = await buscarUsuarioPorId(id);

        if (!usuario) {
            res.status(404).json({ message: "Usuario no encontrado." });
            return;
        }

        const { password: _, ...usuarioPublico } = usuario;
        res.json(usuarioPublico);
    } catch (error) {
        next(error);
    }
}

/**
 * PUT /api/usuarios/perfil
 * Actualiza los datos del perfil del usuario autenticado (vinculado por JWT).
 * Requiere middleware de autenticación que inyecte req.usuarioId.
 */
export async function actualizarPerfil(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        // El middleware de auth inyecta el id del usuario autenticado
        const idUsuario = (req as Request & { usuarioId: number }).usuarioId;

        const { nombre, url_foto_perfil, descripcion } = req.body;

        const usuarioExistente = await buscarUsuarioPorId(idUsuario);
        if (!usuarioExistente) {
            res.status(404).json({ message: "Usuario no encontrado." });
            return;
        }

        const usuarioActualizado = await actualizarUsuario(idUsuario, {
            ...(nombre && { nombre }),
            ...(url_foto_perfil && { url_foto_perfil }),
            ...(descripcion !== undefined && { descripcion }),
        });

        const { password: _, ...usuarioPublico } = usuarioActualizado;
        res.json({
            message: "Perfil actualizado correctamente.",
            usuario: usuarioPublico,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * POST /api/usuarios/perfil/contacto
 * Agrega un contacto al perfil del usuario autenticado.
 */
export async function agregarContacto(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const idUsuario = (req as Request & { usuarioId: number }).usuarioId;
        const { tipo_contacto, valor } = req.body;

        const contacto = await guardarContacto({
            valor,
            usuario: { connect: { id_usuario: idUsuario } },
            tipoContacto: { connect: { id_tipo_contacto: Number(tipo_contacto) } },
        });

        res.status(201).json({ message: "Contacto agregado.", contacto });
    } catch (error) {
        next(error);
    }
}

/**
 * GET /api/usuarios/:id/contactos
 * Retorna los contactos de un usuario.
 */
export async function obtenerContactos(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const idUsuario = Number(req.params.id);
        const contactos = await buscarContactosPorUsuario(idUsuario);
        res.json(contactos);
    } catch (error) {
        next(error);
    }
}