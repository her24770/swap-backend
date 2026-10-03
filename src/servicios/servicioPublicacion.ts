import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { EditarPublicacionInput, CrearPublicacionInput } from "../modelo/schemaPublicacion.js";
import {
    actualizarPublicacion,
    buscarImagenesPorPublicacion,
    buscarPublicacionPorId,
    buscarPublicacionPorIdDetallado,
    eliminarImagen,
    eliminarPublicacionConRelaciones,
    guardarImagen,
    guardarPublicacion,
    reemplazarEtiquetasPublicacion,
} from "../repository/repositorioPublicacion.js";
import { obtenerTipoPerfilPorNombre } from "../repository/repositorioTipoPerfil.js";
import { buscarUsuarioPorId } from "../repository/repositorioUsuario.js";
import { obtenerEstadoPorNombre } from "../repository/repositorioEstado.js";
import { generarYGuardarEmbedding } from "./servicioEmbedding.js";
import { moderarImagenesEnBackground } from "./servicioModerarImagenesBackground.js";
import { eliminarImagenR2, subirImagenR2 } from "./servicioR2.js";
import { ErrorServicio } from "./ErrorServicio.js";

const MAX_IMAGENES = 5;

interface ImagenParaModerar {
    idImagen: number;
    url: string;
    buffer: Buffer;
}

export interface CrearPublicacionParams {
    idUsuario: number;
    datos: CrearPublicacionInput;
    archivos: Express.Multer.File[];
}

export interface EditarPublicacionParams {
    idPublicacion: number;
    idUsuario: number;
    datos: EditarPublicacionInput;
    archivos: Express.Multer.File[];
}

async function subirImagenes(
    idPublicacion: number,
    archivos: Express.Multer.File[],
): Promise<{ urls: string[]; paraModerar: ImagenParaModerar[] }> {
    const urls: string[] = [];
    const paraModerar: ImagenParaModerar[] = [];

    for (const archivo of archivos.filter((item) => item.fieldname === "imagenes")) {
        try {
            const url = await subirImagenR2(
                archivo.buffer,
                archivo.mimetype,
                "publicaciones",
                `post_${idPublicacion}_${crypto.randomUUID()}`,
            );
            const imagen = await guardarImagen({
                url_imagen: url,
                publicacion: { connect: { id_publicacion: idPublicacion } },
            });
            urls.push(url);
            paraModerar.push({ idImagen: imagen.id_imagen, url, buffer: archivo.buffer });
        } catch {
            // Una imagen fallida no invalida las otras cargas, igual que en el flujo anterior.
        }
    }

    return { urls, paraModerar };
}

function ejecutarTareasPosteriores(
    idPublicacion: number,
    idUsuario: number,
    textoEmbedding: string | undefined,
    imagenes: ImagenParaModerar[],
): void {
    if (textoEmbedding) {
        void generarYGuardarEmbedding(idPublicacion, textoEmbedding).catch(() => undefined);
    }
    if (imagenes.length > 0) {
        void moderarImagenesEnBackground(idPublicacion, idUsuario, imagenes).catch(() => undefined);
    }
}

export async function crearPublicacion(params: CrearPublicacionParams) {
    const { idUsuario, datos, archivos } = params;
    if (!idUsuario) throw new ErrorServicio("Usuario no autenticado", 401);

    const [usuario, tipoPerfil, estado] = await Promise.all([
        buscarUsuarioPorId(idUsuario),
        obtenerTipoPerfilPorNombre(datos.tipo_publicacion),
        obtenerEstadoPorNombre(datos.estado ?? "disponible"),
    ]);

    if (!usuario) throw new ErrorServicio("Usuario no encontrado", 404);
    if (!tipoPerfil) throw new ErrorServicio("Tipo de publicacion no encontrado", 404);
    if (!estado) throw new ErrorServicio(`Estado inválido: "${datos.estado ?? "disponible"}".`, 400);

    const data: Prisma.PublicacionCreateInput = {
        titulo: datos.titulo,
        descripcion: datos.descripcion,
        precio: datos.precio,
        is_pinned: datos.destacar,
        usuario: { connect: { id_usuario: idUsuario } },
        tipoPerfil: { connect: { id_tipo_perfil: tipoPerfil.id_tipo_perfil } },
        estadoRel: { connect: { id_estado: estado.id_estado } },
    };
    const publicacion = await guardarPublicacion(data, datos.etiquetas);

    const imagenes = await subirImagenes(publicacion.id_publicacion, archivos);
    ejecutarTareasPosteriores(
        publicacion.id_publicacion,
        idUsuario,
        `${datos.titulo} ${datos.descripcion}`,
        imagenes.paraModerar,
    );

    return { id_publicacion: publicacion.id_publicacion, imagenes: imagenes.urls };
}

