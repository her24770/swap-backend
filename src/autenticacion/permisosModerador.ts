import { gestorPermisos } from "./GestorPermisos.js";

/**
 * Vocabulario de permisos para el panel de moderador, sobre el mismo
 * gestorPermisos genérico (no duplica su lógica de verificación).
 *
 * Agregar un nivel nuevo en el futuro: sembrar el valor en TipoModerador
 * y, si hace falta un export nuevo acá, agregarlo con gestorPermisos(...) —
 * la verificación de rol en sí no cambia.
 */

// Cualquier nivel de moderador (moderador o superadmin)
export const soloModerador = gestorPermisos("moderador", "superadmin");

// Solo el nivel máximo
export const soloSuperadmin = gestorPermisos("superadmin");
