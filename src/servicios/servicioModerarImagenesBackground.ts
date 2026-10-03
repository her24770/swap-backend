import prisma from "../persistencia/prismaClient.js";
import { analizarImagen } from "./servicioModeracionImagen.js";
import { eliminarImagenR2 } from "./servicioR2.js";
import { crearNotificacion } from "../repository/repositorioNotificacion.js";
import { obtenerEstadoPorNombre } from "../repository/repositorioEstado.js";

interface ImagenSubida {
    idImagen: number;
    url: string;
    buffer: Buffer;
}

export async function moderarImagenesEnBackground(
    _idPublicacion: number,
    idUsuario: number,
    imagenes: ImagenSubida[]
): Promise<void> {
    const estadoEnviado = await obtenerEstadoPorNombre('enviado');
    if (!estadoEnviado) return;

    // Analizar todas las imágenes en paralelo
    const resultados = await Promise.all(
        imagenes.map(async (img) => {
            try {
                const resultado = await analizarImagen(img.buffer);
                return { ...img, flagged: resultado.flagged };
            } catch {
                // Si Rekognition falla en una imagen la dejamos pasar
                return { ...img, flagged: false };
            }
        })
    );

    const rechazadas = resultados.filter(r => r.flagged);
    if (rechazadas.length === 0) return;

    // Eliminar imágenes rechazadas de R2 y BD
    await Promise.all(
        rechazadas.map(async (img) => {
            try { await eliminarImagenR2(img.url); } catch { /* continúa si falla R2 */ }
            await prisma.imagenPublicacion.delete({ where: { id_imagen: img.idImagen } });
        })
    );

    // Notificar al usuario
    await crearNotificacion(
        idUsuario,
        `Una o más imágenes de tu publicación fueron eliminadas por no cumplir con las normas de la comunidad.`,
        estadoEnviado.id_estado
    );
}
