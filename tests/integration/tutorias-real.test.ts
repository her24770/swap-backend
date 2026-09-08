import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import app from "../../src/app";
import prisma from "../../src/persistencia/prismaClient";
import { crearUsuarioTest, UsuarioTestFixture } from "../helpers";
import { asegurarEstadosIniciales } from "../helpers/estadoHelpers";
import { obtenerOCrearTipoPerfil } from "../helpers/tipoPerfilHelpers";
import { poolModeracion } from "../../src/servicios/servicioModerarCertificacionBackground";
import {
    cerrarEntornoIntegracion,
    limpiarEntornoIntegracion,
} from "./entornoIntegracion";

// IT-17 sube un PDF real; se mockea solo la moderación externa (OpenAI/Rekognition)
// y el almacenamiento en R2 (sin credenciales reales en este entorno). El resto
// del flujo (cola en memoria, creación en BD, notificación) corre de verdad.
vi.mock("../../src/servicios/servicioModeracionCertificacion", async () => {
    const real = await vi.importActual<typeof import("../../src/servicios/servicioModeracionCertificacion")>(
        "../../src/servicios/servicioModeracionCertificacion",
    );
    return { ...real, moderarYValidarPdfCertificacion: vi.fn().mockResolvedValue(undefined) };
});
vi.mock("../../src/servicios/servicioR2", () => ({
    subirImagenR2: vi.fn().mockResolvedValue("https://integration.invalid/certificaciones/fake.pdf"),
    eliminarImagenR2: vi.fn().mockResolvedValue(undefined),
}));

interface FixturesTutorias {
    estados: Record<"activo" | "pendiente" | "cancelado" | "completado", number>;
    estudiante: UsuarioTestFixture;
    tutor: UsuarioTestFixture;
    idEtiqueta: number;
    idPublicacionTutoria: number;
}

let fixtures: FixturesTutorias;

async function crearFixturesTutorias(): Promise<FixturesTutorias> {
    const estados = await asegurarEstadosIniciales(["activo", "pendiente", "cancelado", "completado"]);
    const tipoTutoria = await obtenerOCrearTipoPerfil("tutoria");

    const [estudiante, tutor] = await Promise.all([
        crearUsuarioTest({ nombre: "Estudiante Tutorías" }),
        crearUsuarioTest({ nombre: "Tutor Cálculo" }),
    ]);

    const etiqueta = await prisma.etiqueta.create({
        data: { nombre: "Cálculo 1", descripcion: "Materia de cálculo diferencial" },
    });

    const publicacion = await prisma.publicacion.create({
        data: {
            titulo: "Tutoría de Cálculo 1",
            descripcion: "Sesiones semanales de refuerzo",
            precio: "60.00",
            estado: estados.activo,
            tipo_publicacion: tipoTutoria.id_tipo_perfil,
            id_usuario: tutor.id_usuario,
            etiquetas: { create: { id_etiqueta: etiqueta.id_etiqueta } },
        },
    });

    return {
        estados,
        estudiante,
        tutor,
        idEtiqueta: etiqueta.id_etiqueta,
        idPublicacionTutoria: publicacion.id_publicacion,
    };
}

