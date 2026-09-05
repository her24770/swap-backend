import cors from "cors";
import multer from "multer";
import routes from "./api_rest/routes";
import swaggerRoutes from "./openapi/swagger";
import cookieParser from "cookie-parser";
import express, { NextFunction, Request, Response } from "express";
import { rateLimitGlobal } from "./autenticacion/rateLimiter.js";

const app = express();

app.use((_req, res, next) => {
    res.setHeader("X-API-Version", "1");
    next();
});

app.use(cookieParser());
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
}));
app.use("/api", rateLimitGlobal);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", swaggerRoutes);
app.use("/api", routes);
app.use("/api/v1", swaggerRoutes);
app.use("/api/v1", routes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof multer.MulterError) {
        res.status(400).json({ success: false, message: `Error de archivo: ${err.message}` });
        return;
    }
    console.error(err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
});

export default app;
