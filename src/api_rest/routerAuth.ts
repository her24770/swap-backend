import { Router } from "express";
import { validar } from "../autenticacion/middelwareValidacion.js";
import {
    schemaForgotPassword,
    schemaLogin,
    schemaRegistro,
    schemaResetPassword,
    schemaSolicitarCodigoRegistro,
    schemaVerifyResetCode,
} from "../modelo/schemaAuth.js";
import {
    registro,
    iniciarSesion,
    cerrarSesion,
    obtenerSesionActual,
    solicitarCodigoRegistro,
    solicitarRecuperacionPassword,
    verificarCodigoRecuperacion,
    restablecerPassword,
} from "../controlador/controlAuth.js";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { soloUsuario } from "../autenticacion/permisosUsuario.js";
import { moderarTexto } from "../autenticacion/middlewareModeracion.js";

const router = Router();

//Ruta para registrar un nuevo usuario
router.post("/register", validar(schemaRegistro), moderarTexto(['descripcion']), registro);

//Ruta para enviar código de verificación antes de crear cuenta
router.post("/send-register-code", validar(schemaSolicitarCodigoRegistro), solicitarCodigoRegistro);

//Ruta para iniciar sesión
router.post("/login", validar(schemaLogin), iniciarSesion);

//Rutas para recuperación de contraseña
router.post("/forgot-password", validar(schemaForgotPassword), solicitarRecuperacionPassword);
router.post("/verify-reset-code", validar(schemaVerifyResetCode), verificarCodigoRecuperacion);
router.post("/reset-password", validar(schemaResetPassword), restablecerPassword);

//Ruta para obtener la sesión actual a partir de la cookie
router.get("/me", autenticar, soloUsuario, obtenerSesionActual);

//Ruta para cerrar sesión
router.post("/logout", cerrarSesion);

export default router;