describe.runIf(process.env.RUN_INTEGRATION === "true")(
    "TEST-03 real — Sistema de tutorías",
    () => {
        beforeEach(async () => {
            await limpiarEntornoIntegracion();
            fixtures = await crearFixturesTutorias();
        });

        afterEach(async () => {
            await limpiarEntornoIntegracion();
        });

        afterAll(async () => {
            await cerrarEntornoIntegracion();
        });

        it("IT-13: busca tutores filtrando por materia/etiqueta y no devuelve a quien no coincide", async () => {
            // Tutor sin la etiqueta buscada — no debe aparecer en el resultado.
            const otroTutor = await crearUsuarioTest({ nombre: "Tutor Sin Materia" });
            const otraEtiqueta = await prisma.etiqueta.create({ data: { nombre: "Historia", descripcion: "Materia de historia" } });
            const tipoTutoria = await obtenerOCrearTipoPerfil("tutoria");
            await prisma.publicacion.create({
                data: {
                    titulo: "Tutoría de Historia",
                    descripcion: "No debe salir en la búsqueda de Cálculo",
                    precio: "40.00",
                    estado: fixtures.estados.activo,
                    tipo_publicacion: tipoTutoria.id_tipo_perfil,
                    id_usuario: otroTutor.id_usuario,
                    etiquetas: { create: { id_etiqueta: otraEtiqueta.id_etiqueta } },
                },
            });

            const respuesta = await request(app)
                .post("/api/v1/user/tutores/buscar")
                .set("Authorization", `Bearer ${fixtures.estudiante.token}`)
                .send({ etiquetas: [fixtures.idEtiqueta] })
                .expect(200);

            const idsTutores = respuesta.body.data.tutores.map((t: any) => t.id_usuario);
            expect(idsTutores).toEqual([fixtures.tutor.id_usuario]);
            expect(idsTutores).not.toContain(otroTutor.id_usuario);
        });

        it("IT-14: ver la disponibilidad y horario configurado de un tutor específico", async () => {
            await prisma.tiempoDisponible.create({
                data: {
                    id_usuario: fixtures.tutor.id_usuario,
                    dia: "lunes",
                    hora_inicio: new Date("1970-01-01T14:00:00Z"),
                    hora_fin: new Date("1970-01-01T16:00:00Z"),
                },
            });

            const respuesta = await request(app)
                .get(`/api/v1/horarios/${fixtures.tutor.id_usuario}`)
                .expect(200);

            expect(respuesta.body.data).toEqual([
                expect.objectContaining({ dia: "lunes", hora_inicio: "14:00", hora_fin: "16:00" }),
            ]);
        });

        it("IT-15: el estudiante solicita una tutoría y el tutor puede aceptarla; el solicitante no puede aceptar la suya", async () => {
            const conversacion = await prisma.conversacion.create({
                data: {
                    id_usuario_1: fixtures.estudiante.id_usuario,
                    id_usuario_2: fixtures.tutor.id_usuario,
                    estado_conversacion: fixtures.estados.activo,
                },
            });

            const solicitud = await request(app)
                .post(`/api/v1/acuerdo/${fixtures.idPublicacionTutoria}`)
                .set("Authorization", `Bearer ${fixtures.estudiante.token}`)
                .send({
                    id_conversacion: conversacion.id_conversacion,
                    fecha_entrega: new Date(Date.now() + 86_400_000).toISOString(),
                    lugar_entrega: "Sala virtual",
                    observaciones: "Repaso antes del examen",
                })
                .expect(201);

            const idAcuerdo = solicitud.body.data.id_acuerdo;
            expect(await prisma.acuerdo.findUnique({ where: { id_acuerdo: idAcuerdo } }).then((a) => a?.estado)).toBe(
                fixtures.estados.pendiente,
            );

            // El propio solicitante no puede aceptar/rechazar su propia solicitud.
            await request(app)
                .patch(`/api/v1/acuerdo/${idAcuerdo}/estado`)
                .set("Authorization", `Bearer ${fixtures.estudiante.token}`)
                .send({ estado: "activo" })
                .expect(403);

            // El tutor (contraparte) sí puede aceptarla.
            await request(app)
                .patch(`/api/v1/acuerdo/${idAcuerdo}/estado`)
                .set("Authorization", `Bearer ${fixtures.tutor.token}`)
                .send({ estado: "activo" })
                .expect(200);

            expect(await prisma.acuerdo.findUnique({ where: { id_acuerdo: idAcuerdo } }).then((a) => a?.estado)).toBe(
                fixtures.estados.activo,
            );
        });

        it("IT-15: el tutor puede rechazar (cancelar) una solicitud pendiente", async () => {
            const conversacion = await prisma.conversacion.create({
                data: {
                    id_usuario_1: fixtures.estudiante.id_usuario,
                    id_usuario_2: fixtures.tutor.id_usuario,
                    estado_conversacion: fixtures.estados.activo,
                },
            });
            const acuerdo = await prisma.acuerdo.create({
                data: {
                    id_usuario: fixtures.estudiante.id_usuario,
                    id_ofertante: fixtures.estudiante.id_usuario,
                    id_publicacion: fixtures.idPublicacionTutoria,
                    id_conversacion: conversacion.id_conversacion,
                    fecha_entrega: new Date(Date.now() + 86_400_000),
                    lugar_entrega: "Sala virtual",
                    observaciones: "Repaso antes del examen",
                    estado: fixtures.estados.pendiente,
                },
            });

            await request(app)
                .patch(`/api/v1/acuerdo/${acuerdo.id_acuerdo}/estado`)
                .set("Authorization", `Bearer ${fixtures.tutor.token}`)
                .send({ estado: "cancelado" })
                .expect(200);

            expect(
                await prisma.acuerdo.findUnique({ where: { id_acuerdo: acuerdo.id_acuerdo } }).then((a) => a?.estado),
            ).toBe(fixtures.estados.cancelado);
        });

        it("IT-16: el tutor configura su disponibilidad semanal y queda reflejada al consultarla", async () => {
            await request(app)
                .put(`/api/v1/horarios/${fixtures.tutor.id_usuario}`)
                .set("Authorization", `Bearer ${fixtures.tutor.token}`)
                .send({
                    bloques: [
                        { dia: "martes", hora_inicio: "09:00", hora_fin: "11:00" },
                        { dia: "jueves", hora_inicio: "15:00", hora_fin: "17:00" },
                    ],
                })
                .expect(200);

            const respuesta = await request(app)
                .get(`/api/v1/horarios/${fixtures.tutor.id_usuario}`)
                .expect(200);

            expect(respuesta.body.data).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ dia: "martes", hora_inicio: "09:00", hora_fin: "11:00" }),
                    expect.objectContaining({ dia: "jueves", hora_inicio: "15:00", hora_fin: "17:00" }),
                ]),
            );

            // Otro usuario no puede tocar el horario del tutor.
            await request(app)
                .put(`/api/v1/horarios/${fixtures.tutor.id_usuario}`)
                .set("Authorization", `Bearer ${fixtures.estudiante.token}`)
                .send({ bloques: [{ dia: "lunes", hora_inicio: "08:00", hora_fin: "09:00" }] })
                .expect(403);
        });

        it("IT-17: el tutor sube una certificación real, se aprueba en background y aparece al consultarla", async () => {
            const pdfDoc = await PDFDocument.create();
            pdfDoc.addPage([200, 200]).drawText("Certificado de Cálculo Diferencial");
            const pdfBytes = Buffer.from(await pdfDoc.save());

            const respuesta = await request(app)
                .post("/api/v1/certificacion")
                .set("Authorization", `Bearer ${fixtures.tutor.token}`)
                .field("nombre", "Certificado de Cálculo")
                .field("lugar_emision", "Facultad de Ingeniería")
                .field("id_etiqueta", fixtures.idEtiqueta)
                .attach("pdf", pdfBytes, "certificado.pdf")
                .expect(202);

            expect(respuesta.body.data.estado).toBe("en_proceso");

            for (let i = 0; i < 30; i++) {
                const estado = poolModeracion.obtenerEstado();
                if (estado.activos === 0 && estado.enEspera === 0) break;
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            const listado = await request(app)
                .get(`/api/v1/certificacion/user/${fixtures.tutor.id_usuario}`)
                .set("Authorization", `Bearer ${fixtures.tutor.token}`)
                .expect(200);

            expect(listado.body.data).toEqual([
                expect.objectContaining({ nombre: "Certificado de Cálculo", id_usuario: fixtures.tutor.id_usuario }),
            ]);
        });

        // Nota: este mismo flujo ya se cubre en historial-guardados.test.ts (IT-32,
        // bajo TEST-07). Se repite aquí en su propio flujo (TEST-03) porque IT-18
        // pertenece formalmente a este padre, con datos propios para no acoplar los dos archivos.
        it("IT-18: el estudiante ve el historial de tutorías tomadas (solo completadas, solo suyas)", async () => {
            const conversacion = await prisma.conversacion.create({
                data: {
                    id_usuario_1: fixtures.estudiante.id_usuario,
                    id_usuario_2: fixtures.tutor.id_usuario,
                    estado_conversacion: fixtures.estados.activo,
                },
            });
            await prisma.acuerdo.create({
                data: {
                    id_usuario: fixtures.estudiante.id_usuario,
                    id_ofertante: fixtures.estudiante.id_usuario,
                    id_publicacion: fixtures.idPublicacionTutoria,
                    id_conversacion: conversacion.id_conversacion,
                    fecha_entrega: new Date(Date.now() - 86_400_000),
                    lugar_entrega: "Sala virtual",
                    observaciones: "Tutoría ya realizada",
                    estado: fixtures.estados.completado,
                },
            });

            // Acuerdo de otro estudiante — no debe aparecer en el historial del primero.
            const otroEstudiante = await crearUsuarioTest({ nombre: "Otro Estudiante" });
            const conversacionOtro = await prisma.conversacion.create({
                data: {
                    id_usuario_1: otroEstudiante.id_usuario,
                    id_usuario_2: fixtures.tutor.id_usuario,
                    estado_conversacion: fixtures.estados.activo,
                },
            });
            await prisma.acuerdo.create({
                data: {
                    id_usuario: otroEstudiante.id_usuario,
                    id_ofertante: otroEstudiante.id_usuario,
                    id_publicacion: fixtures.idPublicacionTutoria,
                    id_conversacion: conversacionOtro.id_conversacion,
                    fecha_entrega: new Date(Date.now() - 86_400_000),
                    lugar_entrega: "Sala virtual",
                    observaciones: "Tutoría de otro estudiante",
                    estado: fixtures.estados.completado,
                },
            });

            const respuesta = await request(app)
                .get("/api/v1/acuerdo")
                .query({ tipo: "tutoria", estado: "completado" })
                .set("Authorization", `Bearer ${fixtures.estudiante.token}`)
                .expect(200);

            expect(respuesta.body.data).toHaveLength(1);
            expect(respuesta.body.data[0].id_publicacion).toBe(fixtures.idPublicacionTutoria);
            expect(respuesta.body.data[0].id_usuario).toBe(fixtures.estudiante.id_usuario);
        });
    },
);
