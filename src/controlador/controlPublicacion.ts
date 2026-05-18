import { Request, Response, NextFunction } from "express";
import { buscarPublicacionesPorTipoYUsuario, buscarPublicacionesPaginadas, buscarPublicacionPorId, actualizarPublicacion, actualizarEstadoPublicacion, buscarPublicacionPorIdDetallado, buscarImagenesPorPublicacion, eliminarImagen } from "../repository/repositorioPublicacion.js";
import { obtenerTipoPerfilPorNombre } from "../repository/repositorioTipoPerfil.js";
import { buscarUsuarioPorId } from "../repository/repositorioUsuario.js";
import { subirImagenR2, eliminarImagenR2 } from "../servicios/servicioR2.js";
import { schemaCrearPublicacion, } from "../modelo/schemaPublicacion.js";
import { obtenerEstadoPorNombre } from "../repository/repositorioEstado.js";

export async function obtenerPublicacionesUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.params.id); //Id del usuario
        const tipo = req.query.tipo as string; //Tipo de publicacion
        const all = req.query.all === "true"; //Indicador para obtener todas las publicaciones o solo las activas
        const estado = all ? undefined : 'activo'; //Si all es true, se obtienen todas las publicaciones, si no, solo las activas

        if (isNaN(idUsuario)) {
            res.status(400).json({ error: "El id del usuario no es valido" });
            return;
        }
        if (!tipo) {
            res.status(400).json({ error: "El tipo de publicacion es requerido para obtener las publicaciones" });
            return;
        }

        const usuario = await buscarUsuarioPorId(idUsuario);
        if (!usuario) {
            res.status(404).json({ error: "El usuario no existe" });
            return;
        }

        const tipoPerfil = await obtenerTipoPerfilPorNombre(tipo);
        if (!tipoPerfil) {
            res.status(404).json({ error: "El tipo de publicacion no existe" });
            return;
        }

        const publicaciones = await buscarPublicacionesPorTipoYUsuario(tipo, idUsuario, estado);

        res.status(200).json({ message: "Publicaciones obtenidas exitosamente", data: publicaciones });
        return;
    } catch (error) {
        next(error);
    }
}

export async function obtenerTodasLasPublicaciones(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const page = Math.max(1, Number(req.query.page) || 1); //Pagina actual
        const limit = Math.min(100, Number(req.query.limit) || 10); //Cantidad de publicaciones por pagina
        const sort = req.query.sort as string || 'fecha'; //Ordenar por fecha, me_gusta o precio
        const order = req.query.order as string === 'asc' ? 'asc' : 'desc'; //Orden ascendente o descendente
        const tipo = req.query.tipo as string | undefined; //Tipo de publicacion
        const all = req.query.all === "true"; //Indicador para obtener todas las publicaciones o solo las activas
        const estado = all ? undefined : 'activo'; //Si all es true, se obtienen todas las publicaciones, si no, solo las activas

        const sortsValidos = ['fecha', 'me_gusta', 'precio'];
        if (sort && !sortsValidos.includes(sort)) {
            res.status(400).json({
                error: "El parámetro sort debe ser uno de los siguientes: fecha, me_gusta, precio"
            });
            return;
        }

        if (tipo) {
            const tipoPerfil = await obtenerTipoPerfilPorNombre(tipo);
            if (!tipoPerfil) {
                res.status(404).json({ error: "El tipo de publicacion no existe" });
                return;
            }
        }

        const resultado = await buscarPublicacionesPaginadas({
            page,
            limit,
            sort: sort as any,
            order,
            tipo,
            estado
        });

        if (!resultado || resultado.length == 0) {
            res.status(404).json({ error: "No se encontraron publicaciones" });
            return;
        }

        res.status(200).json({ message: "Publicaciones obtenidas exitosamente", data: resultado });
        return;
    } catch (error) {
        next(error);
    }
}

