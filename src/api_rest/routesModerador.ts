import { Router } from "express";
import { validar } from "../autenticacion/middelwareValidacion.js";
import { schemaLoginModerador, schemaCrearModerador, schemaEditarModerador } from "../modelo/schemaModerador.js";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { soloModerador, soloSuperadmin } from "../autenticacion/permisosModerador.js";
import {
    iniciarSesionModerador,
    obtenerSesionModeradorActual,
    crearModerador,
    listarModeradores,
    editarModerador,
    eliminarModeradorController,
} from "../controlador/controlModerador.js";
import {
    bajarPublicacionModeracion,
    eliminarPublicacionModeracion,
    obtenerPublicacionesModeracion,
    reactivarPublicacionModeracion,
} from "../controlador/controlPublicacion.js";
import {
    cambiarEstadoUsuario,
    cambiarEstadoModerador,
    crearAdvertenciaUsuario,
} from "../controlador/controlGestionCuentas.js";

const router = Router();

// Login separado del de Usuario (POST /api/auth/login)
router.post("/login", validar(schemaLoginModerador), iniciarSesionModerador);

// Endpoint base del panel: confirma sesion + rol antes de dar acceso.
// soloModerador deja pasar cualquier nivel (moderador o superadmin).
router.get("/me", autenticar, soloModerador, obtenerSesionModeradorActual);

// Gestion de moderadores: exclusiva de superadmin.
router.post("/", autenticar, soloSuperadmin, validar(schemaCrearModerador), crearModerador);
router.get("/", autenticar, soloSuperadmin, listarModeradores);
router.patch("/:id", autenticar, soloSuperadmin, validar(schemaEditarModerador), editarModerador);
router.delete("/:id", autenticar, soloSuperadmin, eliminarModeradorController);

// Bloqueo/suspension de cuentas (SWAP-421/422) y advertencias (SWAP-416).
// Usuario: cualquier moderador. Moderador (otro): exclusivo de superadmin.
router.patch("/usuarios/:id/estado", autenticar, soloModerador, cambiarEstadoUsuario);
router.post("/usuarios/:id/advertencia", autenticar, soloModerador, crearAdvertenciaUsuario);
router.patch("/:id/estado", autenticar, soloSuperadmin, cambiarEstadoModerador);

// A partir de aca se registran las rutas propias del resto de funcionalidad
// de moderacion (reportes, bloqueo de cuentas, advertencias, etc.),
// usando soloModerador o soloSuperadmin segun corresponda.
router.get("/publicaciones", autenticar, soloModerador, obtenerPublicacionesModeracion);
router.patch("/publicaciones/:id/bajar", autenticar, soloModerador, bajarPublicacionModeracion);
router.patch("/publicaciones/:id/reactivar", autenticar, soloModerador, reactivarPublicacionModeracion);
router.delete("/publicaciones/:id", autenticar, soloModerador, eliminarPublicacionModeracion);

export default router;
