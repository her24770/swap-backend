import prisma from "../../src/persistencia/prismaClient";
import { generarSufijoUnico, crearUsuarioTest } from "./authHelpers";

export interface PublicacionTestFixture {
    id_publicacion: number;
    titulo: string;
    descripcion: string;
    precio: string;
    id_usuario: number;
    estado: number;
    tipo_publicacion: number;
}

/**
 * Crea una publicación de prueba en la base de datos PostgreSQL de integración,
 * resolviendo de manera segura las dependencias de TipoPerfil, Estado y Usuario si no se especifican.
 */
export async function crearPublicacionTest(datosPersonalizados: Partial<{
    titulo: string;
    descripcion: string;
    precio: string;
    id_usuario: number;
    estado: number;
    tipo_perfil: string;
    tipo_publicacion: number;
}> = {}): Promise<PublicacionTestFixture> {
    const sufijo = generarSufijoUnico();
    const titulo = datosPersonalizados.titulo ?? `Publicación Test ${sufijo}`;
    const descripcion = datosPersonalizados.descripcion ?? `Descripción de prueba ${sufijo}`;
    const precio = datosPersonalizados.precio ?? "50.00";

    // Resolver TipoPerfil
    let tipoPublicacion = datosPersonalizados.tipo_publicacion;
    if (!tipoPublicacion) {
        const nombreTipo = datosPersonalizados.tipo_perfil ?? "producto";
        let tipo = await prisma.tipoPerfil.findUnique({
            where: { tipo_perfil: nombreTipo },
        });
        if (!tipo) {
            tipo = await prisma.tipoPerfil.create({
                data: { tipo_perfil: nombreTipo },
            });
        }
        tipoPublicacion = tipo.id_tipo_perfil;
    }

    // Resolver Estado
    let idEstado = datosPersonalizados.estado;
    if (!idEstado) {
        let estadoActivo = await prisma.estado.findUnique({
            where: { estado: "activo" },
        });
        if (!estadoActivo) {
            estadoActivo = await prisma.estado.create({
                data: { estado: "activo" },
            });
        }
        idEstado = estadoActivo.id_estado;
    }

    // Resolver Usuario
    let idUsuario = datosPersonalizados.id_usuario;
    if (!idUsuario) {
        const usuario = await crearUsuarioTest();
        idUsuario = usuario.id_usuario;
    }

    const publicacion = await prisma.publicacion.create({
        data: {
            titulo,
            descripcion,
            precio,
            estado: idEstado,
            tipo_publicacion: tipoPublicacion,
            id_usuario: idUsuario,
        },
    });

    return {
        id_publicacion: publicacion.id_publicacion,
        titulo: publicacion.titulo,
        descripcion: publicacion.descripcion,
        precio: String(publicacion.precio),
        id_usuario: publicacion.id_usuario,
        estado: publicacion.estado,
        tipo_publicacion: publicacion.tipo_publicacion,
    };
}