export async function obtenerPublicacionPorId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            res.status(400).json({ message: "El id de la publicacion no es valido" });
            return;
        }
        const publicacion = await buscarPublicacionPorIdDetallado(id);
        if (!publicacion) {
            res.status(404).json({ message: "Publicación no encontrada" });
            return;
        }

        res.status(200).json({ message: "Publicación obtenida exitosamente", data: publicacion });
        return;
    } catch (error) {
        next(error);
    }
}

export async function crearPublicacionConImagen(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        // Validar datos del body
        const bodyData = {
            titulo: req.body.titulo,
            descripcion: req.body.descripcion,
            precio: req.body.precio ? Number(req.body.precio) : 0,
            tipo_publicacion: req.body.tipo_publicacion,
            estado: req.body.estado ?? undefined,
            imagenes: []
        };

        const validacion = schemaCrearPublicacion.safeParse(bodyData);
        if (!validacion.success) {
            res.status(400).json({ error: validacion.error.errors });
            return;
        }

        // Obtener ID de usuario del token
        const idUsuario = Number(req.usuario?.sub);
        if (!idUsuario) {
            res.status(401).json({ error: "Usuario no autenticado" });
            return;
        }

        // Validar que exista el usuario
        const usuario = await buscarUsuarioPorId(idUsuario);
        if (!usuario) {
            res.status(404).json({ error: "Usuario no encontrado" });
            return;
        }

        // Obtener el tipo de perfil por nombre
        const tipoPerfil = await obtenerTipoPerfilPorNombre(validacion.data.tipo_publicacion);

        if (!tipoPerfil) {
            res.status(404).json({ error: "Tipo de publicación no encontrado" });
            return;
        }

        // Si hay imagen, subirla a R2
        let urlImagen: string | null = null;
        if (req.file) {
            try {
                urlImagen = await subirImagenR2(
                    req.file.buffer,
                    req.file.mimetype,
                    'publicaciones',
                    `post_temp_${Date.now()}`
                );
            } catch (error) {
                res.status(500).json({ error: "Error subiendo imagen a R2" });
                return;
            }
        }

        // Resolver estado texto → id_estado
        const nombreEstado = validacion.data.estado ?? "disponible";
        const estadoObj = await obtenerEstadoPorNombre(nombreEstado);
        if (!estadoObj) {
            res.status(400).json({ error: `Estado inválido: "${nombreEstado}".` });
            return;
        }
        const idEstado = estadoObj.id_estado;

        // Crear publicación
        const prisma = require("../persistencia/prismaClient.js").default;
        const publicacion = await prisma.publicacion.create({
            data: {
                titulo: validacion.data.titulo,
                descripcion: validacion.data.descripcion,
                precio: validacion.data.precio,
                tipo_publicacion: tipoPerfil.id_tipo_perfil,
                estado: idEstado,
                id_usuario: idUsuario,
                ...(urlImagen && {
                    imagenes: {
                        create: [{ url_imagen: urlImagen }]
                    }
                })
            }
        });

        res.status(201).json({
            message: "Publicación creada exitosamente",
            data: {
                id_publicacion: publicacion.id_publicacion,
                imagen_url: urlImagen
            }
        });
        return;
    } catch (error) {
        next(error);
    }
}

