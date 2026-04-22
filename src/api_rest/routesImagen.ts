import { Router } from "express";
import { subirImagen, subirFotoPerfil, subirFotoPublicacion } from "../controlador/controlImagen.js";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { uploadImagen } from "../servicios/middlewareMulter.js";

const router = Router();

// POST /api/imagen/upload?carpeta=general
// Body: multipart/form-data con campo "imagen"
// Para subidas genéricas con nombre aleatorio
router.post("/upload", autenticar, uploadImagen.single("imagen"), subirImagen);

// PUT /api/imagen/perfil/:id
// Sube/reemplaza foto de perfil (user_id.png)
// Si existe, la elimina primero
router.put("/perfil/:id", autenticar, uploadImagen.single("imagen"), subirFotoPerfil);

// PUT /api/imagen/publicacion/:id
// Sube/reemplaza foto de publicación (post_id.png)
// Si existe, la elimina primero
router.put("/publicacion/:id", autenticar, uploadImagen.single("imagen"), subirFotoPublicacion);

export default router;
