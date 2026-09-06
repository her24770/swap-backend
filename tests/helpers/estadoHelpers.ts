import prisma from "../../src/persistencia/prismaClient";

export type NombreEstadoComun = "activo" | "inactivo" | "pendiente" | "resuelto" | "rechazado" | "enviado";

/**
 * Asegura la existencia de los registros en la tabla Estado de PostgreSQL en integración
 * y retorna un mapa llave-valor con sus respectivos id_estado.
 */
export async function asegurarEstadosIniciales(
    estados: NombreEstadoComun[] = ["activo", "inactivo", "pendiente", "resuelto", "rechazado", "enviado"]
): Promise<Record<NombreEstadoComun, number>> {
    const mapaEstados: Partial<Record<NombreEstadoComun, number>> = {};
    for (const nombre of estados) {
        const existente = await prisma.estado.findUnique({ where: { estado: nombre } });
        if (existente) {
            mapaEstados[nombre] = existente.id_estado;
        } else {
            const creado = await prisma.estado.create({ data: { estado: nombre } });
            mapaEstados[nombre] = creado.id_estado;
        }
    }
    return mapaEstados as Record<NombreEstadoComun, number>;
}
