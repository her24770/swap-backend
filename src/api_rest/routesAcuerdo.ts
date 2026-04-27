import { Router } from "express";
import { autenticar } from "../autenticacion/GestorPermisos";
import { obtenerAcuerdosUsuario } from "../controlador/controlAcuerdo";

const router = Router();

router.get("/user/:id", autenticar, obtenerAcuerdosUsuario); //Ruta para los acuerdos recibidos por el usuario

export default router;