export async function agregarOActualizarImagen(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idPublicacion = Number(req.params.id);

        if (isNaN(idPublicacion)) {
            res.status(400).json({ error: "El ID de la publicación no es válido" });
            return;
        }

        // Validar que exista la publicación
        const publicacion = await buscarPublicacionPorId(idPublicacion);

        //Validar que el usuario sea el dueño de la publicación
        if (publicacion?.id_usuario !== Number(req.usuario?.sub)) {
            res.status(403).json({ error: "No tienes permiso para editar esta publicación" });
            return;
        }

        if (!publicacion) {
            res.status(404).json({ error: "Publicación no encontrada" });
            return;
        }

        // Validar que haya archivo
        if (!req.file) {
            res.status(400).json({ error: "No se proporcionó archivo de imagen" });
            return;
        }

        // Eliminar imágenes anteriores de R2 y BD
        const imagenesActuales = await buscarImagenesPorPublicacion(idPublicacion);
        for (const img of imagenesActuales) {
            try {
                await eliminarImagenR2(img.url_imagen);
            } catch {
                // Si falla la eliminación en R2 se continúa de todas formas
            }
            await eliminarImagen(img.id_imagen);
        }

        // Subir nueva imagen a R2
        let urlImagen: string;
        try {
            urlImagen = await subirImagenR2(
                req.file.buffer,
                req.file.mimetype,
                'publicaciones',
                `post_${idPublicacion}`
            );
        } catch (error) {
            res.status(500).json({ error: "Error subiendo imagen a R2" });
            return;
        }

        // Guardar nueva imagen en BD
        const prisma = require("../persistencia/prismaClient.js").default;
        const imagen = await prisma.imagenPublicacion.create({
            data: {
                url_imagen: urlImagen,
                id_publicacion: idPublicacion
            }
        });

        res.status(200).json({
            message: "Imagen actualizada en la publicación",
            data: {
                id_imagen: imagen.id_imagen,
                url_imagen: urlImagen
            }
        });
        return;
    } catch (error) {
        next(error);
    }
}

export async function editarPublicacion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id_publicacion = Number(req.params.id);
        const data = req.body;

        if (isNaN(id_publicacion)) {
            res.status(400).json({ error: "El ID de la publicacion no es válido." });
            return;
        }

        const publicacion = await buscarPublicacionPorId(id_publicacion);
        if (!publicacion) {
            res.status(404).json({ error: "Publicacion no encontrada." });
            return;
        }

        if (publicacion.id_usuario !== Number(req.usuario?.sub)) {
            res.status(403).json({
                error: "No tienes permiso para editar esta publicacion. Solo el propietario puede hacer cambios"
            });
            return;
        }

        const updateData: Record<string, unknown> = { ...data };

        // Resolver estado string → id_estado numérico
        if (data.estado !== undefined) {
            const estadoObj = await obtenerEstadoPorNombre(data.estado);
            if (!estadoObj) {
                res.status(400).json({ error: `Estado inválido: "${data.estado}".` });
                return;
            }
            updateData.estado = estadoObj.id_estado;
        }

        // Resolver tipo_publicacion string → id_tipo_perfil numérico
        if (data.tipo_publicacion !== undefined) {
            const tipoPerfil = await obtenerTipoPerfilPorNombre(data.tipo_publicacion);
            if (!tipoPerfil) {
                res.status(400).json({ error: `Tipo de publicación inválido: "${data.tipo_publicacion}".` });
                return;
            }
            updateData.tipo_publicacion = tipoPerfil.id_tipo_perfil;
        }

        // Extraer etiquetas antes de actualizar (se manejan como relación aparte)
        const etiquetasIds: number[] | undefined = data.etiquetas;
        delete updateData.etiquetas;

        const publicacionActualizada = await actualizarPublicacion(id_publicacion, updateData);

        // Actualizar etiquetas si se enviaron
        if (etiquetasIds !== undefined) {
            const prismaClient = require("../persistencia/prismaClient.js").default;
            await prismaClient.publicacionEtiqueta.deleteMany({ where: { id_publicacion } });
            if (etiquetasIds.length > 0) {
                await prismaClient.publicacionEtiqueta.createMany({
                    data: etiquetasIds.map((id_etiqueta: number) => ({ id_publicacion, id_etiqueta })),
                    skipDuplicates: true,
                });
            }
        }

        res.status(200).json({ message: "Publicacion actualizada exitosamente", data: publicacionActualizada });
        return;
    } catch (error) {
        next(error);
    }
}

