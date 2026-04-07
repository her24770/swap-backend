import jwt, { SignOptions, JwtPayload } from "jsonwebtoken";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface PayloadToken {
  sub: string;       // ID del usuario
  email: string;
  rol?: string;
  [key: string]: unknown;
}

export type TokenVerificado = JwtPayload & PayloadToken;

// ─── Configuración ───────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRACION = process.env.JWT_EXPIRACION ?? "8h";

if (!JWT_SECRET) {
  throw new Error("La variable de entorno JWT_SECRET no está definida.");
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

export const ServicioJWT = {
  /**
   * Genera un token JWT firmado a partir del payload dado.
   * La expiración se configura con JWT_EXPIRACION (default: 8h).
   */
  generarToken(payload: PayloadToken): string {
    const opciones: SignOptions = {
      expiresIn: JWT_EXPIRACION as SignOptions["expiresIn"],
    };
    return jwt.sign(payload, JWT_SECRET as string, opciones);
  },

  /**
   * Verifica y decodifica un token JWT.
   * Lanza un error si el token es inválido o ha expirado.
   */
  verificarToken(token: string): TokenVerificado {
    try {
      return jwt.verify(token, JWT_SECRET as string) as TokenVerificado;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new Error("El token ha expirado.");
      }
      if (err instanceof jwt.JsonWebTokenError) {
        throw new Error("Token inválido.");
      }
      throw new Error("Error al verificar el token.");
    }
  },
};