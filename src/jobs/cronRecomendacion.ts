import cron from "node-cron";
import prisma from "../persistencia/prismaClient";
import redisClient from "../persistencia/redisClient";
import { obtenerPublicacionesPorPadre } from "../repository/repositorioRecomendacion";
import { escribirLog } from "../observabilidad/logger.js";

// Recalcula las listas de recomendaciones por carrera y las guarda en Redis.
// Siempre sobreescribe la clave existente para mantener datos frescos.
async function ejecutarBatch(): Promise<void> {
    escribirLog("info", "recommendations.batch_started");

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

        escribirLog("info", "recommendations.batch_completed", { processedGroups: padres.length });
    } catch (error) {
        escribirLog("error", "recommendations.batch_failed", { error });
    }
}

// Registra el cron: corre a las 12am y 12pm todos los días
export function iniciarCronRecomendacion(): void {
    cron.schedule("0 0,12 * * *", ejecutarBatch);
    escribirLog("info", "recommendations.cron_registered", { schedule: "0 0,12 * * *" });
}
