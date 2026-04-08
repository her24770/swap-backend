import { Router } from "express";
import { registro, iniciarSesion } from "../controlador/controlAuth.js";

const router = Router();

//Ruta para registrar un nuevo usuario
router.post("/register", registro);

//Ruta para iniciar sesión
router.post("/login", iniciarSesion);

export default router;