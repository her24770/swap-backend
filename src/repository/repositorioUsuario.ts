import { Prisma, Usuario, Contacto, UsuarioEtiqueta} from "@prisma/client";
import prisma from "../persistencia/prismaClient";

// ─────────────────────────────────────────────
// Usuario
// ─────────────────────────────────────────────

// Fix BG-17: proyección segura para exponer un perfil de Usuario a otros
// usuarios (autenticados o no). NUNCA debe incluir carnet, email_institucional,
// reportes_recibidos, tiempo_suspendido, sesion_version ni password — son datos
// internos/PII, no del perfil público. `contactos` sí se incluye a propósito:
// es información que el propio usuario decidió publicar para que lo contacten.
const SELECT_PERFIL_PUBLICO = {
    id_usuario: true,
    nombre: true,
    url_foto_perfil: true,
    descripcion: true,
    calificacion: true,
    total_resenas: true,
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
} satisfies Prisma.UsuarioSelect;

export async function buscarUsuarioPorId(id: number): Promise<Usuario | null> {
    return prisma.usuario.findUnique({ where: { id_usuario: id } });
}

export async function buscarPerfilPublicoPorId(id: number) {
    return prisma.usuario.findUnique({
        where: { id_usuario: id },
        select: SELECT_PERFIL_PUBLICO,
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

export interface FiltrosModeracionUsuario {
    q?: string;
    sort?: 'nombre' | 'calificacion' | 'reportes_recibidos' | 'total_resenas';
    order?: 'asc' | 'desc';
    conReportes?: boolean;
    page: number;
    limit: number;
}

export interface ResultadoModeracionUsuario {
    usuarios: Usuario[];
    total: number;
}

// Listado paginado + filtrado de usuarios para el panel de moderación
// (GET /api/moderador/usuarios). Busca por nombre, correo o carnet.
export async function buscarUsuariosModeracion(
    filtros: FiltrosModeracionUsuario
): Promise<ResultadoModeracionUsuario> {
    const { q, sort = 'nombre', order = 'asc', conReportes, page, limit } = filtros;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (q) {
        const comoNumero = Number(q);
        where.OR = [
            { nombre: { contains: q, mode: 'insensitive' } },
            { email_institucional: { contains: q, mode: 'insensitive' } },
            ...(Number.isNaN(comoNumero) ? [] : [{ carnet: comoNumero }]),
        ];
    }

    if (conReportes) {
        where.reportes_recibidos = { gt: 0 };
    }

    const [usuarios, total] = await prisma.$transaction([
        prisma.usuario.findMany({
            where,
            select: {
                id_usuario: true,
                nombre: true,
                carnet: true,
                email_institucional: true,
                url_foto_perfil: true,
                calificacion: true,
                total_resenas: true,
                reportes_recibidos: true,
                tiempo_suspendido: true,
            },
            orderBy: { [sort]: order },
            skip,
            take: limit,
        }),
        prisma.usuario.count({ where }),
    ]);

    return { usuarios: usuarios as unknown as Usuario[], total };
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

export async function reemplazarContactosUsuario(
    idUsuario: number,
    contactos: Array<{ tipoContacto: number; valor: string }>,
): Promise<Contacto[]> {
    return prisma.$transaction(async (tx) => {
        await tx.contacto.deleteMany({ where: { id_usuario: idUsuario } });
        const resultados: Contacto[] = [];
        for (const contacto of contactos) {
            resultados.push(await tx.contacto.create({
                data: {
                    id_usuario: idUsuario,
                    tipo_contacto: contacto.tipoContacto,
                    valor: contacto.valor,
                },
            }));
        }
        return resultados;
    });
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
            publicaciones: {
                where: {
                    tipoPerfil: { tipo_perfil: "tutoria" },
                    estadoRel: { estado: "activo" }
                },
                select: { titulo: true }
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
