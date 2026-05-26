import { Request, Response, NextFunction } from "express";
import { schemaCrearResena, schemaEditarResena } from "../modelo/schemaResena";
import { 
    crearResena, 
    actualizarResena, 
    buscarResenaPorId, 
    verificarResenaExistente, 
    calcularPromedioResenas, 
    buscarResenasDeUnUsuario 
} from "../repository/repositorioResena";
import { actualizarUsuario, buscarUsuarioPorId } from "../repository/repositorioUsuario";
import { errorResponse, exitoResponse, errorValidacionResponse } from "../servicios/Response.js";
import { obtenerTipoResenaPorNombre } from "../repository/repositorioResena";

export async function registrarNuevaResena(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idEmisor = Number(req.usuario?.sub);
        if (!idEmisor || isNaN(idEmisor)) {
            errorResponse(res, "Usuario no autenticado.", 401);
            return;
        }

        const validacion = schemaCrearResena.safeParse(req.body);
        if (!validacion.success) {
            errorValidacionResponse(res, validacion.error.errors);
            return;
        }

        const { id_receptor, tipo_resena: tipoResenaNombre } = validacion.data;

        if (idEmisor === id_receptor) {
            errorResponse(res, "No puedes dejarte una reseña a ti mismo.", 400);
            return;
        }

        const receptorExiste = await buscarUsuarioPorId(id_receptor);
        if (!receptorExiste) {
            errorResponse(res, "El usuario a reseñar no existe.", 404);
            return;
        }

        const tipoResenaDb = await obtenerTipoResenaPorNombre(tipoResenaNombre);
        if (!tipoResenaDb) {
            errorResponse(res, "El tipo de reseña no existe.", 404);
            return;
        }

        const yaResenado = await verificarResenaExistente(idEmisor, id_receptor, tipoResenaDb.id_tipo_resena);
        if (yaResenado) {
            errorResponse(res, "Ya calificaste a este usuario para este tipo de reseña.", 400);
            return;
        }

        const nuevaResena = await crearResena({
            emisor: { connect: { id_usuario: idEmisor } },
            receptor: { connect: { id_usuario: id_receptor } },
            tipoResena: { connect: { id_tipo_resena: tipoResenaDb.id_tipo_resena } },
            contenido: validacion.data.contenido,
            calificacion: validacion.data.calificacion,
            fecha_resena: new Date(),
        });

        const { promedio, totalResenas } = await calcularPromedioResenas(id_receptor);
        await actualizarUsuario(id_receptor, { 
            calificacion: promedio, 
            total_resenas: totalResenas 
        });

        exitoResponse(res, nuevaResena, "Reseña guardada y reputación actualizada con éxito.", 201);
        return;
    } catch (error) {
        next(error);
    }
}

export async function modificarResenaUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idResena = Number(req.params.id_resena);
        const idEmisor = Number(req.usuario?.sub);

        if (isNaN(idResena)) {
        errorResponse(res, "El ID de la reseña no es válido.", 400);
        return;
        }

        const validacion = schemaEditarResena.safeParse(req.body);
        if (!validacion.success) {
        errorValidacionResponse(res, validacion.error.errors);
        return;
        }

        const resenaOriginal = await buscarResenaPorId(idResena);
        if (!resenaOriginal) {
        errorResponse(res, "La reseña no existe.", 404);
        return;
        }

        if (resenaOriginal.id_emisor !== idEmisor) {
        errorResponse(res, "No tienes permisos para editar esta reseña.", 403);
        return;
        }

        const resenaActualizada = await actualizarResena(idResena, validacion.data);

        // Actualizar reputación
        const { promedio, totalResenas } = await calcularPromedioResenas(resenaOriginal.id_receptor);
        await actualizarUsuario(resenaOriginal.id_receptor, { calificacion: promedio, total_resenas: totalResenas });

        exitoResponse(res, resenaActualizada, "Reseña modificada exitosamente.", 200);
        return;
    } catch (error) {
        next(error);
    }
}

