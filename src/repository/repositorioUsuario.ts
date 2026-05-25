import { Prisma, Usuario, Contacto, UsuarioEtiqueta} from "@prisma/client";
import prisma from "../persistencia/prismaClient";

// ─────────────────────────────────────────────
// Usuario
// ─────────────────────────────────────────────

export async function buscarUsuarioPorId(id: number): Promise<Usuario | null> {
    return prisma.usuario.findUnique({ where: { id_usuario: id } });
}

export async function buscarPerfilPublicoPorId(id: number) {
    return prisma.usuario.findUnique({
        where: { id_usuario: id },
        select: {
            id_usuario: true,
            nombre: true,
            carnet: true,
            email_institucional: true,
            url_foto_perfil: true,
            descripcion: true,
            calificacion: true,
            reportes_recibidos: true,
            resenasRecibidas: true,
            resenasEmitidas : true,
            contactos: {
                include: {
                    tipoContacto: true,
                },
            },
            etiquetas: {
                include: {
                    etiqueta: true,
                },
            },
        },
    });
}

export async function buscarUsuarioPorEmail(email: string): Promise<Usuario | null> {
    return prisma.usuario.findUnique({ where: { email_institucional: email } });
}

export async function buscarUsuarioPorCarnet(carnet: number): Promise<Usuario | null> {
    return prisma.usuario.findUnique({ where: { carnet } });
}

export async function buscarTodosLosUsuarios(): Promise<Usuario[]> {
    return prisma.usuario.findMany();
}

export async function guardarUsuario(data: Prisma.UsuarioCreateInput): Promise<Usuario> {
    return prisma.usuario.create({ data });
}

export async function actualizarUsuario(
    id: number,
    data: Prisma.UsuarioUpdateInput
): Promise<Usuario> {
    return prisma.usuario.update({ where: { id_usuario: id }, data });
}

export async function eliminarUsuario(id: number): Promise<Usuario> {
    return prisma.usuario.delete({ where: { id_usuario: id } });
}

// ─────────────────────────────────────────────
// Contacto
// ─────────────────────────────────────────────

export async function buscarContactoPorId(id: number): Promise<Contacto | null> {
    return prisma.contacto.findUnique({ where: { id_contacto: id } });
}

export async function buscarContactosPorUsuario(idUsuario: number): Promise<Contacto[]> {
    return prisma.contacto.findMany({ where: { id_usuario: idUsuario } });
}

export async function guardarContacto(data: Prisma.ContactoCreateInput | Prisma.ContactoCreateInput[]): Promise<Contacto | Contacto[]> {
    const datosArray = Array.isArray(data) ? data : [data]; //Si es un solo objeto se convierte en array
    const resultados = await prisma.$transaction(
        datosArray.map(data => prisma.contacto.create({ data })) //Se almacenan todos dentro de una transacción
    );

    return Array.isArray(data) ? resultados : resultados[0];
}

export async function eliminarContacto(id: number): Promise<number> {
    const result = await prisma.contacto.deleteMany({ where: { id_usuario: id } });
    return result.count;
}

export async function actualizarContacto(
    id: number,
    data: Prisma.ContactoUpdateInput
): Promise<Contacto> {
    return prisma.contacto.update({ where: { id_contacto: id }, data });
}


export async function buscarUsuariosPorIdsDetallado(
    ids: number[]
): Promise<any[]> {

    const usuarios = await prisma.usuario.findMany({

        where: {
            id_usuario: {
                in: ids
            }
        },

        select: {

            id_usuario: true,
            nombre: true,
            carnet: true,
            email_institucional: true,
            url_foto_perfil: true,
            descripcion: true,
            calificacion: true,
            reportes_recibidos: true,

            contactos: {
                include: {
                    tipoContacto: true,
                },
            },

            etiquetas: {
                include: {
                    etiqueta: true,
                },
            },

            _count: {
                select: {
                    acuerdos: true
                }
            }
        }
    });

    // Mantener orden original
    const orden = new Map<number, number>();

    ids.forEach((id, index) => {
        orden.set(id, index);
    });

    usuarios.sort((a, b) => {
        return (
            (orden.get(a.id_usuario) ?? 0) -
            (orden.get(b.id_usuario) ?? 0)
        );
    });

    return usuarios;
}
// ─────────────────────────────────────────────
// Etiquetas de Usuario
// ─────────────────────────────────────────────

export async function guardarEtiquetaUsuario(data: Prisma.UsuarioEtiquetaCreateInput | Prisma.UsuarioEtiquetaCreateInput[]): Promise<UsuarioEtiqueta | UsuarioEtiqueta[]> {
    const datosArray = Array.isArray(data) ? data : [data]; //Si es un solo objeto se convierte en array
    const resultados = await prisma.$transaction(
        datosArray.map(data => prisma.usuarioEtiqueta.create({ data })) //Se almacenan todos dentro de una transacción
    );

    return Array.isArray(data) ? resultados : resultados[0];
}

export async function eliminarEtiquetaUsuario(idUsuario: number, idEtiqueta: number): Promise<number> {
    const result = await prisma.usuarioEtiqueta.deleteMany({
        where: {
            id_usuario: idUsuario,
            id_etiqueta: idEtiqueta
        }
    });
    return result.count;
}
