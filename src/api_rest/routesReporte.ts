import { Router } from "express";
import { autenticar } from "../autenticacion/GestorPermisos.js";
import { soloUsuario } from "../autenticacion/permisosUsuario.js";
import { soloModerador } from "../autenticacion/permisosModerador.js";
import { validar } from "../autenticacion/middelwareValidacion.js";
import { reportePaginationOptions, schemaCrearReporte, schemaActualizarEstadoReporte } from "../modelo/schemaReporte.js";
import { obtenerReportesPaginados, registrarNuevoReporte, obtenerReportePorId, actualizarEstadoReporte } from "../controlador/controlReporte";
import { uploadImagen } from "../servicios/middlewareMulter.js";

const router = Router();

// Reportar es una accion exclusiva de Usuario -- el panel de moderador
// resuelve reportes, no los crea.
router.post("/", autenticar, soloUsuario, uploadImagen.array("imagenes", 3), validar(schemaCrearReporte), registrarNuevoReporte);

// POST /reporte - Obtener reportes paginados (con filtros en body)
router.post("/buscar", autenticar, validar(reportePaginationOptions), soloModerador, obtenerReportesPaginados);

// GET /reporte/:id - Obtener un reporte por ID
router.get("/:id", autenticar, soloModerador, obtenerReportePorId);

// put /reporte/:id/estado - Actualizar el estado de un reporte
router.put("/:id", autenticar, soloModerador, validar(schemaActualizarEstadoReporte), actualizarEstadoReporte);

export default router;
