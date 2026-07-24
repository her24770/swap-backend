import { Router } from "express";
import { autenticar } from "../autenticacion/GestorPermisos";
import { obtenerAcuerdosUsuario, obtenerAcuerdosConversacion, crearSolicitarAcuerdo } from "../controlador/controlAcuerdo";
import { validar } from "../autenticacion/middelwareValidacion";
import { solicitudAcuerdoSchema } from "../modelo/schemaAcuerdo";

const router = Router();

router.get("/user/:id", autenticar, obtenerAcuerdosUsuario); //Ruta para los acuerdos recibidos por el usuario
router.get("/conversacion/:id", autenticar, obtenerAcuerdosConversacion); //Ruta para los acuerdos asociados a una conversacion

router.post("/:id", autenticar, validar(solicitudAcuerdoSchema), crearSolicitarAcuerdo); //Ruta para crear una solicitud de acuerdo (id: idPublicacion)

export default router;