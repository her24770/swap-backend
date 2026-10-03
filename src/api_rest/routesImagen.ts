import { Router } from "express";
import { subirImagen, subirFotoPerfil } from "../controlador/controlImagen.js";
import { autenticar, verificarPropietario } from "../autenticacion/GestorPermisos.js";
import { soloUsuario } from "../autenticacion/permisosUsuario.js";
import { uploadImagen } from "../servicios/middlewareMulter.js";
import { moderarImagenes } from "../autenticacion/middlewareModeracion.js";

const router = Router();

// POST /api/imagen/upload?carpeta=general
router.post("/upload", autenticar, uploadImagen.single("imagen"), moderarImagenes, subirImagen);

// PUT /api/imagen/perfil/:id
router.put("/perfil/:id", autenticar, verificarPropietario, soloUsuario, uploadImagen.single("imagen"), moderarImagenes, subirFotoPerfil);

export default router;