export async function editarPublicacion(params: EditarPublicacionParams) {
    const { idPublicacion, idUsuario, datos, archivos } = params;
    const publicacion = await buscarPublicacionPorId(idPublicacion);
    if (!publicacion) throw new ErrorServicio("Publicacion no encontrada", 404);
    if (publicacion.id_usuario !== idUsuario) {
        throw new ErrorServicio(
            "No tienes permiso para editar esta publicacion. Solo el propietario puede hacer cambios",
            403,
        );
    }

    const imagenesActuales = await buscarImagenesPorPublicacion(idPublicacion);
    const urlsEliminar = datos.imagenesEliminar ?? [];
    const imagenesRestantes = imagenesActuales.filter((img) => !urlsEliminar.includes(img.url_imagen));
    const archivosImagen = archivos.filter((item) => item.fieldname === "imagenes");
    const disponibles = MAX_IMAGENES - imagenesRestantes.length;
    if (archivosImagen.length > disponibles) {
        throw new ErrorServicio(
            `Solo puedes agregar ${disponibles} imagen(es) más. La publicación ya tiene ${imagenesRestantes.length} y el máximo es ${MAX_IMAGENES}.`,
            400,
        );
    }

    const updateData: Prisma.PublicacionUpdateInput = {};
    if (datos.titulo !== undefined) updateData.titulo = datos.titulo;
    if (datos.descripcion !== undefined) updateData.descripcion = datos.descripcion;
    if (datos.precio !== undefined) updateData.precio = datos.precio;

    if (datos.estado !== undefined) {
        const estado = await obtenerEstadoPorNombre(datos.estado);
        if (!estado) throw new ErrorServicio(`Estado inválido: "${datos.estado}".`, 400);
        updateData.estadoRel = { connect: { id_estado: estado.id_estado } };
    }
    if (datos.tipo_publicacion !== undefined) {
        const tipo = await obtenerTipoPerfilPorNombre(datos.tipo_publicacion);
        if (!tipo) {
            throw new ErrorServicio(`Tipo de publicación inválido: "${datos.tipo_publicacion}".`, 400);
        }
        updateData.tipoPerfil = { connect: { id_tipo_perfil: tipo.id_tipo_perfil } };
    }

    if (Object.keys(updateData).length > 0) {
        await actualizarPublicacion(idPublicacion, updateData);
    }
    if (datos.etiquetas !== undefined) {
        await reemplazarEtiquetasPublicacion(idPublicacion, datos.etiquetas);
    }

    for (const imagen of imagenesActuales.filter((item) => urlsEliminar.includes(item.url_imagen))) {
        try {
            await eliminarImagenR2(imagen.url_imagen);
        } catch {
            // Se prioriza mantener consistente la base de datos si R2 no responde.
        }
        await eliminarImagen(imagen.id_imagen);
    }

    const nuevas = await subirImagenes(idPublicacion, archivosImagen);
    const imagenesFinales = await buscarImagenesPorPublicacion(idPublicacion);
    const textoEmbedding = datos.titulo !== undefined || datos.descripcion !== undefined
        ? `${datos.titulo ?? publicacion.titulo} ${datos.descripcion ?? publicacion.descripcion}`
        : undefined;
    ejecutarTareasPosteriores(idPublicacion, idUsuario, textoEmbedding, nuevas.paraModerar);

    return { imagenes: imagenesFinales, urlsNuevas: nuevas.urls };
}

export async function eliminarPublicacionPropia(idPublicacion: number, idUsuario: number): Promise<void> {
    const publicacion = await buscarPublicacionPorIdDetallado(idPublicacion);
    if (!publicacion) throw new ErrorServicio("Publicación no encontrada", 404);
    if (publicacion.id_usuario !== idUsuario) {
        throw new ErrorServicio("No tienes permiso para eliminar esta publicación", 403);
    }

    for (const imagen of publicacion.imagenes ?? []) {
        try {
            await eliminarImagenR2(imagen.url_imagen);
        } catch {
            // Se prioriza la eliminación de los registros locales.
        }
    }
    await eliminarPublicacionConRelaciones(idPublicacion);
}
