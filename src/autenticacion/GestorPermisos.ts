import { Request, Response, NextFunction } from "express";
import { ServicioJWT, TokenVerificado } from "./ServicioJWT.js";
import { estaRevocado } from "./blacklist.js";

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
    res.status(401).json({ message: "Token de autenticación requerido." });
    return;
  }

  try {
    const revocado = await estaRevocado(token);
    if (revocado) {
      res.status(401).json({ message: "Sesión cerrada. Por favor inicia sesión nuevamente." });
      return;
    }
    req.usuario = ServicioJWT.verificarToken(token);
    next();
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Token inválido.";
    res.status(401).json({ message: mensaje });
  }
}

// ─── Middleware: verificar rol ────────────────────────────────────────────────

export function gestorPermisos(...rolesPermitidos: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const rol = req.usuario?.rol;

    if (!rol || !rolesPermitidos.includes(rol)) {
      res.status(403).json({ message: "No tienes permisos para realizar esta acción." });
      return;
    }

    next();
  };
}


// Middleware: verificar si id dentro del token es igual al id de la ruta
export function verificarPropietario(req: Request, res: Response, next: NextFunction): void {
  const id = req.params.id; // id de la ruta
  const idToken = req.usuario?.sub; // id del token

  if (!idToken) {
    res.status(401).json({ message: "Token de autenticación requerido." });
    return;
  }

  //Si el id dentro del token y el id de la ruta no son iguales, se lanza un error
  if (id !== idToken) {
    res.status(403).json({ message: "No tienes permisos para realizar esta acción." });
    return;
  }

  next(); // si todo esta bien, se pasa al siguiente middleware
}