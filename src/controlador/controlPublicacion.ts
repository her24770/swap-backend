import { Request, Response, NextFunction } from "express";
import { buscarPublicacionesPorTipoYUsuario, buscarPublicacionesPaginadas, guardarPublicacion, buscarPublicacionPorId, guardarImagen } from "../repository/repositorioPublicacion.js";
import { obtenerTipoPerfilPorNombre } from "../repository/repositorioTipoPerfil.js";
import { buscarUsuarioPorId } from "../repository/repositorioUsuario.js";
import { subirImagenR2 } from "../servicios/servicioR2.js";
import { schemaCrearPublicacion } from "../modelo/schemaPublicacion.js";

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

export async function crearPublicacionConImagen(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        // Validar datos del body
        const bodyData = {
            titulo: req.body.titulo,
            descripcion: req.body.descripcion,
            precio: req.body.precio ? Number(req.body.precio) : 0,
            tipo_publicacion: req.body.tipo_publicacion ? Number(req.body.tipo_publicacion) : undefined,
            estado: req.body.estado ? Number(req.body.estado) : undefined,
            imagenes: []
        };

        const validacion = schemaCrearPublicacion.safeParse(bodyData);
        if (!validacion.success) {
            res.status(400).json({ error: validacion.error.errors });
            return;
        }

        // Obtener ID de usuario del token
        const idUsuario = (req.user as any).id_usuario;
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

        // Obtener el tipo de perfil por ID
        const tipoPerfil = await (require("../persistencia/prismaClient.js").default as any).tipoPerfil.findUnique({
            where: { id_tipo_perfil: validacion.data.tipo_publicacion }
        });

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

        // Obtener estado por defecto (activo)
        const estadoActivo = await (require("../persistencia/prismaClient.js").default as any).estado.findUnique({
            where: { estado: "activo" }
        });

        const idEstado = validacion.data.estado || estadoActivo?.id_estado || 1;

        // Crear publicación
        const publicacion = await guardarPublicacion({
            titulo: validacion.data.titulo,
            descripcion: validacion.data.descripcion,
            precio: validacion.data.precio,
            tipo_publicacion: tipoPerfil.id_tipo_perfil,
            estado: idEstado,
            id_usuario: idUsuario,
            imagenes: urlImagen ? {
                create: [{ url_imagen: urlImagen }]
            } : undefined
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
        if (!publicacion) {
            res.status(404).json({ error: "Publicación no encontrada" });
            return;
        }

        // Validar que haya archivo
        if (!req.file) {
            res.status(400).json({ error: "No se proporcionó archivo de imagen" });
            return;
        }

        // Subir imagen a R2
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

        // Guardar imagen en BD
        const imagen = await guardarImagen({
            url_imagen: urlImagen,
            publicacion: { connect: { id_publicacion: idPublicacion } }
        });

        res.status(200).json({
            message: "Imagen agregada a la publicación",
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