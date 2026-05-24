import { Router } from "express";
import {
        obtenerAnunciosUsuario, 
        obtenerTodosLosAnuncios, 
        crearAnuncioUsuario, 
        editarAnuncioUsuario, 
        eliminarAnuncioUsuario 
} from "../controlador/controlAnuncio.js";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { uploadImagen } from "../servicios/middlewareMulter.js";
import { validar } from "../autenticacion/middelwareValidacion.js";
import { schemaCrearAnuncio, schemaEditarAnuncio } from "../modelo/schemaAnuncio.js";

const router = Router();

router.get("/user/:id_usuario", autenticar, obtenerAnunciosUsuario);
router.get("/", autenticar, obtenerTodosLosAnuncios);
router.post("/", autenticar, uploadImagen.single('imagen'), validar(schemaCrearAnuncio), crearAnuncioUsuario);
router.put("/:id_anuncio", autenticar, uploadImagen.single('imagen'), validar(schemaEditarAnuncio), editarAnuncioUsuario);
router.delete("/:id_anuncio", autenticar, eliminarAnuncioUsuario);

export default router;