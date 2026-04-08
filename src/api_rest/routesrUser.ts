import { Router } from "express";
import { obtenerUsuario, actualizarPerfil, agregarContacto, obtenerContactos } from "../controlador/controlUsuario.js";

const router = Router();

//Ruta para obtener datos del usuario así como sus publicaciones
router.get("/:id", obtenerUsuario);

//Ruta para actualizar datos del usuario
router.patch("/:id", actualizarPerfil);

//Ruta para agregar un contacto al usuario
router.post("/contactos/:id", agregarContacto);

//Ruta para obtener los contactos del usuario
router.get("/contactos/:id", obtenerContactos);

export default router;