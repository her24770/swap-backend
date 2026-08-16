import { Router } from "express";
import { autenticar, gestorPermisos } from "../autenticacion/GestorPermisos.js";
import { soloUsuario } from "../autenticacion/permisosUsuario.js";
import { validar } from "../autenticacion/middelwareValidacion.js";
import { reportePaginationOptions } from "../modelo/schemaReporte.js";
import { obtenerReportesPaginados, registrarNuevoReporte, obtenerReportePorId } from "../controlador/controlReporte";

const router = Router();

// Reportar es una accion exclusiva de Usuario -- el panel de moderador
// resuelve reportes, no los crea.
router.post("/", autenticar, soloUsuario, registrarNuevoReporte);

// GET /reporte - Obtener reportes paginados (con filtros en body)
router.get("/", autenticar, validar(reportePaginationOptions), gestorPermisos('moderador'), obtenerReportesPaginados);

// GET /reporte/:id - Obtener un reporte por ID
router.get("/:id", autenticar, gestorPermisos('moderador'), obtenerReportePorId);

export default router;
