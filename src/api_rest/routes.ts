import { Router } from "express";
import authRoutes from "./routerAuth.js";
import userRoutes from "./routesrUser.js";
import publicationRoutes from "./routesPublicacion.js";

const router = Router();

//Ruta de prueba
router.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});

//Rutas de autenticación
router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/publicacion", publicationRoutes);

export default router;