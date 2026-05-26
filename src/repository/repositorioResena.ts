import { Prisma, Resena, TipoResena} from "@prisma/client";
import prisma from "../persistencia/prismaClient";
import { EditarResenaInput } from "../modelo/schemaResena";

export async function crearResena(data: Prisma.ResenaCreateInput): Promise<Resena> {
    return await prisma.resena.create({ data });    
    
}

export async function actualizarResena(idResena: number, data: EditarResenaInput): Promise<Resena> {
    return await prisma.resena.update({
        where: { id_resena: idResena },
        data: {
        contenido: data.contenido,
        calificacion: data.calificacion,
        },
    });
}

export async function buscarResenaPorId(idResena: number): Promise<Resena | null> {
    return await prisma.resena.findUnique({ where: { id_resena: idResena } });
}

export async function verificarResenaExistente(idEmisor: number, idReceptor: number, idTipoResena: number): Promise<Resena | null> {
    return await prisma.resena.findFirst({
        where: { id_emisor: idEmisor, id_receptor: idReceptor, id_tipo_resena: idTipoResena },
    });
}

export async function buscarResenasDeUnUsuario(idReceptor: number, tipoResenaString: string): Promise<Resena[]> {
    return await prisma.resena.findMany({
        where: { 
            id_receptor: idReceptor,
            tipoResena: {
                tipo_resena: tipoResenaString 
            }
        },
        include: {
            emisor: {
                select: { 
                    id_usuario: true, 
                    nombre: true, 
                    url_foto_perfil: true 
                },
            },
            tipoResena: { 
                select: { 
                    tipo_resena: true 
                } 
            },
        },
        orderBy: { 
            fecha_resena: "desc" 
        },
    });
}

export async function calcularPromedioResenas(idReceptor: number): Promise<{ promedio: number; totalResenas: number }> {
    const resultado = await prisma.resena.aggregate({
        where: { id_receptor: idReceptor },
        _avg: { calificacion: true },
        _count: { id_resena: true },
    });
    return {
        promedio: resultado._avg.calificacion ? parseFloat(resultado._avg.calificacion.toFixed(2)) : 0,
        totalResenas: resultado._count.id_resena
    };
}


export async function obtenerTipoResenaPorNombre(nombre: string | undefined): Promise<TipoResena | null> {
    if (!nombre || nombre === "") return null;
    return await prisma.tipoResena.findUnique({ where: { tipo_resena: nombre } });
}