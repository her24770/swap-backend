import { Router } from "express";
import { autenticar } from "../autenticacion/GestorPermisos";
import { soloUsuario } from "../autenticacion/permisosUsuario";
import { obtenerAcuerdosUsuario, obtenerAcuerdosConversacion, crearSolicitarAcuerdo, actualizarEstadoAcuerdo, editarAcuerdo } from "../controlador/controlAcuerdo";
import { validar } from "../autenticacion/middelwareValidacion";
import { actualizarAcuerdoSchema, actualizarEstadoAcuerdoSchema, solicitudAcuerdoSchema } from "../modelo/schemaAcuerdo";
import { marcarObsoleto } from "./compatibilidad";

const router = Router();

router.get("/", autenticar, obtenerAcuerdosUsuario); //Ruta para los acuerdos recibidos por el usuario
router.get("/conversacion/:id", autenticar, obtenerAcuerdosConversacion); //Ruta para los acuerdos asociados a una conversacion

router.post("/:id", autenticar, soloUsuario, validar(solicitudAcuerdoSchema), crearSolicitarAcuerdo); //Ruta para crear una solicitud de acuerdo (id: idPublicacion)

router.patch("/:id/estado", autenticar, soloUsuario, validar(actualizarEstadoAcuerdoSchema), actualizarEstadoAcuerdo);
router.put("/:id/detalle", autenticar, soloUsuario, validar(actualizarAcuerdoSchema), editarAcuerdo);

// Compatibilidad v1: conservar temporalmente los paths anteriores con aviso.
router.put("/:id", marcarObsoleto("/api/v1/acuerdo/:id/estado"), autenticar, soloUsuario, validar(actualizarEstadoAcuerdoSchema), actualizarEstadoAcuerdo);
router.put("/:id/editar", marcarObsoleto("/api/v1/acuerdo/:id/detalle", "PUT"), autenticar, soloUsuario, validar(actualizarAcuerdoSchema), editarAcuerdo);
export default router;
