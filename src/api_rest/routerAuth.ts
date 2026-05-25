import { Router } from "express";
import { validar } from "../autenticacion/middelwareValidacion.js";
import { schemaRegistro, schemaLogin } from "../modelo/schemaAuth.js";
import { registro, iniciarSesion, cerrarSesion, obtenerSesionActual } from "../controlador/controlAuth.js";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { moderarTexto } from "../autenticacion/middlewareModeracion.js";

const router = Router();

//Ruta para registrar un nuevo usuario
router.post("/register", validar(schemaRegistro), moderarTexto(['descripcion']), registro);

//Ruta para iniciar sesión
router.post("/login", validar(schemaLogin), iniciarSesion);

//Ruta para obtener la sesión actual a partir de la cookie
router.get("/me", autenticar, obtenerSesionActual);

//Ruta para cerrar sesión
router.post("/logout", cerrarSesion);

export default router;
