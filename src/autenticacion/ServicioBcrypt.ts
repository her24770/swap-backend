import bcrypt from "bcrypt";

// ─── Configuración ───────────────────────────────────────────────────────────

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS ?? "10");

// ─── Servicio ─────────────────────────────────────────────────────────────────

export const ServicioBcrypt = {
  /**
   * Hashea una contrasena antes de guardarla en Base de Datos
   */
  async hashearPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  },

  /**
   * Compara una contraseña en texto plano con su hash almacenado.
   * Retorna true si coinciden, false si no.
   */
  async compararPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  },
};