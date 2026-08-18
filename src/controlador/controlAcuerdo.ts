import { Request, Response, NextFunction } from "express";
import { obtenerAcuerdosPorUsuario, obtenerAcuerdosPorConversacion, crearAcuerdo, existeSolicitudDuplicada, contarAcuerdosActivosConversacion, buscarAcuerdoPorId, actualizarAcuerdo } from "../repository/repositorioAcuerdo";
import { buscarUsuarioPorId } from "../repository/repositorioUsuario";
import { buscarConversacionPorId } from "../repository/repositorioMensaje";
import { errorResponse, exitoResponse } from "../servicios/Response.js";
import { obtenerEstadoPorNombre } from "../repository/repositorioEstado";
import { buscarPublicacionPorId } from "../repository/repositorioPublicacion";
import { notificarActualizacionAcuerdo } from "../servicios/servicioAcuerdo.js";

// Interfaz para la agrupación de acuerdos en base a la publicacion y el usuario que la obtiene
interface AcuerdoAgrupado {
    id_publicacion: number;
    id_usuario: number;
    publicacion: any;
    usuario: any;
    acuerdos: {
        id_acuerdo: number;
        fecha_entrega: Date;
        lugar_entrega: string;
        observaciones: string;
        estado: any;
        id_conversacion: number;
    }[];
}

const TIPOS_HISTORIAL_VALIDOS = ["producto", "material", "negocio", "tutoria"];
const ESTADOS_VALIDOS = ["activo", "pendiente", "completado", "cancelado"];

function parsePositiveInt(value: unknown): number | undefined {
    if (value === undefined) return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) return undefined;
    return parsed;
}

// Función auxiliar de agrupamiento de acuerdos en base a la publicacion y el usuario que la obtiene
function agruparAcuerdos(acuerdos: any[]): AcuerdoAgrupado[] {
    const grupos = new Map<string, AcuerdoAgrupado>();

    for (const acuerdo of acuerdos) {
        const key = `${acuerdo.id_publicacion}-${acuerdo.id_usuario}`;

        let grupo = grupos.get(key);

        if (!grupo) {
            grupo = {
                id_publicacion: acuerdo.id_publicacion,
                id_usuario: acuerdo.id_usuario,
                publicacion: acuerdo.publicacion,
                usuario: acuerdo.publicacion.usuario,
                acuerdos: []
            };

            grupos.set(key, grupo);
        }

        grupo.acuerdos.push({
            id_acuerdo: acuerdo.id_acuerdo,
            fecha_entrega: acuerdo.fecha_entrega,
            lugar_entrega: acuerdo.lugar_entrega,
            observaciones: acuerdo.observaciones,
            estado: acuerdo.estadoRel,
            id_conversacion: acuerdo.id_conversacion
        });
    }

    return Array.from(grupos.values());
}

export async function obtenerAcuerdosUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.params.id);
        const tipo = req.query.tipo as string | undefined;
        const estado = req.query.estado as string | undefined;
        const q = req.query.q as string | undefined;
        const agrupados = req.query.agrupados === "true";
        const page = parsePositiveInt(req.query.page);
        const limit = parsePositiveInt(req.query.limit);
        if (isNaN(idUsuario)) {
            errorResponse(res, "El id del usuario no es valido", 400);
            return;
        }
        if ((req.query.page !== undefined && page === undefined) || (req.query.limit !== undefined && limit === undefined)) {
            errorResponse(res, "Los parametros page y limit deben ser enteros positivos", 400);
            return;
        }
        if (tipo && !TIPOS_HISTORIAL_VALIDOS.includes(tipo.toLowerCase())) {
            errorResponse(res, "El tipo de historial no es valido", 400);
            return;
        }
        //checar si el estado es valido
        if (estado && !ESTADOS_VALIDOS.includes(estado.toLowerCase())) {
            errorResponse(res, "El estado no es valido", 400);
            return;
        }
        const usuario = await buscarUsuarioPorId(idUsuario);
        if (!usuario) {
            errorResponse(res, "El usuario no existe", 404);
            return;
        }
        const resultado = await obtenerAcuerdosPorUsuario(idUsuario, { tipo, page, limit, q, estado });
        const acuerdos = agrupados ? agruparAcuerdos(resultado.acuerdos) : resultado.acuerdos; 
        const data =
            page !== undefined && limit !== undefined
                ? { data: acuerdos, total: resultado.total, page, limit }
                : acuerdos;

        exitoResponse(res, data, "Acuerdos obtenidos exitosamente", 200);
    } catch (error) {
        next(error);
    }
}

