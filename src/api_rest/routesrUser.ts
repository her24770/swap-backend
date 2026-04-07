import { Router } from "express";

const router = Router();

//Ruta para obtener datos del usuario así como sus publicaciones
router.get("/:id", (_req, res) => {
    res.json({ message: "Users" });
});

//Ruta para actualizar datos del usuario
router.patch("/:id", (_req, res) => {
    res.json({ message: "Users" });
});

export default router;