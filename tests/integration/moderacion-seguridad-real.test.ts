import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import app from "../../src/app";
import prisma from "../../src/persistencia/prismaClient";
import {
    asegurarEstadosIniciales,
    crearModeradorTest,
    crearPublicacionTest,
    crearUsuarioTest,
    type NombreEstadoComun,
} from "../helpers";
import {
    cerrarEntornoIntegracion,
    limpiarEntornoIntegracion,
} from "./entornoIntegracion";

describe.runIf(process.env.RUN_INTEGRATION === "true")(
    "TEST-06 real — moderación y seguridad con PostgreSQL/Redis",
    () => {
        let estados: Record<NombreEstadoComun, number>;

        beforeEach(async () => {
            // Limpieza completa del entorno y garantía de aislamiento de datos
            await limpiarEntornoIntegracion();
            estados = await asegurarEstadosIniciales([
                "activo",
                "inactivo",
                "pendiente",
                "resuelto",
                "rechazado",
                "enviado",
            ]);
        });

        afterEach(async () => {
            await limpiarEntornoIntegracion();
        });

        afterAll(async () => {
            await cerrarEntornoIntegracion();
        });

        it("IT-26 (Escenario A): reporta una publicación, verifica referencia válida y gestiona/resuelve el reporte desde moderación", async () => {
            // 1. Preparación de entidades: Autor con publicación activa, usuario denunciante y moderador
            const autor = await crearUsuarioTest({ nombre: "Autor Publicacion" });
            const denunciante = await crearUsuarioTest({ nombre: "Usuario Denunciante" });
            const moderador = await crearModeradorTest({ usuario: "mod_seguridad_a" });

            const publicacion = await crearPublicacionTest({
                id_usuario: autor.id_usuario,
                titulo: "Calculadora Científica Avanzada",
                descripcion: "Vendo calculadora científica poco uso",
                precio: "150.00",
                estado: estados.activo,
            });

            // 2. El usuario denunciante reporta la publicación a través del endpoint REST real
            const respuestaCrearReporte = await request(app)
                .post("/api/v1/reportes")
                .set("Authorization", `Bearer ${denunciante.token}`)
                .send({
                    tipo_objetivo: "publicacion",
                    id_objetivo: publicacion.id_publicacion,
                    motivo: "Publica contenido inapropiado",
                    detalle: "La publicación contiene información presuntamente fraudulenta sobre el producto.",
                })
                .expect(201);

            expect(respuestaCrearReporte.body.success).toBe(true);
            const idReporte = respuestaCrearReporte.body.data.id_reporte;
            expect(idReporte).toBeDefined();

            // 3. Verificación de persistencia y consistencia en PostgreSQL
            const reporteEnDb = await prisma.reporte.findUnique({
                where: { id_reporte: idReporte },
                include: { estadoRel: true, motivoRel: true },
            });
            expect(reporteEnDb).not.toBeNull();
            expect(reporteEnDb?.id_emisor).toBe(denunciante.id_usuario);
            expect(reporteEnDb?.id_receptor).toBe(autor.id_usuario);
            expect(reporteEnDb?.id_publicacion).toBe(publicacion.id_publicacion);
            expect(reporteEnDb?.estado).toBe(estados.pendiente);
            expect(reporteEnDb?.motivoRel.motivo).toBe("Publica contenido inapropiado");

            const autorActualizado = await prisma.usuario.findUnique({
                where: { id_usuario: autor.id_usuario },
            });
            expect(autorActualizado?.reportes_recibidos).toBe(1);

            // 4 y 5. El moderador consulta los reportes pendientes y el reporte creado aparece en la lista
            const consultaPendientes = await request(app)
                .post("/api/v1/reportes/buscar")
                .set("Authorization", `Bearer ${moderador.token}`)
                .send({ estado: "pendiente" })
                .expect(200);

            expect(consultaPendientes.body.success).toBe(true);
            const reporteEncontrado = consultaPendientes.body.data.reportes.find(
                (r: { id_reporte: number }) => r.id_reporte === idReporte,
            );
            expect(reporteEncontrado).toBeDefined();
            expect(reporteEncontrado.tipo).toBe("Publicación");
            expect(reporteEncontrado.estado).toBe("pendiente");
            expect(reporteEncontrado.emisor.nombre).toBe(denunciante.nombre);
            expect(reporteEncontrado.receptor.nombre).toBe(autor.nombre);

            // 6. El moderador consulta el detalle del reporte y verifica la referencia correcta a la publicación
            const detalleReporte = await request(app)
                .get(`/api/v1/reportes/${idReporte}`)
                .set("Authorization", `Bearer ${moderador.token}`)
                .expect(200);

            expect(detalleReporte.body.success).toBe(true);
            expect(detalleReporte.body.data.id_publicacion).toBe(publicacion.id_publicacion);
            expect(detalleReporte.body.data.publicacion).toEqual(
                expect.objectContaining({
                    id_publicacion: publicacion.id_publicacion,
                    titulo: publicacion.titulo,
                    estadoRel: expect.objectContaining({ estado: "activo" }),
                }),
            );
            expect(detalleReporte.body.data.emisor.id_usuario).toBe(denunciante.id_usuario);
            expect(detalleReporte.body.data.receptor.id_usuario).toBe(autor.id_usuario);

            // 7. El moderador gestiona y resuelve el reporte cambiando su estado a 'resuelto'
            const respuestaActualizar = await request(app)
                .patch(`/api/v1/reportes/${idReporte}/estado`)
                .set("Authorization", `Bearer ${moderador.token}`)
                .send({ estado: "resuelto" })
                .expect(200);

            expect(respuestaActualizar.body.success).toBe(true);
            expect(respuestaActualizar.body.data.estado).toBe(estados.resuelto);

            // 8. Al consultar los reportes resueltos, el reporte aparece con el estado actualizado
            const consultaResueltos = await request(app)
                .post("/api/v1/reportes/buscar")
                .set("Authorization", `Bearer ${moderador.token}`)
                .send({ estado: "resuelto" })
                .expect(200);

            expect(consultaResueltos.body.success).toBe(true);
            const reporteResuelto = consultaResueltos.body.data.reportes.find(
                (r: { id_reporte: number }) => r.id_reporte === idReporte,
            );
            expect(reporteResuelto).toBeDefined();
            expect(reporteResuelto.estado).toBe("resuelto");

            // 9. Al consultar nuevamente los pendientes, el reporte ya no figura como pendiente
            const consultaPendientesDespues = await request(app)
                .post("/api/v1/reportes/buscar")
                .set("Authorization", `Bearer ${moderador.token}`)
                .send({ estado: "pendiente" })
                .expect(200);

            const existeEnPendientes = consultaPendientesDespues.body.data.reportes.some(
                (r: { id_reporte: number }) => r.id_reporte === idReporte,
            );
            expect(existeEnPendientes).toBe(false);

            // 10. Comprobar consistencia final directa en la base de datos
            const reporteDbFinal = await prisma.reporte.findUnique({
                where: { id_reporte: idReporte },
                include: { estadoRel: true, publicacion: true },
            });
            expect(reporteDbFinal?.estadoRel.estado).toBe("resuelto");
            expect(reporteDbFinal?.id_publicacion).toBe(publicacion.id_publicacion);
        });

        it("IT-26 (Escenario B): reporta un usuario, verifica referencia directa y gestiona/resuelve el reporte desde moderación", async () => {
            // 1. Preparación de entidades: Usuario denunciado, usuario denunciante y moderador
            const denunciado = await crearUsuarioTest({ nombre: "Usuario Denunciado" });
            const denunciante = await crearUsuarioTest({ nombre: "Usuario Reportador" });
            const moderador = await crearModeradorTest({ usuario: "mod_seguridad_b" });

            // 2. El usuario denunciante reporta directamente a otro usuario
            const respuestaCrearReporte = await request(app)
                .post("/api/v1/reportes")
                .set("Authorization", `Bearer ${denunciante.token}`)
                .send({
                    tipo_objetivo: "usuario",
                    id_objetivo: denunciado.id_usuario,
                    motivo: "Cuenta falsa o suplantación de identidad",
                    detalle: "El perfil utiliza datos de contacto que pertenecen a otra persona.",
                })
                .expect(201);

            expect(respuestaCrearReporte.body.success).toBe(true);
            const idReporte = respuestaCrearReporte.body.data.id_reporte;
            expect(idReporte).toBeDefined();

            // Verificación de persistencia en BD
            const reporteEnDb = await prisma.reporte.findUnique({
                where: { id_reporte: idReporte },
                include: { estadoRel: true, motivoRel: true },
            });
            expect(reporteEnDb).not.toBeNull();
            expect(reporteEnDb?.id_emisor).toBe(denunciante.id_usuario);
            expect(reporteEnDb?.id_receptor).toBe(denunciado.id_usuario);
            expect(reporteEnDb?.id_publicacion).toBeNull();
            expect(reporteEnDb?.id_mensaje).toBeNull();
            expect(reporteEnDb?.estado).toBe(estados.pendiente);

            const denunciadoActualizado = await prisma.usuario.findUnique({
                where: { id_usuario: denunciado.id_usuario },
            });
            expect(denunciadoActualizado?.reportes_recibidos).toBe(1);

            // 3 y 4. El moderador recupera el reporte pendiente y comprueba el tipo y referencias
            const consultaPendientes = await request(app)
                .post("/api/v1/reportes/buscar")
                .set("Authorization", `Bearer ${moderador.token}`)
                .send({ estado: "pendiente", tipo: "usuario" })
                .expect(200);

            expect(consultaPendientes.body.success).toBe(true);
            const reporteEncontrado = consultaPendientes.body.data.reportes.find(
                (r: { id_reporte: number }) => r.id_reporte === idReporte,
            );
            expect(reporteEncontrado).toBeDefined();
            expect(reporteEncontrado.tipo).toBe("Usuario");
            expect(reporteEncontrado.estado).toBe("pendiente");
            expect(reporteEncontrado.receptor.nombre).toBe(denunciado.nombre);

            // Consulta por ID para verificar que la referencia es exclusivamente el usuario
            const detalleReporte = await request(app)
                .get(`/api/v1/reportes/${idReporte}`)
                .set("Authorization", `Bearer ${moderador.token}`)
                .expect(200);

            expect(detalleReporte.body.success).toBe(true);
            expect(detalleReporte.body.data.receptor.id_usuario).toBe(denunciado.id_usuario);
            expect(detalleReporte.body.data.receptor.nombre).toBe(denunciado.nombre);
            expect(detalleReporte.body.data.id_publicacion).toBeNull();
            expect(detalleReporte.body.data.id_mensaje).toBeNull();

            // 5. El moderador gestiona y resuelve el reporte
            const respuestaActualizar = await request(app)
                .patch(`/api/v1/reportes/${idReporte}/estado`)
                .set("Authorization", `Bearer ${moderador.token}`)
                .send({ estado: "resuelto" })
                .expect(200);

            expect(respuestaActualizar.body.success).toBe(true);
            expect(respuestaActualizar.body.data.estado).toBe(estados.resuelto);

            // 6. El reporte aparece entre los resueltos
            const consultaResueltos = await request(app)
                .post("/api/v1/reportes/buscar")
                .set("Authorization", `Bearer ${moderador.token}`)
                .send({ estado: "resuelto" })
                .expect(200);

            expect(consultaResueltos.body.success).toBe(true);
            const reporteResuelto = consultaResueltos.body.data.reportes.find(
                (r: { id_reporte: number }) => r.id_reporte === idReporte,
            );
            expect(reporteResuelto).toBeDefined();
            expect(reporteResuelto.estado).toBe("resuelto");

            // 7. Deja de aparecer entre los pendientes
            const consultaPendientesDespues = await request(app)
                .post("/api/v1/reportes/buscar")
                .set("Authorization", `Bearer ${moderador.token}`)
                .send({ estado: "pendiente" })
                .expect(200);

            const existeEnPendientes = consultaPendientesDespues.body.data.reportes.some(
                (r: { id_reporte: number }) => r.id_reporte === idReporte,
            );
            expect(existeEnPendientes).toBe(false);

            // 8. El estado final almacenado en PostgreSQL es consistente
            const reporteDbFinal = await prisma.reporte.findUnique({
                where: { id_reporte: idReporte },
                include: { estadoRel: true, receptor: true },
            });
            expect(reporteDbFinal?.estadoRel.estado).toBe("resuelto");
            expect(reporteDbFinal?.receptor.id_usuario).toBe(denunciado.id_usuario);
        });
    },
);
