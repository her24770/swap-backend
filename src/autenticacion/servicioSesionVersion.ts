import prisma from "../persistencia/prismaClient.js";

/**
 * Servicio de "sesion_version" — fix de BG-04.
 *
 * Solución: cada Usuario/Moderador tiene una columna `sesion_version`
 * (empieza en 1). Esa versión se incluye en el JWT al emitirlo (claim `ver`).
 * Cualquier cambio crítico incrementa la versión en BD. El middleware
 * `autenticar` compara el `ver` del token contra la versión actual — si no
 * coinciden, el token quedó obsoleto aunque su firma siga siendo válida.
 *
 * La versión se consulta directamente en la base de datos en cada request.
 * Esta comprobación es una decisión de seguridad: cachearla permitiría que
 * una lectura concurrente volviera a escribir una versión anterior después
 * de una invalidación y aceptara tokens obsoletos durante el TTL del caché.
 */

export type TipoCuenta = "usuario" | "moderador";

/**
 * Devuelve la versión de sesión actual de la cuenta directamente desde BD.
 * Devuelve null si la cuenta ya no existe (para que el llamador pueda
 * invalidar el token también en ese caso — cubre "eliminación de cuenta").
 */
export async function obtenerVersionActual(tipo: TipoCuenta, id: number): Promise<number | null> {
    const version = tipo === "usuario"
        ? (await prisma.usuario.findUnique({ where: { id_usuario: id }, select: { sesion_version: true } }))?.sesion_version
        : (await prisma.moderador.findUnique({ where: { id_moderador: id }, select: { sesion_version: true } }))?.sesion_version;

    return version ?? null;
}
