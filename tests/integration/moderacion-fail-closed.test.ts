import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../../src/app";
import prisma from "../../src/persistencia/prismaClient";
import * as servicioModeracionTexto from "../../src/servicios/servicioModeracionTexto";
import * as servicioModeracionImagen from "../../src/servicios/servicioModeracionImagen";
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

const PNG_MAGIC_BYTES = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const BUFFER_PNG_VALIDO = Buffer.concat([PNG_MAGIC_BYTES, Buffer.alloc(1024)]);

function simularCaidaOpenAI(mensaje = "OpenAI API indisponible o timeout (503 Service Unavailable)") {
    return vi.spyOn(servicioModeracionTexto, "analizarTexto").mockRejectedValue(new Error(mensaje));
}

function simularCaidaRekognition(mensaje = "AWS Rekognition error de red o timeout (500 Internal Error)") {
    return vi.spyOn(servicioModeracionImagen, "analizarImagen").mockRejectedValue(new Error(mensaje));
}

describe.runIf(process.env.RUN_INTEGRATION === "true")(
    "ST-TT-S10-06-6 (SWAP-657) / SWAP-615 — Flujo completo de moderación fail-closed (aprobar y rechazar)",
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

        it("flujo de aprobación: al fallar el proveedor, la publicación queda retenida en pendiente, el moderador la aprueba y se vuelve visible", async () => {
            // 1. Simulación de caída del proveedor de moderación externa (OpenAI)
            simularCaidaOpenAI();

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

        it("flujo de rechazo: al fallar el proveedor, la publicación queda retenida, el moderador la rechaza (/bajar) y permanece no visible", async () => {
            // 1. Simulación de caída del proveedor de moderación externa (OpenAI)
            simularCaidaOpenAI();

            // 2. Creación de autor y moderador
            const autor = await crearUsuarioTest({ nombre: "Estudiante Rechazado" });
            const moderador = await crearModeradorTest({ usuario: "moderador_auditor" });

            // 3. Creación de la publicación retenida en modo cerrado
            const respuestaCrear = await request(app)
                .post("/api/v1/publicacion")
                .set("Authorization", `Bearer ${autor.token}`)
                .field("titulo", "Publicación con Contenido Sospechoso")
                .field("descripcion", "Material sujeto a revisión estricta")
                .field("precio", "45.00")
                .field("tipo_publicacion", "material")
                .expect(201);

            expect(respuestaCrear.body.success).toBe(true);
            expect(respuestaCrear.body.message).toContain("revisión manual");
            const idPublicacion = respuestaCrear.body.data.id_publicacion;
            expect(idPublicacion).toBeDefined();

            // Verificación en BD: estado inicial retenido 'pendiente'
            const publicacionRetenida = await prisma.publicacion.findUnique({
                where: { id_publicacion: idPublicacion },
            });
            expect(publicacionRetenida?.estado).toBe(estados.pendiente);

            // 4. El moderador lista pendientes y encuentra la publicación
            const listadoPendientes = await request(app)
                .get("/api/v1/moderador/publicaciones?estado=pendiente")
                .set("Authorization", `Bearer ${moderador.token}`)
                .expect(200);

            const encontrada = listadoPendientes.body.data.publicaciones.find(
                (p: { id_publicacion: number }) => p.id_publicacion === idPublicacion
            );
            expect(encontrada).toBeDefined();

            // 5. El moderador rechaza la publicación bajándola con justificante
            const respuestaRechazar = await request(app)
                .patch(`/api/v1/moderador/publicaciones/${idPublicacion}/bajar`)
                .set("Authorization", `Bearer ${moderador.token}`)
                .send({
                    motivo: "Material no académico no permitido",
                    detalle: "Rechazado en revisión manual por violar políticas de la comunidad.",
                })
                .expect(200);

            expect(respuestaRechazar.body.success).toBe(true);
            expect(respuestaRechazar.body.data.estado_nombre).toBe("inactivo");

            // 6. Verificación en BD: estado cambió a 'inactivo'
            const publicacionRechazadaBd = await prisma.publicacion.findUnique({
                where: { id_publicacion: idPublicacion },
            });
            expect(publicacionRechazadaBd?.estado).toBe(estados.inactivo);

            // 7. Verificación de notificación de moderación generada al autor
            const notificacion = await prisma.notificacion.findFirst({
                where: { id_usuario: autor.id_usuario },
                orderBy: { fecha: "desc" },
            });
            expect(notificacion).not.toBeNull();
            expect(notificacion?.mensaje).toContain("bajada por moderación");
            expect(notificacion?.mensaje).toContain("Material no académico no permitido");

            // 8. Criterio clave: La publicación rechazada NO es visible en el catálogo público
            const listadoPublico = await request(app)
                .get("/api/v1/publicacion")
                .set("Authorization", `Bearer ${autor.token}`);

            if (listadoPublico.status === 200) {
                const existeEnPublico = (listadoPublico.body.data?.publicaciones ?? []).some(
                    (p: { id_publicacion: number }) => p.id_publicacion === idPublicacion
                );
                expect(existeEnPublico).toBe(false);
            } else {
                expect(listadoPublico.status).toBe(404);
            }

            // 9. Tampoco es visible en la consulta de publicaciones del autor por tipo
            const listadoAutor = await request(app)
                .get(`/api/v1/publicacion/usuario/${autor.id_usuario}?tipo=material`)
                .set("Authorization", `Bearer ${autor.token}`);

            if (listadoAutor.status === 200) {
                const existeEnPerfilAutor = (listadoAutor.body.data ?? []).some(
                    (p: { id_publicacion: number }) => p.id_publicacion === idPublicacion
                );
                expect(existeEnPerfilAutor).toBe(false);
            }
        });

        it("cubre fallo en moderación visual (Rekognition) y controles de seguridad (RBAC y justificante obligatorio)", async () => {
            // 1. Simulación de caída de AWS Rekognition (imágenes)
            simularCaidaRekognition();

            const autor = await crearUsuarioTest({ nombre: "Usuario Con Foto" });
            const moderador = await crearModeradorTest({ usuario: "moderador_seguridad_img" });

            // 2. Al subir publicación con imagen y fallar Rekognition, se activa fail-closed
            const respuestaCrear = await request(app)
                .post("/api/v1/publicacion")
                .set("Authorization", `Bearer ${autor.token}`)
                .field("titulo", "Tutoría con Fotografía")
                .field("descripcion", "Sesiones prácticas presenciales")
                .field("precio", "120.00")
                .field("tipo_publicacion", "tutoria")
                .attach("imagenes", BUFFER_PNG_VALIDO, "foto.png")
                .expect(201);

            expect(respuestaCrear.body.success).toBe(true);
            expect(respuestaCrear.body.message).toContain("revisión manual");
            const idPublicacion = respuestaCrear.body.data.id_publicacion;
            expect(idPublicacion).toBeDefined();

            // La publicación queda en estado 'pendiente'
            const pubBd = await prisma.publicacion.findUnique({
                where: { id_publicacion: idPublicacion },
            });
            expect(pubBd?.estado).toBe(estados.pendiente);

            // 3. Control de seguridad (RBAC): Un usuario normal o el propio autor no puede auto-aprobarse
            await request(app)
                .patch(`/api/v1/moderador/publicaciones/${idPublicacion}/reactivar`)
                .set("Authorization", `Bearer ${autor.token}`)
                .send({ motivo: "Auto-aprobación no autorizada" })
                .expect(403);

            // 4. Control de seguridad (Auditoría): El moderador no puede moderar sin motivo (justificante obligatorio)
            const intentoSinMotivo = await request(app)
                .patch(`/api/v1/moderador/publicaciones/${idPublicacion}/bajar`)
                .set("Authorization", `Bearer ${moderador.token}`)
                .send({ motivo: "" })
                .expect(400);

            expect(intentoSinMotivo.body.success).toBe(false);
            expect(intentoSinMotivo.body.message).toContain("Debes indicar un motivo");
        });
    }
);
