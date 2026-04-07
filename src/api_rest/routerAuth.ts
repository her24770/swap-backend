import { Router } from "express";

const router = Router();

//Ruta para registrar un nuevo usuario
router.post("/register", (_req, res) => {
    res.json({ message: "Register" });
});

//Ruta para iniciar sesión
router.post("/login", (_req, res) => {
    res.json({ message: "Login" });
});

export default router;