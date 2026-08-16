import { Router } from "express";
import { obtenerUsuario, obtenerPerfilPublico, actualizarPerfil, agregarContacto, obtenerContactos, obtenerTutoresPorFiltros } from "../controlador/controlUsuario.js";
import { validar } from "../autenticacion/middelwareValidacion.js";
import { autenticar, verificarPropietario } from "../autenticacion/GestorPermisos.js";
import { soloUsuario } from "../autenticacion/permisosUsuario.js";
import { schemaActualizarPerfil, schemaAgregarContactos, schemaFiltrosTutor } from "../modelo/schemaUsuario.js";
import { moderarTexto } from "../autenticacion/middlewareModeracion.js";

const router = Router();

//Ruta para obtener el perfil público de un usuario
router.get("/:id/perfil-publico", obtenerPerfilPublico);

//Ruta para obtener datos del usuario así como sus publicaciones
router.get("/:id", autenticar, obtenerUsuario);

//Ruta para actualizar datos del usuario
router.patch("/:id", autenticar, verificarPropietario, soloUsuario, validar(schemaActualizarPerfil), moderarTexto(['descripcion']), actualizarPerfil);

//Ruta para agregar/actualizar/eliminar los contactos del usuario
router.put("/:id/contactos", autenticar, verificarPropietario, soloUsuario, validar(schemaAgregarContactos), agregarContacto);

//Ruta para obtener los contactos del usuario
router.get("/:id/contactos", autenticar, obtenerContactos);

//Ruta para obtener tutores por filtros
router.post("/tutores/buscar", autenticar, validar(schemaFiltrosTutor), obtenerTutoresPorFiltros);

export default router;
