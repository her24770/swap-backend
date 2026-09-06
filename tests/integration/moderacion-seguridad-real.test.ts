import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { PDFDocument } from "pdf-lib";
import app from "../../src/app";
import prisma from "../../src/persistencia/prismaClient";
import { poolModeracion } from "../../src/servicios/servicioModerarCertificacionBackground";
import {
    asegurarEstadosIniciales,
    asegurarTiposPerfilBase,
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
            process.env.OPENAI_API_KEY = "mock-openai-integration-key";

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

            // Asegurar tipos de perfil base para publicaciones
            await asegurarTiposPerfilBase();
        });

        afterEach(async () => {
            vi.restoreAllMocks();
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

        it("IT-30: aplica sanción tras reporte y bloquea operaciones protegidas (publicación, mensajería y acuerdos)", async () => {
            // 1. Usuario A reporta a Usuario B por comportamiento abusivo
            const usuarioA = await crearUsuarioTest({ nombre: "Usuario Denunciante A" });
            const usuarioB = await crearUsuarioTest({ nombre: "Usuario Infractor B" });
            const moderador = await crearModeradorTest({ usuario: "mod_sanciones" });

            const respuestaReporte = await request(app)
                .post("/api/v1/reportes")
                .set("Authorization", `Bearer ${usuarioA.token}`)
                .send({
                    tipo_objetivo: "usuario",
                    id_objetivo: usuarioB.id_usuario,
                    motivo: "Spam o estafa",
                    detalle: "El usuario envía enlaces sospechosos e intenta estafar miembros de la comunidad.",
                })
                .expect(201);

            expect(respuestaReporte.body.success).toBe(true);
            const idReporte = respuestaReporte.body.data.id_reporte;
            expect(idReporte).toBeDefined();

            // 2. El moderador recupera y gestiona el reporte pendiente
            const consultaReportes = await request(app)
                .post("/api/v1/reportes/buscar")
                .set("Authorization", `Bearer ${moderador.token}`)
                .send({ estado: "pendiente" })
                .expect(200);

            expect(consultaReportes.body.data.reportes).toEqual(
                expect.arrayContaining([expect.objectContaining({ id_reporte: idReporte })]),
            );

            // El moderador resuelve el reporte marcándolo como resuelto
            await request(app)
                .patch(`/api/v1/reportes/${idReporte}/estado`)
                .set("Authorization", `Bearer ${moderador.token}`)
                .send({ estado: "resuelto" })
                .expect(200);

            // 3. El moderador aplica a Usuario B una sanción (suspensión temporal de 7 días)
            const respuestaSancion = await request(app)
                .patch(`/api/v1/moderador/usuarios/${usuarioB.id_usuario}/estado`)
                .set("Authorization", `Bearer ${moderador.token}`)
                .send({
                    accion: "suspender",
                    dias: 7,
                    motivo: "Spam o estafa",
                    detalle: "Comportamiento abusivo y reportes confirmados por moderación",
                })
                .expect(200);

            expect(respuestaSancion.body.success).toBe(true);
            expect(respuestaSancion.body.data).toEqual(
                expect.objectContaining({
                    id_usuario: usuarioB.id_usuario,
                    accion: "suspender",
                }),
            );

            // 4. Verifica que la sanción haya quedado correctamente persistida en PostgreSQL
            const usuarioDbSancionado = await prisma.usuario.findUnique({
                where: { id_usuario: usuarioB.id_usuario },
            });
            const timestampActual = Math.floor(Date.now() / 1000);
            expect(usuarioDbSancionado?.tiempo_suspendido).toBeGreaterThan(timestampActual);
            // La versión de sesión se incrementa para invalidar tokens emitidos previamente
            expect(usuarioDbSancionado?.sesion_version).toBe(usuarioB.sesion_version + 1);

            // Comprobar que se generó la notificación correspondiente en la base de datos
            const notificacionesUsuarioB = await prisma.notificacion.findMany({
                where: { id_usuario: usuarioB.id_usuario },
            });
            expect(notificacionesUsuarioB.length).toBeGreaterThan(0);
            expect(notificacionesUsuarioB[0].mensaje).toContain("suspendida");

            // 5. Usuario B intenta crear una publicación protegida (primera operación protegida)
            const respuestaCrearPublicacion = await request(app)
                .post("/api/v1/publicacion")
                .set("Authorization", `Bearer ${usuarioB.token}`)
                .send({
                    titulo: "Publicación No Autorizada",
                    descripcion: "Intento crear una publicación con cuenta sancionada",
                    precio: "100.00",
                })
                .expect(401);

            expect(respuestaCrearPublicacion.body.success).toBe(false);

            // Garantizar que no se creó ninguna publicación en la base de datos
            const publicacionesUsuarioB = await prisma.publicacion.count({
                where: { id_usuario: usuarioB.id_usuario },
            });
            expect(publicacionesUsuarioB).toBe(0);

            // 6. Usuario B intenta realizar una segunda operación protegida: Iniciar conversación / enviar mensaje
            const respuestaCrearConversacion = await request(app)
                .post("/api/v1/conversacion")
                .set("Authorization", `Bearer ${usuarioB.token}`)
                .send({
                    id_usuario_2: usuarioA.id_usuario,
                    mensaje: "Mensaje no permitido desde cuenta suspendida",
                })
                .expect(401);

            expect(respuestaCrearConversacion.body.success).toBe(false);

            // Garantizar que no se generaron conversaciones ni mensajes en PostgreSQL
            const conversacionesCreadas = await prisma.conversacion.count({
                where: { id_usuario_1: usuarioB.id_usuario },
            });
            const mensajesCreados = await prisma.mensaje.count({
                where: { id_emisor: usuarioB.id_usuario },
            });
            expect(conversacionesCreadas).toBe(0);
            expect(mensajesCreados).toBe(0);

            // 7. Usuario B intenta realizar una tercera operación protegida: Crear un acuerdo
            const respuestaCrearAcuerdo = await request(app)
                .post("/api/v1/acuerdo/1")
                .set("Authorization", `Bearer ${usuarioB.token}`)
                .send({
                    id_conversacion: 1,
                    fecha_entrega: new Date(Date.now() + 86400000).toISOString(),
                    lugar_entrega: "Biblioteca Central",
                    observaciones: "Entrega de prueba",
                })
                .expect(401);

            expect(respuestaCrearAcuerdo.body.success).toBe(false);
            expect(await prisma.acuerdo.count()).toBe(0);

            // 8. Verifica que la sanción continúa activa y que las restricciones se mantienen
            const usuarioDbVerificacionFinal = await prisma.usuario.findUnique({
                where: { id_usuario: usuarioB.id_usuario },
            });
            expect(usuarioDbVerificacionFinal?.tiempo_suspendido).toBeGreaterThan(timestampActual);
        });

        it("IT-27 (Advertencias): el moderador envía una advertencia formal y el usuario la recibe sin que se restrinja su cuenta", async () => {
            // 1. Preparación de entidades: Usuario activo y moderador
            const usuario = await crearUsuarioTest({ nombre: "Usuario Advertido" });
            const moderador = await crearModeradorTest({ usuario: "mod_advertencias" });

            // 2. El moderador envía una advertencia formal utilizando el endpoint real
            const respuestaAdvertencia = await request(app)
                .post(`/api/v1/moderador/usuarios/${usuario.id_usuario}/advertencia`)
                .set("Authorization", `Bearer ${moderador.token}`)
                .send({
                    motivo: "Uso indebido de lenguaje",
                    detalle: "Primera llamada de atención por comentarios ofensivos en publicaciones.",
                })
                .expect(200);

            expect(respuestaAdvertencia.body.success).toBe(true);
            expect(respuestaAdvertencia.body.data.id_usuario).toBe(usuario.id_usuario);

            // 3. Verificación de persistencia de la advertencia en PostgreSQL (tabla Notificacion)
            const notificacionesDb = await prisma.notificacion.findMany({
                where: { id_usuario: usuario.id_usuario },
            });
            expect(notificacionesDb.length).toBe(1);
            expect(notificacionesDb[0].mensaje).toContain("Recibiste una advertencia de un moderador");
            expect(notificacionesDb[0].mensaje).toContain("Uso indebido de lenguaje");

            // 4. El usuario consulta sus notificaciones a través de la API REST
            const consultaNotificaciones = await request(app)
                .get("/api/v1/notificacion")
                .set("Authorization", `Bearer ${usuario.token}`)
                .expect(200);

            expect(consultaNotificaciones.body.success).toBe(true);
            expect(consultaNotificaciones.body.data).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id_usuario: usuario.id_usuario,
                        mensaje: expect.stringContaining("Recibiste una advertencia"),
                    }),
                ]),
            );

            // 5. La advertencia no aplica restricciones de suspensión ni de bloqueo
            const usuarioDb = await prisma.usuario.findUnique({
                where: { id_usuario: usuario.id_usuario },
            });
            expect(usuarioDb?.tiempo_suspendido).toBe(0);
            expect(usuarioDb?.sesion_version).toBe(usuario.sesion_version);

            // El usuario continúa plenamente autorizado y puede realizar operaciones
            const sesionUsuario = await request(app)
                .get("/api/v1/auth/me")
                .set("Authorization", `Bearer ${usuario.token}`)
                .expect(200);
            expect(sesionUsuario.body.success).toBe(true);
        });

        it("IT-27 (Sanciones y BG-24): suspensión y bloqueo de cuentas, intentos de reversión por el infractor y protección de publicaciones bajadas por moderación", async () => {
            // 1. Preparación de entidades: Usuario infractor con publicación activa, denunciante y moderador
            const infractor = await crearUsuarioTest({ nombre: "Usuario Infractor BG24" });
            const denunciante = await crearUsuarioTest({ nombre: "Usuario Denunciante BG24" });
            const moderador = await crearModeradorTest({ usuario: "mod_sanciones_bg24" });

            const publicacion = await crearPublicacionTest({
                id_usuario: infractor.id_usuario,
                titulo: "Material Académico no Autorizado",
                descripcion: "Venta de material con derechos reservados",
                precio: "80.00",
                estado: estados.activo,
            });

            // 2. Denunciante reporta la publicación
            await request(app)
                .post("/api/v1/reportes")
                .set("Authorization", `Bearer ${denunciante.token}`)
                .send({
                    tipo_objetivo: "publicacion",
                    id_objetivo: publicacion.id_publicacion,
                    motivo: "Propiedad intelectual o derechos de autor",
                    detalle: "El contenido infringe derechos protegidos.",
                })
                .expect(201);

            // 3. El moderador baja la publicación por moderación (queda en estado 'inactivo')
            const respuestaBajarPub = await request(app)
                .patch(`/api/v1/moderador/publicaciones/${publicacion.id_publicacion}/bajar`)
                .set("Authorization", `Bearer ${moderador.token}`)
                .send({
                    motivo: "Propiedad intelectual o derechos de autor",
                    detalle: "Publicación retirada de la plataforma tras reporte verificado",
                })
                .expect(200);

            expect(respuestaBajarPub.body.success).toBe(true);
            expect(respuestaBajarPub.body.data.estado_nombre).toBe("inactivo");

            // 4. Verificación de BG-24: El propietario intenta revertir la sanción reactivando su publicación
            const intentoReactivacionPropietario = await request(app)
                .patch(`/api/v1/publicacion/${publicacion.id_publicacion}/estado`)
                .set("Authorization", `Bearer ${infractor.token}`)
                .send({ estado_id: estados.activo })
                .expect(409);

            expect(intentoReactivacionPropietario.body.success).toBe(false);
            expect(intentoReactivacionPropietario.body.message).toContain("reportes pendientes");

            // El propietario tampoco puede usar el endpoint de moderador para reactivarla
            await request(app)
                .patch(`/api/v1/moderador/publicaciones/${publicacion.id_publicacion}/reactivar`)
                .set("Authorization", `Bearer ${infractor.token}`)
                .send({ motivo: "Quiero reactivar mi publicación" })
                .expect(403);

            // La publicación en PostgreSQL permanece intacta como 'inactiva'
            const publicacionDb = await prisma.publicacion.findUnique({
                where: { id_publicacion: publicacion.id_publicacion },
            });
            expect(publicacionDb?.estado).toBe(estados.inactivo);

            // 5. El moderador aplica sanción de suspensión temporal (7 días) a la cuenta del infractor
            const respuestaSuspension = await request(app)
                .patch(`/api/v1/moderador/usuarios/${infractor.id_usuario}/estado`)
                .set("Authorization", `Bearer ${moderador.token}`)
                .send({
                    accion: "suspender",
                    dias: 7,
                    motivo: "Propiedad intelectual o derechos de autor",
                    detalle: "Suspensión temporal por reiteración de faltas",
                })
                .expect(200);

            expect(respuestaSuspension.body.success).toBe(true);
            const timestampActual = Math.floor(Date.now() / 1000);

            const infractorSuspendidoDb = await prisma.usuario.findUnique({
                where: { id_usuario: infractor.id_usuario },
            });
            expect(infractorSuspendidoDb?.tiempo_suspendido).toBeGreaterThan(timestampActual);

            // 6. El usuario suspendido intenta revertir su propia sanción
            const intentoReversionSuspension = await request(app)
                .patch(`/api/v1/moderador/usuarios/${infractor.id_usuario}/estado`)
                .set("Authorization", `Bearer ${infractor.token}`)
                .send({
                    accion: "reactivar",
                    motivo: "Intento auto-reactivación no autorizada",
                })
                .expect(401);

            expect(intentoReversionSuspension.body.success).toBe(false);

            // 7. El moderador escala la sanción a bloqueo definitivo (-1)
            const respuestaBloqueo = await request(app)
                .patch(`/api/v1/moderador/usuarios/${infractor.id_usuario}/estado`)
                .set("Authorization", `Bearer ${moderador.token}`)
                .send({
                    accion: "bloquear",
                    motivo: "Incumplimiento grave de normas",
                    detalle: "Bloqueo definitivo de cuenta",
                })
                .expect(200);

            expect(respuestaBloqueo.body.success).toBe(true);
            expect(respuestaBloqueo.body.data.tiempo_suspendido).toBe(-1);

            // 8. El estado final en PostgreSQL permanece bloqueado y consistente
            const infractorBloqueadoDb = await prisma.usuario.findUnique({
                where: { id_usuario: infractor.id_usuario },
            });
            expect(infractorBloqueadoDb?.tiempo_suspendido).toBe(-1);
            expect(infractorBloqueadoDb?.sesion_version).toBe(infractor.sesion_version + 2);
        });

        it("IT-28 (Escenario A): falla la moderación externa de texto y el sistema actúa en modo fail-closed", async () => {
            const usuario = await crearUsuarioTest({ nombre: "Usuario Test IT28 A" });

            // 1. Verificación previa del filtro local de palabras restringidas en BD (sin invocar al proveedor externo)
            await prisma.palabraRestringida.create({
                data: { palabra: "estafaprohibida" },
            });

            const respuestaFiltroLocal = await request(app)
                .post("/api/v1/publicacion")
                .set("Authorization", `Bearer ${usuario.token}`)
                .field("titulo", "Publicación con estafaprohibida")
                .field("descripcion", "Descripción con contenido que viola filtro local")
                .field("precio", "50.00")
                .field("tipo_publicacion", "material")
                .expect(422);

            expect(respuestaFiltroLocal.body.success).toBe(false);
            expect(respuestaFiltroLocal.body.message).toContain("normas de la comunidad");
            expect(await prisma.publicacion.count()).toBe(0);

            // 2. Simulación de fallo en la frontera externa de OpenAI (error 503 / caída de red)
            vi.spyOn(console, "error").mockImplementation(() => {});
            vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Conexión con OpenAI rechazada (503)"));

            const respuestaFalloProveedor = await request(app)
                .post("/api/v1/publicacion")
                .set("Authorization", `Bearer ${usuario.token}`)
                .field("titulo", "Libro de Cálculo Diferencial")
                .field("descripcion", "Libro de texto universitario en excelente estado")
                .field("precio", "75.00")
                .field("tipo_publicacion", "material")
                .expect(503);

            expect(respuestaFalloProveedor.body.success).toBe(false);
            expect(respuestaFalloProveedor.body.message).toContain("No se pudo verificar el contenido");

            // 3. Verificación de que NINGUNA publicación fue creada en PostgreSQL (comportamiento fail-closed)
            const publicacionesEnDb = await prisma.publicacion.findMany({
                where: { id_usuario: usuario.id_usuario },
            });
            expect(publicacionesEnDb.length).toBe(0);
        });

        it("IT-28 (Escenario B): falla la moderación externa de imágenes y la publicación no se crea de forma permisiva (BG-16)", async () => {
            const usuario = await crearUsuarioTest({ nombre: "Usuario Test IT28 B" });

            // 1. La moderación de texto responde exitosamente para permitir que el pipeline avance a la etapa de imágenes
            vi.spyOn(globalThis, "fetch").mockResolvedValue({
                ok: true,
                json: async () => ({
                    results: [{ flagged: false, category_scores: {} }],
                }),
            } as any);

            // 2. Se simula la caída controlada del cliente externo de AWS Rekognition
            vi.spyOn(console, "error").mockImplementation(() => {});
            vi.spyOn(RekognitionClient.prototype, "send").mockRejectedValue(
                new Error("AWS Rekognition Service Unavailable (500)")
            );

            // 3. El usuario intenta crear la publicación adjuntando una imagen
            const imagenBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
            const respuestaCreacion = await request(app)
                .post("/api/v1/publicacion")
                .set("Authorization", `Bearer ${usuario.token}`)
                .field("titulo", "Tutoría de Álgebra Lineal")
                .field("descripcion", "Sesiones personalizadas de álgebra y matrices")
                .field("precio", "60.00")
                .field("tipo_publicacion", "tutoria")
                .attach("imagenes", imagenBuffer, "foto_tutoria.png")
                .expect(503);

            expect(respuestaCreacion.body.success).toBe(false);
            expect(respuestaCreacion.body.message).toContain("No se pudo verificar el contenido");

            // 4. Verificación de que la publicación NO fue persistida en PostgreSQL antes de moderar las imágenes (BG-16)
            const publicacionesEnDb = await prisma.publicacion.findMany({
                where: { id_usuario: usuario.id_usuario },
            });
            expect(publicacionesEnDb.length).toBe(0);

            // Tampoco deben quedar imágenes huérfanas en la base de datos
            const imagenesEnDb = await prisma.imagenPublicacion.findMany();
            expect(imagenesEnDb.length).toBe(0);
        });

        it("IT-28 (Escenario C): falla la moderación externa en certificaciones y el procesamiento en background aplica fail-closed", async () => {
            const usuario = await crearUsuarioTest({ nombre: "Usuario Certificacion IT28" });
            const etiqueta = await prisma.etiqueta.create({
                data: {
                    nombre: "Programación Web",
                    descripcion: "Desarrollo de aplicaciones web modernas",
                },
            });

            // 1. Crear documento PDF válido en memoria con texto
            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage([200, 200]);
            page.drawText("Certificado de Programacion Web", { x: 20, y: 100 });
            const pdfBytes = Buffer.from(await pdfDoc.save());

            // 2. Simular indisponibilidad de las APIs externas de moderación (OpenAI y Rekognition)
            vi.spyOn(console, "error").mockImplementation(() => {});
            vi.spyOn(globalThis, "fetch").mockRejectedValue(
                new Error("OpenAI Moderations API Timeout (504)")
            );
            vi.spyOn(RekognitionClient.prototype, "send").mockRejectedValue(
                new Error("AWS Rekognition Service Unavailable (500)")
            );

            // 3. El usuario envía su certificado a través del endpoint REST
            const respuestaUpload = await request(app)
                .post("/api/v1/certificacion")
                .set("Authorization", `Bearer ${usuario.token}`)
                .field("nombre", "Certificado TypeScript")
                .field("lugar_emision", "Facultad de Ingeniería")
                .field("id_etiqueta", etiqueta.id_etiqueta)
                .attach("pdf", pdfBytes, "certificado.pdf")
                .expect(202);

            expect(respuestaUpload.body.success).toBe(true);
            expect(respuestaUpload.body.data.estado).toBe("en_proceso");

            // 4. Esperar a que el pool asíncrono procese la tarea
            for (let i = 0; i < 30; i++) {
                const estadoPool = poolModeracion.obtenerEstado();
                if (estadoPool.activos === 0 && estadoPool.enEspera === 0) {
                    break;
                }
                await new Promise((resolve) => setTimeout(resolve, 100));
            }

            // 5. Verificación de que la certificación NO quedó persistida en PostgreSQL (fail-closed)
            const certificacionesEnDb = await prisma.certificacion.findMany({
                where: { id_usuario: usuario.id_usuario },
            });
            expect(certificacionesEnDb.length).toBe(0);

            // 6. Verificar que se notificó al usuario sobre la imposibilidad temporal de procesar el documento
            const notificaciones = await prisma.notificacion.findMany({
                where: { id_usuario: usuario.id_usuario },
            });
            expect(notificaciones.length).toBe(1);
            expect(notificaciones[0].mensaje).toContain("error temporal");
        });
    },
);
