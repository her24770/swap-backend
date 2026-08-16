import { gestorPermisos } from "./GestorPermisos.js";

/**
 * Rutas exclusivas de Usuario (no moderador/superadmin). El id del JWT
 * (sub) puede numericamente coincidir con un id_moderador -- Usuario y
 * Moderador son tablas con secuencias independientes -- asi que cualquier
 * ruta que trate `sub` como un id_usuario propio (perfil, contactos,
 * horario, guardados, likes, etc.) debe pasar por este gate, no solo por
 * autenticar().
 */
export const soloUsuario = gestorPermisos("usuario");
