import cors from "cors";
import multer from "multer";
import helmet from "helmet";
import routes from "./api_rest/routes";
import swaggerRoutes from "./openapi/swagger";
import cookieParser from "cookie-parser";
import express, { NextFunction, Request, Response } from "express";
import { rateLimitGlobal } from "./autenticacion/rateLimiter.js";

const app = express();

app.use(cookieParser());
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
}));

// Fix BG-19: cabeceras HTTP defensivas (HSTS, X-Content-Type-Options,
// X-Frame-Options/frame-ancestors, Referrer-Policy, etc.). CSP se configura
// aparte más abajo, porque Swagger UI necesita scripts/estilos inline y no
// puede vivir bajo la misma política estricta que el resto de la API.
app.use(helmet({
    contentSecurityPolicy: false,
    // La API es JSON puro consumido desde otro origen (el frontend) — no
    // debe restringirse por Cross-Origin-Resource-Policy.
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// CSP estricta para toda la API JSON. Se excluye /api/docs y
// /api/openapi.json (Swagger UI) porque esa UI sí necesita scripts/estilos
// inline para funcionar — swagger-ui-express recomienda excluir CSP ahí.
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/docs") || req.path === "/openapi.json") {
        next();
        return;
    }
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: ["'none'"],
            frameAncestors: ["'none'"],
        },
    })(req, res, next);
});

app.use("/api", rateLimitGlobal);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Fix BG-20: Swagger/OpenAPI describe cada endpoint, sus parámetros y sus
// modelos — es un mapa completo de la superficie de ataque de la API. No
// tiene sentido exponerlo sin condición en producción; solo se monta fuera
// de production. Si el equipo prefiere mantenerlo accesible en producción
// para uso interno, la alternativa es montarlo igual pero protegido con
// `autenticar + soloModerador` en vez de quitarlo por completo.
if (process.env.NODE_ENV !== "production") {
    app.use("/api", swaggerRoutes);
}
app.use("/api", routes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof multer.MulterError) {
        res.status(400).json({ success: false, message: `Error de archivo: ${err.message}` });
        return;
    }
    console.error(err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
});

export default app;
