import { Router } from "express";
import { subirImagen, subirFotoPerfil } from "../controlador/controlImagen.js";
import { autenticar, verificarPropietario } from "../autenticacion/GestorPermisos.js";
import { uploadImagen } from "../servicios/middlewareMulter.js";

const router = Router();

// POST /api/imagen/upload?carpeta=general
router.post("/upload", autenticar, uploadImagen.single("imagen"), subirImagen);

// PUT /api/imagen/perfil/:id
router.put("/perfil/:id", autenticar, verificarPropietario, uploadImagen.single("imagen"), subirFotoPerfil);

export default router;
