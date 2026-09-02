import { NextFunction, Request, Response } from "express";

export function marcarObsoleto(rutaAlternativa: string, metodoAlternativo = "PATCH") {
    return (req: Request, res: Response, next: NextFunction): void => {
        const rutaResuelta = rutaAlternativa.replace(/:([A-Za-z0-9_]+)/g, (_segmento, parametro: string) =>
            req.params[parametro] === undefined ? `:${parametro}` : String(req.params[parametro]),
        );
        res.setHeader("Deprecation", "true");
        res.setHeader("Warning", `299 - "Ruta obsoleta; usar ${metodoAlternativo} ${rutaResuelta}"`);
        res.setHeader("Link", `<${rutaResuelta}>; rel="successor-version"`);
        next();
    };
}
