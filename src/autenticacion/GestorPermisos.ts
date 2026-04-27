import { Request, Response, NextFunction } from "express";
import { ServicioJWT, TokenVerificado } from "./ServicioJWT.js";

// ─── Extensión del tipo Request ───────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      usuario?: TokenVerificado;
    }
  }
}

// ─── Middleware: verificar JWT ────────────────────────────────────────────────

export function autenticar(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Token de autenticación requerido." });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
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