export async function eliminarPublicacionConImagenes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const id_publicacion = Number(req.params.id);

        if (isNaN(id_publicacion)) {
            res.status(400).json({ error: "El ID de la publicación no es válido." });
            return;
        }

        const publicacion = await buscarPublicacionPorIdDetallado(id_publicacion);
        if (!publicacion) {
            res.status(404).json({ error: "Publicación no encontrada." });
            return;
        }

        if (publicacion.id_usuario !== Number(req.usuario?.sub)) {
            res.status(403).json({ error: "No tienes permiso para eliminar esta publicación." });
            return;
        }

        // Borrar imágenes de R2
        for (const img of publicacion.imagenes ?? []) {
            try {
                await eliminarImagenR2(img.url_imagen);
            } catch {
                // Si falla R2 se continúa para que la BD quede limpia
            }
        }

        const prisma = require("../persistencia/prismaClient.js").default;

        // Eliminar registros relacionados antes de borrar la publicación
        await prisma.imagenPublicacion.deleteMany({ where: { id_publicacion } });
        await prisma.publicacionEtiqueta.deleteMany({ where: { id_publicacion } });

        await prisma.publicacion.delete({ where: { id_publicacion } });

        res.status(200).json({ message: "Publicación eliminada exitosamente." });
        return;
    } catch (error) {
        next(error);
    }
}

export async function cambiarEstadoPublicacion(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const idPublicacion = Number(req.params.id);
        const { estado_id } = req.body; // El ID del nuevo estado
        //Validar ID de publicación
        if (isNaN(idPublicacion)) {
            res.status(400).json({ message: "El ID de la publicación no es válido." });
            return;
        }

        //Validar que se envió el estado
        if (!estado_id) {
            res.status(400).json({ message: "Se requiere el ID del nuevo estado." });
            return;
        }

        //Verificar existencia de la publicación
        const publicacion = await buscarPublicacionPorId(idPublicacion);
        if (!publicacion) {
            res.status(404).json({ message: "Publicación no encontrada." });
            return;
        }

        //Verificar que el usuario es el propietario
        const idToken = Number(req.usuario?.sub);
        if (publicacion.id_usuario !== idToken) {
            res.status(403).json({
                message: "No tienes permiso para modificar esta publicación. Solo el propietario puede cambiar su estado."
            });
            return;
        }

        //Obtener estados permitidos (activo e inactivo)
        const estadoActivo = await obtenerEstadoPorNombre("activo");
        const estadoInactivo = await obtenerEstadoPorNombre("inactivo");

        //Validar que los estados existen en la BD
        if (!estadoActivo || !estadoInactivo) {
            res.status(500).json({
                message: "Error de configuración: Estados 'activo' o 'inactivo' no encontrados."
            });
            return;
        }

        //Verificar que el estado solicitado es válido (activo o inactivo)
        const estadosPermitidos = [estadoActivo.id_estado, estadoInactivo.id_estado];
        if (!estadosPermitidos.includes(estado_id)) {
            res.status(400).json({
                message: `Estado inválido. Solo se puede cambiar a activo (${estadoActivo.id_estado}) o inactivo (${estadoInactivo.id_estado}).`
            });
            return;
        }

        //Verificar que no sea el mismo estado actual
        if (publicacion.estado === estado_id) {
            res.status(400).json({
                message: `La publicación ya está en estado ${estado_id === estadoActivo.id_estado ? 'activo' : 'inactivo'}.`
            });
            return;
        }

        //Actualizar el estado
        const publicacionActualizada = await actualizarEstadoPublicacion(idPublicacion, estado_id);

        //Respuesta exitosa
        const nombreEstado = estado_id === estadoActivo.id_estado ? "activo" : "inactivo";
        res.status(200).json({
            message: `Publicación marcada como ${nombreEstado} exitosamente.`,
            data: {
                id_publicacion: publicacionActualizada.id_publicacion,
                titulo: publicacionActualizada.titulo,
                estado: publicacionActualizada.estado,
                estado_nombre: nombreEstado
            }
        });

    } catch (error) {
        next(error);
    }
}