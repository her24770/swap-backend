import prisma from "../../src/persistencia/prismaClient";

export type NombreTipoPerfilComun = "material" | "tutoria" | "negocio" | "producto";

/**
 * Asegura la existencia de los tipos de perfil base en la base de datos PostgreSQL de integración
 * y retorna un mapa llave-valor con sus respectivos id_tipo_perfil.
 */
export async function asegurarTiposPerfilBase(
    tipos: (NombreTipoPerfilComun | string)[] = ["material", "tutoria", "negocio", "producto"]
): Promise<Record<string, number>> {
    const mapaTipos: Record<string, number> = {};
    for (const tipo of tipos) {
        const existente = await prisma.tipoPerfil.findUnique({
            where: { tipo_perfil: tipo },
        });
        if (existente) {
            mapaTipos[tipo] = existente.id_tipo_perfil;
        } else {
            const creado = await prisma.tipoPerfil.create({
                data: { tipo_perfil: tipo },
            });
            mapaTipos[tipo] = creado.id_tipo_perfil;
        }
    }
    return mapaTipos;
}

/**
 * Obtiene el registro de un tipo de perfil o lo crea si no existe.
 */
export async function obtenerOCrearTipoPerfil(
    tipoPerfil: NombreTipoPerfilComun | string = "producto"
): Promise<{ id_tipo_perfil: number; tipo_perfil: string }> {
    let tipo = await prisma.tipoPerfil.findUnique({
        where: { tipo_perfil: tipoPerfil },
    });
    if (!tipo) {
        tipo = await prisma.tipoPerfil.create({
            data: { tipo_perfil: tipoPerfil },
        });
    }
    return tipo;
}
