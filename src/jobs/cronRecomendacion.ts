import cron from "node-cron";
import prisma from "../persistencia/prismaClient";
import redisClient from "../persistencia/redisClient";
import { obtenerPublicacionesPorPadre } from "../repository/repositorioRecomendacion";

// Recalcula las listas de recomendaciones por carrera y las guarda en Redis.
// Siempre sobreescribe la clave existente para mantener datos frescos.
async function ejecutarBatch(): Promise<void> {
    console.log("[Recomendaciones] Iniciando batch...");

    try {
        // Solo etiquetas raíz (carreras): las que no tienen padre
        const padres = await prisma.etiqueta.findMany({
            where:  { id_etiqueta_padre: null },
            select: { id_etiqueta: true, nombre: true },
        });

        for (const padre of padres) {
            const publicaciones = await obtenerPublicacionesPorPadre(padre.id_etiqueta, 7);
            const cacheKey = `rec:grupo:${padre.id_etiqueta}`;

            // Sobreescribe siempre — el cron existe para mantener datos frescos
            await redisClient.set(
                cacheKey,
                JSON.stringify(publicaciones),
                { EX: 43200 } // TTL 12h como seguridad si el cron falla
            );
        }

        console.log(`[Recomendaciones] Batch completado — ${padres.length} grupos procesados`);
    } catch (error) {
        console.error("[Recomendaciones] Error en batch:", error);
    }
}

// Registra el cron: corre a las 12am y 12pm todos los días
export function iniciarCronRecomendacion(): void {
    cron.schedule("0 0,12 * * *", ejecutarBatch);
    console.log("[Recomendaciones] Cron registrado — 12am y 12pm");
}