/*
    Obtener los acuerdos asociados a una conversacion.
    Solo los participantes de la conversacion pueden consultarlos.
*/
export async function obtenerAcuerdosConversacion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idConversacion = Number(req.params.id);
        const idUsuario = Number(req.usuario?.sub);

        if (isNaN(idConversacion)) {
            errorResponse(res, "El id de la conversacion no es valido", 400);
            return;
        }

        const conversacion = await buscarConversacionPorId(idConversacion);
        if (!conversacion) {
            errorResponse(res, "La conversacion no existe", 404);
            return;
        }

        const esParticipante = conversacion.id_usuario_1 === idUsuario || conversacion.id_usuario_2 === idUsuario;
        if (!esParticipante) {
            errorResponse(res, "No tienes permiso para ver los acuerdos de esta conversacion", 403);
            return;
        }

        const acuerdos = await obtenerAcuerdosPorConversacion(idConversacion);
        exitoResponse(res, acuerdos, "Acuerdos de la conversacion obtenidos exitosamente", 200);
    } catch (error) {
        next(error);
    }
}

export async function crearSolicitarAcuerdo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idPublicacion = Number(req.params.id);
        const idUsuarioSolicitante = Number(req.usuario?.sub);
        const data = req.body;

        if (isNaN(idPublicacion)) {
            errorResponse(res, "El id de la publicacion no es valido", 400);
            return;
        }

        //Búsqueda de publicación para validación
        const publicacion = await buscarPublicacionPorId(idPublicacion);
        if (!publicacion) {
            errorResponse(res, "La publicacion no existe", 404);
            return;
        }

        //Contar acuerdos activos de una conversacion
        const acuerdosActivos = await contarAcuerdosActivosConversacion(data.id_conversacion);
        //Si la conversación ya posee el máximo de solicitudes activas
        if (acuerdosActivos >= 4) {
            errorResponse(res, "La conversación ya posee el máximo de solicitudes activas", 409);
            return;
        }

        //Verificar si ya existe una solicitud con los mismos datos
        if ( await existeSolicitudDuplicada(
                    idUsuarioSolicitante,
                    idPublicacion,
                    data.id_conversacion,
                    data.fecha_entrega,
                    data.lugar_entrega,
                    data.observaciones
            )) {
                errorResponse(res, "Ya existe una solicitud con los mismos datos", 409);
                return;
            }

        //Verificar si la publicación está reservada o no está activa
        if(publicacion.estadoRel.estado != "activo") {
            errorResponse(res, "La publicacion no esta activa o se encuentra reservada", 400);
            return;
        }

        //Verificar que el usuario no solicite un acuerdo con su propia publicación
        if(publicacion.id_usuario == idUsuarioSolicitante) {
            errorResponse(res, "No puedes solicitar un acuerdo con tu propia publicacion", 400);
            return;
        }

        //Validar fecha de entrega con la fecha actual
        const fechaActual = new Date();
        if(data.fecha_entrega < fechaActual) {
            errorResponse(res, "La fecha de entrega debe ser mayor a la fecha actual", 400);
            return;
        }

        const estadoPendiente = await obtenerEstadoPorNombre("pendiente");
        if(!estadoPendiente) {
            errorResponse(res, "El estado pendiente no existe", 500);
            return;
        }
        
        const nuevaSolicitud = await crearAcuerdo({
            publicacion: {connect: {id_publicacion: idPublicacion}},
            usuario: {connect: {id_usuario: idUsuarioSolicitante}},
            fecha_entrega: data.fecha_entrega,
            lugar_entrega: data.lugar_entrega,
            observaciones: data.observaciones,
            estadoRel: {connect: {id_estado: estadoPendiente.id_estado}},
            conversacion: {connect: {id_conversacion: data.id_conversacion}},
            ofertante: {connect: {id_usuario: idUsuarioSolicitante}}
        });

        await notificarActualizacionAcuerdo(nuevaSolicitud.id_conversacion, idUsuarioSolicitante);

        exitoResponse(res, nuevaSolicitud, "Acuerdo creado exitosamente", 201);

    } catch (error) {
        next(error);
    }
}

