import prisma from "../../src/persistencia/prismaClient";

export interface CatalogosPerfilTest {
    tipoContacto: number;
    etiqueta: number;
}

/**
 * Crea los catalogos minimos para probar perfiles de vendedor y tutor.
 * Es idempotente para que pueda reutilizarse en cualquier suite.
 */
export async function asegurarCatalogosPerfilTest(): Promise<CatalogosPerfilTest> {
    const tipoContacto = await prisma.tipoContacto.upsert({
        where: { tipo_contacto: "WhatsApp" },
        update: {},
        create: { tipo_contacto: "WhatsApp" },
    });
    const etiqueta = await prisma.etiqueta.upsert({
        where: { nombre: "Programacion" },
        update: {},
        create: {
            nombre: "Programacion",
            descripcion: "Etiqueta creada para pruebas de perfiles",
        },
    });

    return {
        tipoContacto: tipoContacto.id_tipo_contacto,
        etiqueta: etiqueta.id_etiqueta,
    };
}
