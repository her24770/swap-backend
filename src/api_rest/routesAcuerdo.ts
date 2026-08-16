import { Router } from "express";
import { autenticar } from "../autenticacion/GestorPermisos";
import { soloUsuario } from "../autenticacion/permisosUsuario";
import { obtenerAcuerdosUsuario, obtenerAcuerdosConversacion, crearSolicitarAcuerdo, actualizarEstadoAcuerdo, editarAcuerdo } from "../controlador/controlAcuerdo";
import { validar } from "../autenticacion/middelwareValidacion";
import { actualizarAcuerdoSchema, actualizarEstadoAcuerdoSchema, solicitudAcuerdoSchema } from "../modelo/schemaAcuerdo";

const router = Router();

router.get("/user/:id", autenticar, obtenerAcuerdosUsuario); //Ruta para los acuerdos recibidos por el usuario
router.get("/conversacion/:id", autenticar, obtenerAcuerdosConversacion); //Ruta para los acuerdos asociados a una conversacion

router.post("/:id", autenticar, soloUsuario, validar(solicitudAcuerdoSchema), crearSolicitarAcuerdo); //Ruta para crear una solicitud de acuerdo (id: idPublicacion)

router.put("/:id", autenticar, soloUsuario, validar(actualizarEstadoAcuerdoSchema), actualizarEstadoAcuerdo); //Ruta para actualizar el estado de un acuerdo
router.put("/:id/editar", autenticar, soloUsuario, validar(actualizarAcuerdoSchema), editarAcuerdo); //Ruta para editar un acuerdo (fecha, lugar, observaciones)
export default router;