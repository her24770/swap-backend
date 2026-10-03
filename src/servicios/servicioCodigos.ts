import { randomInt } from "crypto";

export const TIEMPO_EXPIRACION_CODIGO_SEGUNDOS = 10 * 60;

export function generarCodigoVerificacion(): string {
    return randomInt(100000, 1000000).toString();
}

export function construirClaveRecuperacionPassword(email: string): string {
    return `reset:${email.toLowerCase()}`;
}

export function construirClaveVerificacionRegistro(email: string): string {
    return `register:${email.toLowerCase()}`;
}
