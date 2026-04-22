import { Router } from "express";
import authRoutes from "./routerAuth.js";
import userRoutes from "./routesrUser.js";
import publicationRoutes from "./routesPublicacion.js";
import etiquetaRoutes from "./routesEtiqueta.js";
import acuerdoRoutes from "./routesAcuerdo.js";
import imagenRoutes from "./routesImagen.js";

const router = Router();

//Ruta de prueba
router.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});

//Rutas de autenticación
router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/publicacion", publicationRoutes);
router.use("/etiqueta", etiquetaRoutes);
router.use("/acuerdo", acuerdoRoutes);
router.use("/imagen", imagenRoutes);

export default router;