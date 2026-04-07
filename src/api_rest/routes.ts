import { Router } from "express";
import authRoutes from "./routerAuth.js";
import userRoutes from "./routesrUser.js";

const router = Router();

//Ruta de prueba
router.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});

//Rutas de autenticación
router.use("/auth", authRoutes);
router.use("/user", userRoutes);

export default router;