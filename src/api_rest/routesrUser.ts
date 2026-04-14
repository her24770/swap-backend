import { Router } from "express";
import { obtenerUsuario, actualizarPerfil, agregarContacto, obtenerContactos } from "../controlador/controlUsuario.js";
import { validar } from "../autenticacion/middelwareValidacion.js";
import { schemaActualizarPerfil, schemaAgregarContactos } from "../modelo/schemaUsuario.js";

const router = Router();

//Ruta para obtener datos del usuario así como sus publicaciones
router.get("/:id", obtenerUsuario);

//Ruta para actualizar datos del usuario
router.patch("/:id", validar(schemaActualizarPerfil), actualizarPerfil);

//Ruta para agregar un contacto al usuario
router.post("/contactos/:id", validar(schemaAgregarContactos), agregarContacto);

//Ruta para obtener los contactos del usuario
router.get("/contactos/:id", obtenerContactos);

export default router;