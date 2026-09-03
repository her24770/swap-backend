import { Request, Response, NextFunction } from "express";
import { ServicioJWT, TokenVerificado } from "./ServicioJWT.js";
import { estaRevocado } from "./blacklist.js";
import { obtenerVersionActual, TipoCuenta } from "./servicioSesionVersion.js";
import { errorResponse } from "../servicios/Response.js";

// ─── Extensión del tipo Request ───────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      usuario?: TokenVerificado;
    }
  }
}

// ─── Middleware: verificar JWT ────────────────────────────────────────────────

export async function autenticar(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token =
    req.cookies?.["swap-token"] ??
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null);

  if (!token) {
    errorResponse(res, "Token de autenticación requerido.", 401);
    return;
  }

  try {
    const revocado = await estaRevocado(token);
    if (revocado) {
      errorResponse(res, "Sesión cerrada. Por favor inicia sesión nuevamente.", 401);
      return;
    }

    const usuarioToken = ServicioJWT.verificarToken(token);

    // Fix BG-04: la firma/expiración del JWT ya no son suficientes — hay que
    // confirmar que nada crítico cambió en la cuenta desde que se emitió.
    const tipo: TipoCuenta = usuarioToken.rol === "usuario" ? "usuario" : "moderador";
    const idCuenta = Number(usuarioToken.sub);
    const versionActual = await obtenerVersionActual(tipo, idCuenta);

    if (versionActual === null) {
      // La cuenta ya no existe (eliminada).
      errorResponse(res, "Sesión inválida. Por favor inicia sesión nuevamente.", 401);
      return;
    }

    if (usuarioToken.ver !== versionActual) {
      // Password reset, bloqueo/suspensión/reactivación, o cambio de nivel
      // desde que se emitió este token.
      errorResponse(res, "Sesión inválida. Por favor inicia sesión nuevamente.", 401);
      return;
    }

    req.usuario = usuarioToken;
    next();
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Token inválido.";
    errorResponse(res, mensaje, 401);
  }
}

// ─── Middleware: verificar rol ────────────────────────────────────────────────

export function gestorPermisos(...rolesPermitidos: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const rol = req.usuario?.rol;

    if (!rol || !rolesPermitidos.includes(rol)) {
      errorResponse(res, "No tienes permisos para realizar esta acción.", 403);
      return;
    }

    next();
  };
}


// Middleware: verificar si id dentro del token es igual al id de la ruta
export function verificarPropietario(req: Request, res: Response, next: NextFunction): void {
  const id = req.params.id ?? req.params.usuarioId; // id de la ruta
  const idToken = req.usuario?.sub; // id del token

  if (!idToken) {
    errorResponse(res, "Token de autenticación requerido.", 401);
    return;
  }

  //Si el id dentro del token y el id de la ruta no son iguales, se lanza un error
  if (id !== idToken) {
    errorResponse(res, "No tienes permisos para realizar esta acción.", 403);
    return;
  }

  next(); // si todo esta bien, se pasa al siguiente middleware
}
