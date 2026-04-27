import { Router } from "express";
import { obtenerUsuario, actualizarPerfil, agregarContacto, obtenerContactos } from "../controlador/controlUsuario.js";
import { validar } from "../autenticacion/middelwareValidacion.js";
import { autenticar, gestorPermisos, verificarPropietario } from "../autenticacion/GestorPermisos.js";
import { schemaActualizarPerfil, schemaAgregarContactos } from "../modelo/schemaUsuario.js";

const router = Router();

//Ruta para obtener datos del usuario así como sus publicaciones
router.get("/:id", autenticar, obtenerUsuario);

//Ruta para actualizar datos del usuario
router.patch("/:id", autenticar, verificarPropietario, gestorPermisos("usuario", "moderador"), validar(schemaActualizarPerfil), actualizarPerfil);

//Ruta para agregar/actualizar/eliminar los contactos del usuario
router.put("/:id/contactos", autenticar, verificarPropietario, gestorPermisos("usuario", "moderador"), validar(schemaAgregarContactos), agregarContacto);

//Ruta para obtener los contactos del usuario
router.get("/:id/contactos", autenticar, obtenerContactos);

export default router;