export async function actualizarEstadoAcuerdo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idAcuerdo = Number(req.params.id);
        const idUsuario = Number(req.usuario?.sub);
        const data = req.body;

        if (isNaN(idAcuerdo)) {
            errorResponse(res, "El id del acuerdo no es valido", 400);
            return;
        }

        const acuerdo = await buscarAcuerdoPorId(idAcuerdo);
        if (!acuerdo) {
            errorResponse(res, "El acuerdo no existe", 404);
            return;
        }

        // Verificar que el usuario forme parte del acuerdo
        const esPropietario = acuerdo.publicacion.id_usuario === idUsuario;
        const esBeneficiario = acuerdo.id_usuario === idUsuario;
        const esOfertante = acuerdo.ofertante.id_usuario === idUsuario;

        if (!esPropietario && !esBeneficiario) {
            errorResponse(res,"No tienes permiso para actualizar este acuerdo.",403);
            return;
        }

        if(esOfertante){
            errorResponse(res, "Solo la contraperte puede aceptar/rechazar una solicitud.", 403);
            return;
        }

        //Verificar que no se pueda cancelar un acuerdo que no sea pendiente
        if(data.estado == "cancelado") {
            if(acuerdo.estadoRel.estado != "pendiente") {
                errorResponse(res, "No puedes cancelar el acuerdo. Solo se pueden cancelar los acuerdos pendientes.", 400);
                return;
            }
        }

        //Verificar que el estado no sea el mismo
        if(data.estado == acuerdo.estadoRel.estado) {
            errorResponse(res, "El estado no ha cambiado", 400);
            return;
        }

        const estado = await obtenerEstadoPorNombre(data.estado);
        if(!estado) {
            errorResponse(res, "El estado no existe", 500);
            return;
        }

        const nuevoAcuerdo = await actualizarAcuerdo(idAcuerdo, {
            estadoRel: {connect: {id_estado: estado.id_estado}}
        }); 

        await notificarActualizacionAcuerdo(acuerdo.id_conversacion, idUsuario);

        exitoResponse(res, nuevoAcuerdo, "Acuerdo actualizado exitosamente", 200);
    } catch (error) {
        next(error);
    }
}


export async function editarAcuerdo(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {

    try {

        const idAcuerdo = Number(req.params.id);
        const idUsuario = Number(req.usuario?.sub);
        const data = req.body;

        if (isNaN(idAcuerdo)) {
            errorResponse(res, "El id del acuerdo no es valido", 400);
            return;
        }

        const acuerdo = await buscarAcuerdoPorId(idAcuerdo);

        if (!acuerdo) {
            errorResponse(res, "El acuerdo no existe", 404);
            return;
        }
        // Verificar que el usuario forme parte del acuerdo
        const esPropietario = acuerdo.publicacion.id_usuario === idUsuario;
        const esBeneficiario = acuerdo.id_usuario === idUsuario;
        const esOfertante = acuerdo.ofertante.id_usuario === idUsuario;

        if (!esPropietario && !esBeneficiario) {
            errorResponse(res,"No tienes permiso para actualizar este acuerdo.",403);
            return;
        }

        if(esOfertante){
            errorResponse(res, "Solo la contraperte puede aceptar/rechazar una solicitud.", 403);
            return;
        }

        if (acuerdo.estadoRel.estado !== "pendiente") {
            errorResponse(res, "Solo se pueden editar acuerdos pendientes", 400);
            return;
        }

        if (data.fecha_entrega < new Date()) {
            errorResponse(res, "La fecha de entrega debe ser posterior a la fecha actual", 400);
            return;
        }

        const acuerdoActualizado = await actualizarAcuerdo(
                idAcuerdo,
                {
                    fecha_entrega: data.fecha_entrega,
                    lugar_entrega: data.lugar_entrega,
                    observaciones: data.observaciones,
                    ofertante: {connect: {id_usuario: idUsuario}}
                }
            );

        await notificarActualizacionAcuerdo(acuerdo.id_conversacion, idUsuario);

        exitoResponse(res, acuerdoActualizado, "Acuerdo actualizado exitosamente", 200);

    } catch (error) {
        next(error);
    }

}