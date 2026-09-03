import { Request, Response, NextFunction } from "express";
import {
    buscarUsuarioPorId,
    buscarPerfilPublicoPorId,
    actualizarUsuario,
    guardarContacto,
    buscarContactosPorUsuario,
    eliminarContacto
} from "../repository/repositorioUsuario";
import { exitoResponse, errorResponse } from "../servicios/Response";
import { buscarTutoresPorFiltros } from "../repository/repositorioTutoria";

/**
 * GET /api/user/:id
 * Retorna la información pública de un usuario por su ID.
 */
export async function obtenerUsuario(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const id = Number(req.params.id);
        // Fix BG-17: antes regresaba la fila completa de Usuario (carnet,
        // email_institucional, reportes_recibidos, etc.) a cualquier usuario
        // autenticado que consultara el id de otro. Usa el mismo DTO seguro
        // que perfil-publico.
        const usuario = await buscarPerfilPublicoPorId(id);

        if (!usuario) {
            errorResponse(res, "Usuario no encontrado", 404);
            return;
        }

        exitoResponse(res, usuario, "Usuario obtenido exitosamente", 200);
    } catch (error) {
        next(error);
    }
}

/**
 * GET /api/user/:id/perfil-publico
 * Retorna la información pública de un usuario sin exponer credenciales.
 */
export async function obtenerPerfilPublico(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const id = Number(req.params.id);

        if (isNaN(id)) {
            errorResponse(res, "ID de usuario inválido", 400);
            return;
        }

        const usuario = await buscarPerfilPublicoPorId(id);

        if (!usuario) {
            errorResponse(res, "Usuario no encontrado", 404);
            return;
        }

        const usuarioFormateado = {
            ...usuario,
            calificacion: usuario.calificacion ? Number(usuario.calificacion) : 0
        };

        exitoResponse(res, usuarioFormateado, "Perfil público obtenido exitosamente", 200);
    } catch (error) {
        next(error);
    }
}

/**
 * PATCH /api/user/:id
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
        /*const idUsuario = (req as Request & { usuarioId: number }).usuarioId; */
        const idUsuario = Number(req.params.id);

        const data = req.body;

        const usuarioExistente = await buscarUsuarioPorId(idUsuario);
        if (!usuarioExistente) {
            errorResponse(res, "Usuario no encontrado", 404);
            return;
        }

        const usuarioActualizado = await actualizarUsuario(idUsuario, {
            ...(data.nombre && { nombre: data.nombre }),
            ...(data.url_foto_perfil && { url_foto_perfil: data.url_foto_perfil }),
            ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
        });

        const { password: _, ...usuarioPublico } = usuarioActualizado;
        exitoResponse(res, usuarioPublico, "Perfil actualizado correctamente", 200);
    } catch (error) {
        next(error);
    }
}

/**
 * PUT /api/user/:id/contactos
 * Agrega un contacto al perfil del usuario autenticado.
 */
export async function agregarContacto(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        /*Middleware
        const idUsuario = (req as Request & { usuarioId: number }).usuarioId;
        */
        const idUsuario = Number(req.params.id);

        if (isNaN(idUsuario)) {
            errorResponse(res, "ID de usuario inválido", 400);
            return;
        }

        const { contactos } = req.body;

        if (!contactos || !Array.isArray(contactos)) {
            errorResponse(res, "Se requiere uno o más contactos", 400);
            return;
        }

        if (contactos.length > 4) {
            errorResponse(res, "No se pueden agregar más de 4 contactos", 400);
            return;
        }

        const tiposVistos = new Set();
        for (const contacto of contactos) {
            if (!contacto.tipo_contacto || !contacto.valor) {
                errorResponse(res, "Cada contacto debe tener un tipo y un valor", 400);
                return;
            }
            if (tiposVistos.has(contacto.tipo_contacto)) {
                errorResponse(res, "No se pueden repetir tipos de contacto", 400);
                return;
            }
            tiposVistos.add(contacto.tipo_contacto);
        }   



        const usuarioExistente = await buscarUsuarioPorId(idUsuario);
        if (!usuarioExistente) {
            errorResponse(res, "Usuario no encontrado", 404);
            return;
        }


        await eliminarContacto(idUsuario);

        if (contactos.length > 0) {
            const prepararContacto = (contacto: any) => ({
                valor: contacto.valor,
                usuario: { connect: { id_usuario: idUsuario } },
                tipoContacto: { connect: { id_tipo_contacto: Number(contacto.tipo_contacto) } }
            });
        
        
            const datosContactos = contactos.map(prepararContacto);
            const resultado = await guardarContacto(datosContactos);

            exitoResponse(res, resultado, "Contactos actualizados correctamente", 201);
        } else {
            exitoResponse(res, [], "Todos los contactos han sido eliminados", 200);
        }

    } catch (error) {
        next(error);
    }
}

/**
 * GET /api/user/:id/contactos
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
        if (contactos.length === 0) {
            errorResponse(res, "No se encontraron contactos", 404);
            return;
        }
        exitoResponse(res, contactos, "Contactos obtenidos exitosamente", 200);
    } catch (error) {
        next(error);
    }
}


export async function obtenerTutoresPorFiltros(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {

    try {

        const options = req.body;

        const tutores =
            await buscarTutoresPorFiltros(options);

        if (!tutores || tutores.length === 0) {

            errorResponse(
                res,
                "No se encontraron tutores que coincidan con los filtros",
                404
            );

            return;
        }

        exitoResponse(
            res,
            {
                tutores,
                total: tutores.length,
                page: options.page,
                limit: options.limit
            },
            "Tutores obtenidos exitosamente",
            200
        );

    } catch (error) {

        next(error);
    }
}