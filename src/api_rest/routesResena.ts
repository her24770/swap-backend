import { Router } from "express";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { soloUsuario } from "../autenticacion/permisosUsuario.js";
import {
    registrarNuevaResena,
    modificarResenaUsuario,
    obtenerResenasPerfil,
    eliminarResenaUsuario
} from "../controlador/controlResena";
import { validar } from "../autenticacion/middelwareValidacion.js";
import { schemaCrearResena, schemaEditarResena } from "../modelo/schemaResena.js";

const router = Router();

router.post("/", autenticar, soloUsuario, validar(schemaCrearResena), registrarNuevaResena);
router.put("/:id_resena", autenticar, soloUsuario, validar(schemaEditarResena), modificarResenaUsuario);
router.get("/usuario/:id_usuario", obtenerResenasPerfil);
router.delete("/:id_resena", autenticar, soloUsuario, eliminarResenaUsuario);

export default router;
