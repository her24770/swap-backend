import { Router } from "express";
import { validar } from "../autenticacion/middelwareValidacion.js";
import { schemaRegistro, schemaLogin } from "../modelo/schemaAuth.js";
import { registro, iniciarSesion } from "../controlador/controlAuth.js";

const router = Router();

//Ruta para registrar un nuevo usuario
router.post("/register", validar(schemaRegistro), registro);

//Ruta para iniciar sesión
router.post("/login", validar(schemaLogin), iniciarSesion);

export default router;