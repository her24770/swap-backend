import { Router } from "express";
import { autenticar } from "../autenticacion/GestorPermisos";
import { obtenerAcuerdosUsuario, obtenerAcuerdosConversacion } from "../controlador/controlAcuerdo";

const router = Router();

router.get("/user/:id", autenticar, obtenerAcuerdosUsuario); //Ruta para los acuerdos recibidos por el usuario
router.get("/conversacion/:id", autenticar, obtenerAcuerdosConversacion); //Ruta para los acuerdos asociados a una conversacion

export default router;