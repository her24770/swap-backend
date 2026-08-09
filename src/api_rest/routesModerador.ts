import { Router } from "express";
import { validar } from "../autenticacion/middelwareValidacion.js";
import { schemaLoginModerador } from "../modelo/schemaModerador.js";
import { autenticar, gestorPermisos } from "../autenticacion/GestorPermisos.js";
import { iniciarSesionModerador, obtenerSesionModeradorActual } from "../controlador/controlModerador.js";

const router = Router();

// Login separado del de Usuario (POST /api/auth/login)
router.post("/login", validar(schemaLoginModerador), iniciarSesionModerador);

// Endpoint base del panel: confirma sesion + rol antes de dar acceso.
// A partir de aca se registran las rutas propias de cada funcionalidad
// de moderacion (reportes, bloqueo de cuentas, advertencias, etc.).
router.get("/me", autenticar, gestorPermisos("moderador"), obtenerSesionModeradorActual);

export default router;