export async function obtenerResenasPerfil(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.params.id_usuario);
        // Extraemos el tipo desde la query string (?tipo=material)
        const tipoResena = req.query.tipo as string;

        if (isNaN(idUsuario)) {
            errorResponse(res, "ID de usuario inválido.", 400);
            return;
        }

        if (!tipoResena) {
            errorResponse(res, "El parámetro 'tipo' de reseña es obligatorio en la consulta.", 400);
            return;
        }

        // Enviamos ambos parámetros a tu función actualizada del repositorio
        const historial = await buscarResenasDeUnUsuario(idUsuario, tipoResena);
        
        exitoResponse(res, historial, `Historial de reseñas para el perfil de '${tipoResena}' obtenido.`, 200);
        return;
    } catch (error) {
        next(error);
    }
}import { Request, Response, NextFunction } from "express";
import { schemaCrearResena, schemaEditarResena } from "../modelo/schemaResena";
import { 
  crearResena, 
  actualizarResena, 
  buscarResenaPorId, 
  verificarResenaExistente, 
  calcularPromedioResenas, 
  buscarResenasDeUnUsuario 
} from "../repository/repositorioResena";
import { obtenerTipoPerfilPorNombre } from "../repository/repositorioTipoPerfil.js";
import { actualizarUsuario, buscarUsuarioPorId } from "../repository/repositorioUsuario";
import { errorResponse, exitoResponse, errorValidacionResponse } from "../servicios/Response.js";

export async function registrarNuevaResena(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idEmisor = Number(req.usuario?.sub);
        if (!idEmisor || isNaN(idEmisor)) {
        errorResponse(res, "Usuario no autenticado.", 401);
        return;
        }

        const validacion = schemaCrearResena.safeParse(req.body);
        if (!validacion.success) {
        errorValidacionResponse(res, validacion.error.errors);
        return;
        }

        const { id_receptor, tipo_resena } = validacion.data;

        if (idEmisor === id_receptor) {
        errorResponse(res, "No puedes dejarte una reseña a ti mismo.", 400);
        return;
        }

        const receptorExiste = await buscarUsuarioPorId(id_receptor);
        if (!receptorExiste) {
        errorResponse(res, "El usuario a reseñar no existe.", 404);
        return;
        }

        const tipoPerfil = await obtenerTipoPerfilPorNombre(tipo_resena);
        if (!tipoPerfil) {
        errorResponse(res, "El tipo de perfil no existe.", 404);
        return;
        }

        const yaResenado = await verificarResenaExistente(idEmisor, id_receptor, tipoPerfil.id_tipo_perfil);
        if (yaResenado) {
        errorResponse(res, "Ya calificaste a este usuario para este tipo de perfil.", 400);
        return;
        }

        const nuevaResena = await crearResena({
        emisor: { connect: { id_usuario: idEmisor } },
        receptor: { connect: { id_usuario: id_receptor } },
        tipoResena: { connect: { id_tipo_perfil: tipoPerfil.id_tipo_perfil } },
        contenido: validacion.data.contenido,
        calificacion: validacion.data.calificacion,
        fecha_resena: new Date(),
        });

        // Sincronizar promedio de reputación
        const { promedio } = await calcularPromedioResenas(id_receptor);
        await actualizarUsuario(id_receptor, { calificacion: promedio });

        exitoResponse(res, nuevaResena, "Reseña guardada y reputación actualizada con éxito.", 201);
        return;
    } catch (error) {
        next(error);
    }
}

export async function modificarResenaUsuario(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idResena = Number(req.params.id_resena);
        const idEmisor = Number(req.usuario?.sub);

        if (isNaN(idResena)) {
        errorResponse(res, "El ID de la reseña no es válido.", 400);
        return;
        }

        const validacion = schemaEditarResena.safeParse(req.body);
        if (!validacion.success) {
        errorValidacionResponse(res, validacion.error.errors);
        return;
        }

        const resenaOriginal = await buscarResenaPorId(idResena);
        if (!resenaOriginal) {
        errorResponse(res, "La reseña no existe.", 404);
        return;
        }

        if (resenaOriginal.id_emisor !== idEmisor) {
        errorResponse(res, "No tienes permisos para editar esta reseña.", 403);
        return;
        }

        const resenaActualizada = await actualizarResena(idResena, validacion.data);

        // Actualizar reputación
        const { promedio } = await calcularPromedioResenas(resenaOriginal.id_receptor);
        await actualizarUsuario(resenaOriginal.id_receptor, { calificacion: promedio });

        exitoResponse(res, resenaActualizada, "Reseña modificada exitosamente.", 200);
        return;
    } catch (error) {
        next(error);
    }
}

export async function obtenerResenasPerfil(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const idUsuario = Number(req.params.id_usuario);
        if (isNaN(idUsuario)) {
        errorResponse(res, "ID de usuario inválido.", 400);
        return;
        }

        const historial = await buscarResenasDeUnUsuario(idUsuario);
        exitoResponse(res, historial, "Historial de reseñas obtenido.", 200);
        return;
    } catch (error) {
        next(error);
    }
}