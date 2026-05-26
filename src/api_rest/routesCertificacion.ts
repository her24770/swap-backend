import { Router } from "express";
import {
    obtenerCertificacionesDeUsuario,
    obtenerCertificacionPorId,
    crearCertificacionUsuario,
    eliminarCertificacionUsuario,
} from "../controlador/controlCertificacion.js";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { uploadPdf } from "../servicios/middlewareMulter.js";

const router = Router();

router.get("/user/:id_usuario", autenticar, obtenerCertificacionesDeUsuario);
router.get("/:id", autenticar, obtenerCertificacionPorId);
router.post("/", autenticar, uploadPdf.single("pdf"), crearCertificacionUsuario);
router.delete("/:id", autenticar, eliminarCertificacionUsuario);

export default router;
