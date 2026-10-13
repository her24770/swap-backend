import prisma from "../persistencia/prismaClient.js";
import { analizarImagen } from "./servicioModeracionImagen.js";
import { eliminarImagenR2 } from "./servicioR2.js";
import { crearNotificacion } from "../repository/repositorioNotificacion.js";
import { obtenerEstadoPorNombre } from "../repository/repositorioEstado.js";
import { escribirLog } from "../observabilidad/logger.js";

interface ImagenSubida {
    idImagen: number;
    url: string;
    buffer: Buffer;
}

export async function moderarImagenesEnBackground(
    idPublicacion: number,
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
                return { ...img, flagged: resultado.flagged, fallo: false };
            } catch (error) {
                escribirLog("warn", "moderation.provider_failed", {
                    providerType: "publication_image_background",
                    publicationId: idPublicacion,
                    userId: idUsuario,
                    error,
                });
                // OWASP Top 10 A10: Política Fail-Closed.
                // Si Rekognition falla, no se deja pasar la imagen automáticamente.
                // Se marca como fallo para retener la publicación en revisión manual.
                return { ...img, flagged: false, fallo: true };
            }
        })
    );

    // 1. Manejo Fail-Closed si hubo fallo del proveedor en alguna imagen:
    // Retener la publicación en estado 'pendiente' y notificar al usuario.
    const huboFalloProveedor = resultados.some(r => r.fallo);
    if (huboFalloProveedor) {
        const estadoPendiente = await obtenerEstadoPorNombre('pendiente');
        if (estadoPendiente) {
            await prisma.publicacion.update({
                where: { id_publicacion: idPublicacion },
                data: { estado: estadoPendiente.id_estado },
            });
        }

        await crearNotificacion(
            idUsuario,
            `Tu publicación se encuentra en revisión manual debido a que no fue posible verificar automáticamente una o más imágenes.`,
            estadoEnviado.id_estado
        );
    }

    // 2. Eliminación de imágenes con contenido explícitamente infractor
    const rechazadas = resultados.filter(r => r.flagged);
    if (rechazadas.length === 0) return;

    // Eliminar imágenes rechazadas de R2 y BD
    await Promise.all(
        rechazadas.map(async (img) => {
            try { await eliminarImagenR2(img.url); } catch { /* continúa si falla R2 */ }
            await prisma.imagenPublicacion.delete({ where: { id_imagen: img.idImagen } });
        })
    );

    // Notificar al usuario sobre las imágenes eliminadas por infracción
    await crearNotificacion(
        idUsuario,
        `Una o más imágenes de tu publicación fueron eliminadas por no cumplir con las normas de la comunidad.`,
        estadoEnviado.id_estado
    );
}
