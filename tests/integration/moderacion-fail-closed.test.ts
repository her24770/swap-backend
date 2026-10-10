import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../../src/app";
import prisma from "../../src/persistencia/prismaClient";
import * as servicioModeracionTexto from "../../src/servicios/servicioModeracionTexto";
import {
    asegurarEstadosIniciales,
    asegurarTiposPerfilBase,
    crearModeradorTest,
    crearUsuarioTest,
    type NombreEstadoComun,
} from "../helpers";
import {
    cerrarEntornoIntegracion,
    limpiarEntornoIntegracion,
} from "./entornoIntegracion";

describe.runIf(process.env.RUN_INTEGRATION === "true")(
    "ST-TT-S9-01-3 (SWAP-603) — Moderación Fail-Closed ante caída de proveedores externos",
    () => {
        let estados: Record<NombreEstadoComun, number>;

        beforeEach(async () => {
            await limpiarEntornoIntegracion();
            estados = await asegurarEstadosIniciales([
                "activo",
                "inactivo",
                "pendiente",
                "resuelto",
                "rechazado",
                "enviado",
                "disponible",
            ]);
            await asegurarTiposPerfilBase();
        });

        afterEach(async () => {
            vi.restoreAllMocks();
            await limpiarEntornoIntegracion();
        });

        afterAll(async () => {
            await cerrarEntornoIntegracion();
        });

        it("simulando caída de OpenAI, la publicación queda retenida en estado pendiente, visible al moderador y con mensaje claro al usuario", async () => {
            // 1. Simulación de caída del proveedor de moderación externa (OpenAI)
            vi.spyOn(servicioModeracionTexto, "analizarTexto").mockRejectedValue(
                new Error("OpenAI API indisponible o timeout (503 Service Unavailable)")
            );

            // 2. Creación de entidades: usuario que publica y moderador que auditará
            const autor = await crearUsuarioTest({ nombre: "Estudiante Vendedor" });
            const moderador = await crearModeradorTest({ usuario: "moderador_seguridad" });

            // 3. El usuario intenta crear una publicación mientras el proveedor de moderación está caído
            const respuestaCrear = await request(app)
                .post("/api/v1/publicacion")
                .set("Authorization", `Bearer ${autor.token}`)
                .field("titulo", "Libro de Cálculo Diferencial")
                .field("descripcion", "Libro en excelente estado para semestre 2")
                .field("precio", "85.00")
                .field("tipo_publicacion", "material")
                .expect(201);

            // Criterio de aceptación 1: El usuario recibe un mensaje claro de que su contenido está en revisión
            expect(respuestaCrear.body.success).toBe(true);
            expect(respuestaCrear.body.message).toContain("revisión manual");
            const idPublicacion = respuestaCrear.body.data.id_publicacion;
            expect(idPublicacion).toBeDefined();

            // Criterio de aceptación 2: En la base de datos la publicación queda en estado 'pendiente' (Fail-Closed)
            const publicacionEnBd = await prisma.publicacion.findUnique({
                where: { id_publicacion: idPublicacion },
            });
            expect(publicacionEnBd).not.toBeNull();
            expect(publicacionEnBd?.estado).toBe(estados.pendiente);

            // Criterio de aceptación 3: La publicación NO está visible en el listado público (solo muestra activas)
            const listadoPublico = await request(app)
                .get("/api/v1/publicacion")
                .set("Authorization", `Bearer ${autor.token}`);

            if (listadoPublico.status === 200) {
                const existeEnPublico = (listadoPublico.body.data?.publicaciones ?? []).some(
                    (p: { id_publicacion: number }) => p.id_publicacion === idPublicacion
                );
                expect(existeEnPublico).toBe(false);
            } else {
                // Si la BD no tiene ninguna otra publicación activa, el endpoint devuelve 404
                expect(listadoPublico.status).toBe(404);
            }

            // Criterio de aceptación 4: La publicación retenida SÍ es visible para el moderador en su bandeja de pendientes
            const listadoModerador = await request(app)
                .get("/api/v1/moderador/publicaciones?estado=pendiente")
                .set("Authorization", `Bearer ${moderador.token}`)
                .expect(200);

            expect(listadoModerador.body.success).toBe(true);
            const encontradaEnModeracion = listadoModerador.body.data.publicaciones.find(
                (p: { id_publicacion: number }) => p.id_publicacion === idPublicacion
            );
            expect(encontradaEnModeracion).toBeDefined();
            expect(encontradaEnModeracion.titulo).toBe("Libro de Cálculo Diferencial");

            // Criterio de aceptación 5: El moderador aprueba la publicación manualmente y pasa a estado 'activo'
            const respuestaAprobar = await request(app)
                .patch(`/api/v1/moderador/publicaciones/${idPublicacion}/reactivar`)
                .set("Authorization", `Bearer ${moderador.token}`)
                .send({
                    motivo: "Verificación manual aprobada",
                    detalle: "Contenido legítimo verificado por moderador tras caída de OpenAI",
                })
                .expect(200);

            expect(respuestaAprobar.body.success).toBe(true);
            expect(respuestaAprobar.body.data.estado_nombre).toBe("activo");

            const publicacionAprobadaBd = await prisma.publicacion.findUnique({
                where: { id_publicacion: idPublicacion },
            });
            expect(publicacionAprobadaBd?.estado).toBe(estados.activo);

            // Una vez aprobada por el moderador, ahora SÍ aparece en el listado público
            const listadoPublicoDespues = await request(app)
                .get("/api/v1/publicacion")
                .set("Authorization", `Bearer ${autor.token}`)
                .expect(200);

            const existeEnPublicoDespues = (listadoPublicoDespues.body.data?.publicaciones ?? []).some(
                (p: { id_publicacion: number }) => p.id_publicacion === idPublicacion
            );
            expect(existeEnPublicoDespues).toBe(true);
        });
    }
);
