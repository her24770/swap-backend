/**
 * seedPruebas.ts — Datos de prueba
 *
 * Este seed es OPCIONAL y solo se corre manualmente cuando se quieren
 * poblar la base de datos con datos ficticios para desarrollo/QA.
 *
 * IMPORTANTE: Requiere que seed.ts ya se haya ejecutado antes, ya que
 * depende de que los catálogos de referencia (estados, tipos, etiquetas)
 * ya existan en la base de datos.
 *
 * Crea datos representativos para todos los modelos funcionales. Es idempotente:
 * una segunda ejecución actualiza la misma muestra en vez de duplicarla.
 *
 * Crea, entre otros:
 *   - 2 moderadores y 3 usuarios de prueba
 *   - 9 publicaciones de material, 9 tutorías, 9 negocios
 *   - Imágenes R2, contactos, horarios, certificaciones y anuncios
 *   - Conversaciones, mensajes, contextos, acuerdos y notificaciones
 *   - Reseñas, reportes, likes, guardados y preferencias
 *
 * Uso (con los contenedores corriendo):
 *   docker compose exec api npx ts-node --transpile-only prisma/seedPruebas.ts
 *
 * Credenciales creadas:
 *   Usuario   : vendedor@uvg.edu.gt    / Vendedor123!
 *   Usuario   : vendedor123@uvg.edu.gt / Vendedor123!
 *   Moderador : moderador1             / Moderador123!  (nivel: moderador)
 *   Moderador : superadmin1            / SuperAdmin123!  (nivel: superadmin)
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const SEED_NOW = new Date("2026-09-25T15:00:00.000Z");

function assertSafeEnvironment() {
    const databaseUrl = process.env.DATABASE_URL ?? "";
    if (!databaseUrl) {
        throw new Error("DATABASE_URL no está configurada; se cancela la seed para evitar un destino ambiguo.");
    }

    let databaseTarget = databaseUrl;
    try {
        const parsed = new URL(databaseUrl);
        databaseTarget = `${parsed.hostname}${parsed.pathname}`;
    } catch {
        // Prisma mostrará el error de formato; aquí solo aplicamos la guarda.
    }
    const looksProduction = /(?:^|[._/-])prod(?:uction)?(?:[._/-]|$)/i.test(databaseTarget);

    if (looksProduction && process.env.ALLOW_DEMO_SEED !== "true") {
        throw new Error(
            "Seed de muestra bloqueado en producción. " +
            "Solo si la ejecución es deliberada define ALLOW_DEMO_SEED=true.",
        );
    }
}

const configuredAssetBase = (process.env.SEED_ASSET_BASE_URL ?? process.env.CLOUDFLARE_R2_PUBLIC_URL ?? "")
    .replace(/\/$/, "");
const hasConfiguredBucket = Boolean(configuredAssetBase)
    && !/xxxxxxxx|your_|\.invalid(?:\/|$)/i.test(configuredAssetBase);

function assetUrl(path: string, localFallback: string): string {
    return hasConfiguredBucket
        ? `${configuredAssetBase}/${path.replace(/^\//, "")}`
        : localFallback;
}

// El placeholder es un objeto compartido del bucket y forma parte del flujo normal
// de registro. Las rutas pueden reemplazarse sin cambiar el seed mediante variables.
assertSafeEnvironment();
const ASSETS = {
    perfil: assetUrl(process.env.SEED_PROFILE_IMAGE_KEY ?? "perfil/default.png", "https://i.pravatar.cc/300?u=swap-perfil"),
    publicacion: assetUrl(process.env.SEED_PUBLICATION_IMAGE_KEY ?? "perfil/default.png", "https://i.pravatar.cc/800?u=swap-publicacion"),
    anuncio: assetUrl(process.env.SEED_AD_IMAGE_KEY ?? "perfil/default.png", "https://i.pravatar.cc/800?u=swap-anuncio"),
    reporte: assetUrl(process.env.SEED_REPORT_IMAGE_KEY ?? "perfil/default.png", "https://i.pravatar.cc/800?u=swap-reporte"),
    certificacion: assetUrl(
        process.env.SEED_CERTIFICATION_PDF_KEY ?? "certificaciones/seed-certificacion.pdf",
        "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    ),
};

async function validarAssets() {
    if (!hasConfiguredBucket) {
        console.warn("  ⚠️ R2 no configurado: se usarán recursos públicos de muestra para desarrollo local.");
        return;
    }
    if (process.env.SEED_VALIDATE_ASSETS === "false") return;
    const recursos = [
        ...[ASSETS.perfil, ASSETS.publicacion, ASSETS.anuncio, ASSETS.reporte]
            .map((url) => ({ url, contentType: "image/" })),
        { url: ASSETS.certificacion, contentType: "application/pdf" },
    ].filter((recurso, index, todos) => todos.findIndex((item) => item.url === recurso.url) === index);

    for (const { url, contentType } of recursos) {
        if (url.length > 255) throw new Error(`La URL excede el límite de 255 caracteres: ${url}`);
        const response = await fetch(url, { method: "HEAD" });
        if (!response.ok) throw new Error(`El recurso del bucket no existe o no es público (${response.status}): ${url}`);
        const actualType = response.headers.get("content-type")?.toLowerCase() ?? "";
        if (actualType && !actualType.startsWith(contentType)) {
            throw new Error(`Formato inesperado para ${url}: ${actualType}; se esperaba ${contentType}`);
        }
    }
}

// ─── Helper: busca una publicación por título, la crea si no existe ───────────
async function findOrCreatePublicacion(
    data: Parameters<typeof prisma.publicacion.create>[0]["data"]
) {
    const existing = await prisma.publicacion.findFirst({
        where: { titulo: data.titulo as string },
    });
    if (!existing) return prisma.publicacion.create({ data });
    return prisma.publicacion.update({
        where: { id_publicacion: existing.id_publicacion },
        data,
    });
}

async function upsertContacto(idUsuario: number, tipoContacto: number, valor: string) {
    const existing = await prisma.contacto.findFirst({ where: { id_usuario: idUsuario, tipo_contacto: tipoContacto } });
    if (!existing) return prisma.contacto.create({ data: { id_usuario: idUsuario, tipo_contacto: tipoContacto, valor } });
    return prisma.contacto.update({ where: { id_contacto: existing.id_contacto }, data: { valor } });
}

async function upsertMensaje(idConversacion: number, idEmisor: number, mensaje: string, estado: number, fecha: Date) {
    const existing = await prisma.mensaje.findFirst({ where: { id_conversacion: idConversacion, id_emisor: idEmisor, mensaje } });
    if (!existing) return prisma.mensaje.create({ data: { id_conversacion: idConversacion, id_emisor: idEmisor, mensaje, estado_mensaje: estado, fecha_enviado: fecha } });
    return prisma.mensaje.update({ where: { id_mensaje: existing.id_mensaje }, data: { estado_mensaje: estado, fecha_enviado: fecha } });
}

async function upsertAnuncio(idUsuario: number, titulo: string, descripcion: string, imagenUrl: string, fecha: Date) {
    const existing = await prisma.anuncio.findFirst({ where: { id_usuario: idUsuario, titulo } });
    const data = { id_usuario: idUsuario, titulo, descripcion, imagen_url: imagenUrl, fecha_anuncio: fecha };
    if (!existing) return prisma.anuncio.create({ data });
    return prisma.anuncio.update({ where: { id_anuncio: existing.id_anuncio }, data });
}

async function upsertNotificacion(idUsuario: number, mensaje: string, idEstado: number, fecha: Date) {
    const existing = await prisma.notificacion.findFirst({ where: { id_usuario: idUsuario, mensaje } });
    const data = { id_usuario: idUsuario, mensaje, id_estado: idEstado, fecha };
    if (!existing) return prisma.notificacion.create({ data });
    return prisma.notificacion.update({ where: { id_notificacion: existing.id_notificacion }, data });
}

async function upsertResena(idEmisor: number, idReceptor: number, idTipo: number, contenido: string, calificacion: number, fecha: Date) {
    const existing = await prisma.resena.findFirst({ where: { id_emisor: idEmisor, id_receptor: idReceptor, id_tipo_resena: idTipo } });
    const data = { id_emisor: idEmisor, id_receptor: idReceptor, id_tipo_resena: idTipo, contenido, calificacion, fecha_resena: fecha };
    if (!existing) return prisma.resena.create({ data });
    return prisma.resena.update({ where: { id_resena: existing.id_resena }, data });
}

async function upsertAcuerdoPrueba(
    data: Parameters<typeof prisma.acuerdo.create>[0]["data"]
) {
    const existing = await prisma.acuerdo.findFirst({
        where: {
            id_usuario: data.id_usuario as number,
            id_publicacion: data.id_publicacion as number,
            observaciones: data.observaciones as string,
        },
    });

    if (!existing) return prisma.acuerdo.create({ data });

    return prisma.acuerdo.update({
        where: { id_acuerdo: existing.id_acuerdo },
        data,
    });
}

async function upsertReportePrueba(
    data: Parameters<typeof prisma.reporte.create>[0]["data"]
) {
    const existing = await prisma.reporte.findFirst({
        where: {
            id_emisor: data.id_emisor as number,
            id_receptor: data.id_receptor as number,
            id_publicacion: (data.id_publicacion as number | undefined) ?? null,
            id_mensaje: (data.id_mensaje as number | undefined) ?? null,
            motivo: data.motivo as number,
        },
    });

    if (!existing) {
        return prisma.reporte.create({ data });
    }

    return prisma.reporte.update({
        where: { id_reporte: existing.id_reporte },
        data,
    });
}

async function main() {
    assertSafeEnvironment();
    console.log("🌱 Iniciando seed de datos de prueba...");
    await validarAssets();
    console.log("  ✅ Recursos de R2 verificados");

    // ─────────────────────────────────────────────
    // Verificar que el seed de estructura ya corrió
    // ─────────────────────────────────────────────
    const estadoCount = await prisma.estado.count();
    if (estadoCount === 0) {
        console.error(
            "❌ No se encontraron estados en la BD. Ejecuta primero el seed de estructura:\n" +
            "   docker compose exec api npx ts-node --transpile-only prisma/seed.ts"
        );
        process.exit(1);
    }

    // ─────────────────────────────────────────────
    // Leer catálogos de referencia (ya existen por seed.ts)
    // ─────────────────────────────────────────────
    const eActivo = await prisma.estado.findUniqueOrThrow({ where: { estado: "activo" } });
    const ePendiente = await prisma.estado.findUniqueOrThrow({ where: { estado: "pendiente" } });
    const eCompletado = await prisma.estado.findUniqueOrThrow({ where: { estado: "completado" } });
    const eEnviado = await prisma.estado.findUniqueOrThrow({ where: { estado: "enviado" } });
    const eLeido = await prisma.estado.findUniqueOrThrow({ where: { estado: "leido" } });
    const eDisponible = await prisma.estado.findUniqueOrThrow({ where: { estado: "disponible" } });
    const eInactivo = await prisma.estado.findUniqueOrThrow({ where: { estado: "inactivo" } });
    const eReservado = await prisma.estado.findUniqueOrThrow({ where: { estado: "reservado" } });
    const eVendido = await prisma.estado.findUniqueOrThrow({ where: { estado: "vendido" } });

    const reportePendiente = await prisma.estado.findUniqueOrThrow({ where: { estado: "pendiente" } });
    const reporteResuelto = await prisma.estado.findUniqueOrThrow({ where: { estado: "resuelto" } });
    const reporteRechazado = await prisma.estado.findUniqueOrThrow({ where: { estado: "rechazado" } });

    const tMaterial = await prisma.tipoPerfil.findUniqueOrThrow({ where: { tipo_perfil: "material" } });
    const tTutoria = await prisma.tipoPerfil.findUniqueOrThrow({ where: { tipo_perfil: "tutoria" } });
    const tNegocio = await prisma.tipoPerfil.findUniqueOrThrow({ where: { tipo_perfil: "negocio" } });

    const tcWa = await prisma.tipoContacto.findUniqueOrThrow({ where: { tipo_contacto: "whatsapp" } });
    const tcIg = await prisma.tipoContacto.findUniqueOrThrow({ where: { tipo_contacto: "instagram" } });
    const tcTel = await prisma.tipoContacto.findUniqueOrThrow({ where: { tipo_contacto: "telefono" } });
    const tcCo = await prisma.tipoContacto.findUniqueOrThrow({ where: { tipo_contacto: "correo_personal" } });

    const tmModerador = await prisma.tipoModerador.findUniqueOrThrow({ where: { tipo_moderador: "moderador" } });
    const tmSuperadmin = await prisma.tipoModerador.findUniqueOrThrow({ where: { tipo_moderador: "superadmin" } });
    const [trConsumidor, trVendedor, trTutor] = await Promise.all([
        prisma.tipoResena.findUniqueOrThrow({ where: { tipo_resena: "consumidor" } }),
        prisma.tipoResena.findUniqueOrThrow({ where: { tipo_resena: "vendedor" } }),
        prisma.tipoResena.findUniqueOrThrow({ where: { tipo_resena: "tutor" } }),
    ]);
    const motivosReporte = await prisma.motivoReporte.findMany({ orderBy: { id_motivo: "asc" } });
    if (motivosReporte.length < 4) throw new Error("El seed estructural debe crear al menos cuatro motivos de reporte.");

    // Etiquetas de ICC
    const [eAED, eBD1, eIS1, eRedes, ePOO, eEDA, eSO, eArq, eBD2, eIA] = await Promise.all([
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Algoritmos y Estructuras de Datos" } }),
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Bases de Datos 1" } }),
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Ingeniería de Software 1" } }),
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Redes de Computadoras" } }),
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Programación Orientada a Objetos" } }),
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Estructuras de Datos Avanzadas" } }),
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Sistemas Operativos 1" } }),
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Arquitectura de Computadoras" } }),
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Bases de Datos 2" } }),
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Inteligencia Artificial 1" } }),
    ]);

    // Etiquetas de Biología
    const [eCiencias, eBioquim, eBioCel, eGenetica, eMicro, eEcologia, eFisio, eBotanica] = await Promise.all([
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Ciencias de la Vida" } }),
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Bioquímica" } }),
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Biología Celular" } }),
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Genética" } }),
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Microbiología" } }),
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Ecología" } }),
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Fisiología Animal" } }),
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Botánica" } }),
    ]);

    // Carreras
    const etiquetaIng = await prisma.etiqueta.findUniqueOrThrow({
        where: { nombre: "Ingeniería en Ciencias de la Computación" },
    });
    const etiquetaBio = await prisma.etiqueta.findUniqueOrThrow({
        where: { nombre: "Biologia" },
    });

    //Etiquetas especiales de compra, alquiler, producto y servicio
    const [eCompra, eAlquiler, eProducto, eServicio] = await Promise.all([
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Compra" } }),
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Alquiler" } }),
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Producto" } }),
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Servicio" } }),
    ]);

    //Etiquetas especiales de modalidad presencial o en linea
    const [ePresencial, eEnLinea] = await Promise.all([
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Presencial" } }),
        prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "En Línea" } }),
    ]);
    const [eCalculo1, eCalculo2, eMatDiscreta, eFisica1, eFisica2, eElectronica1,
        eEstadistica1, eIngles, eArteDiseno, eTecnologia, eServicios, eComunicacion,
        eReposteria] = await Promise.all([
            prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Cálculo Diferencial e Integral" } }),
            prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Cálculo en Varias Variables" } }),
            prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Matemática Discreta" } }),
            prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Física 1" } }),
            prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Física 2" } }),
            prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Electrónica 1" } }),
            prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Estadística 1" } }),
            prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Inglés Técnico" } }),
            prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Arte y Diseño" } }),
            prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Tecnología" } }),
            prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Servicios" } }),
            prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Comunicación Oral y Escrita" } }),
            prisma.etiqueta.findUniqueOrThrow({ where: { nombre: "Repostería" } }),
        ]);

    console.log("  ✅ Catálogos de referencia leídos");

    // ─────────────────────────────────────────────
    // Moderadores (dos niveles, para poder probar ambos)
    // ─────────────────────────────────────────────
    const moderador = await prisma.moderador.upsert({
        where: { usuario: "moderador1" },
        update: {},
        create: {
            usuario: "moderador1",
            password: await bcrypt.hash("Moderador123!", SALT_ROUNDS),
            id_tipo_moderador: tmModerador.id_tipo_moderador,
        },
    });
    const superadmin = await prisma.moderador.upsert({
        where: { usuario: "superadmin1" },
        update: {},
        create: {
            usuario: "superadmin1",
            password: await bcrypt.hash("SuperAdmin123!", SALT_ROUNDS),
            id_tipo_moderador: tmSuperadmin.id_tipo_moderador,
        },
    });
    console.log("  ✅ Moderadores");

    // ─────────────────────────────────────────────
    // Usuarios de prueba
    // ─────────────────────────────────────────────
    const vendedor = await prisma.usuario.upsert({
        where: { email_institucional: "vendedor@uvg.edu.gt" },
        update: {
            nombre: "Carlos Méndez",
            url_foto_perfil: ASSETS.perfil,
            descripcion: "Usuario de prueba — vende materiales, ofrece tutorías y servicios.",
            calificacion: 4.8,
        },
        create: {
            nombre: "Carlos Méndez",
            carnet: 21002,
            email_institucional: "vendedor@uvg.edu.gt",
            password: await bcrypt.hash("Vendedor123!", SALT_ROUNDS),
            url_foto_perfil: ASSETS.perfil,
            descripcion: "Usuario de prueba — vende materiales, ofrece tutorías y servicios.",
            calificacion: 4.8,
        },
    });

    await Promise.all([
        upsertContacto(vendedor.id_usuario, tcWa.id_tipo_contacto, "+502 5555-1001"),
        upsertContacto(vendedor.id_usuario, tcIg.id_tipo_contacto, "@carlos.mendez.uvg"),
        upsertContacto(vendedor.id_usuario, tcCo.id_tipo_contacto, "carlos.mendez@example.com"),
        upsertContacto(vendedor.id_usuario, tcTel.id_tipo_contacto, "+502 5555-1001"),
    ]);

    const vendedor1 = await prisma.usuario.upsert({
        where: { email_institucional: "vendedor123@uvg.edu.gt" },
        update: {
            nombre: "Adriana Jiménez",
            url_foto_perfil: ASSETS.perfil,
            descripcion: "Usuario de prueba — vende materiales, ofrece tutorías y servicios.",
            calificacion: 4.2,
        },
        create: {
            nombre: "Adriana Jiménez",
            carnet: 21064,
            email_institucional: "vendedor123@uvg.edu.gt",
            password: await bcrypt.hash("Vendedor123!", SALT_ROUNDS),
            url_foto_perfil: ASSETS.perfil,
            descripcion: "Usuario de prueba — vende materiales, ofrece tutorías y servicios.",
            calificacion: 4.2,
        },
    });

    await Promise.all([
        upsertContacto(vendedor1.id_usuario, tcWa.id_tipo_contacto, "+502 5164-8081"),
        upsertContacto(vendedor1.id_usuario, tcIg.id_tipo_contacto, "@adriana.jimenez.uvg"),
        upsertContacto(vendedor1.id_usuario, tcCo.id_tipo_contacto, "adriana.jimenez@example.com"),
        upsertContacto(vendedor1.id_usuario, tcTel.id_tipo_contacto, "+502 5164-8081"),
    ]);

    const comprador = await prisma.usuario.upsert({
        where: { email_institucional: "estudiante@uvg.edu.gt" },
        update: {
            nombre: "Sofía Castillo",
            url_foto_perfil: ASSETS.perfil,
            descripcion: "Estudiante de prueba interesada en tutorías y materiales.",
            calificacion: 4.6,
        },
        create: {
            nombre: "Sofía Castillo",
            carnet: 22117,
            email_institucional: "estudiante@uvg.edu.gt",
            password: await bcrypt.hash("Estudiante123!", SALT_ROUNDS),
            url_foto_perfil: ASSETS.perfil,
            descripcion: "Estudiante de prueba interesada en tutorías y materiales.",
            calificacion: 4.6,
        },
    });
    await Promise.all([
        upsertContacto(comprador.id_usuario, tcWa.id_tipo_contacto, "+502 5555-2217"),
        upsertContacto(comprador.id_usuario, tcCo.id_tipo_contacto, "sofia.castillo@example.com"),
    ]);

    console.log("  ✅ Usuarios de prueba");

    // ─────────────────────────────────────────────
    // Publicaciones de prueba
    // ─────────────────────────────────────────────
    const materiales = await Promise.all([
        findOrCreatePublicacion({ titulo: "Apuntes de AED — Árboles y Grafos", descripcion: "Apuntes completos del tema 3, incluye ejercicios resueltos.", precio: 15.00, estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor.id_usuario }),
        findOrCreatePublicacion({ titulo: "Libro: Clean Code — Robert Martin", descripcion: "Libro físico en buen estado, ideal para IS1.", precio: 80.00, estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor.id_usuario }),
        findOrCreatePublicacion({ titulo: "Guías de BD1 — Semestre I 2024", descripcion: "Todas las guías del curso con soluciones.", precio: 20.00, estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor.id_usuario }),
        findOrCreatePublicacion({ titulo: "Flashcards de Anatomía", descripcion: "200 tarjetas de estudio de anatomía humana.", precio: 30.00, estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor1.id_usuario }),
        findOrCreatePublicacion({ titulo: "Resúmenes de Bioquímica", descripcion: "Resúmenes de todos los parciales con diagramas.", precio: 25.00, estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor1.id_usuario }),
        findOrCreatePublicacion({ titulo: "Manual de Python para Data Science", descripcion: "Guía completa de Python con ejercicios prácticos.", precio: 45.00, estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor.id_usuario }),
        findOrCreatePublicacion({ titulo: "Cuaderno de ejercicios de Cálculo 2", descripcion: "100 problemas resueltos paso a paso.", precio: 35.00, estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor1.id_usuario }),
        findOrCreatePublicacion({ titulo: "Plantillas de tesis en LaTeX", descripcion: "Plantilla lista para usar, incluye tutorial.", precio: 25.00, estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor.id_usuario }),
        findOrCreatePublicacion({ titulo: "Calculadora científica Casio fx-991EX", descripcion: "Calculadora científica en alquiler para cursos de electrónica y laboratorios.", precio: 137.00, estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor1.id_usuario }),
    ]);

    const tutorias = await Promise.all([
        findOrCreatePublicacion({ titulo: "Tutoría de AED — Recursión y Grafos", descripcion: "Sesiones personalizadas, 1 hora, virtual o presencial.", precio: 50.00, estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor.id_usuario }),
        findOrCreatePublicacion({ titulo: "Tutoría de BD1 — SQL y Diseño", descripcion: "Ayuda con consultas SQL, ER y normalización.", precio: 45.00, estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor.id_usuario }),
        findOrCreatePublicacion({ titulo: "Tutoría de Cálculo 1", descripcion: "Límites, derivadas e integrales.", precio: 40.00, estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor.id_usuario }),
        findOrCreatePublicacion({ titulo: "Tutoría de Anatomía Humana", descripcion: "Repaso de anatomía enfocado en exámenes.", precio: 55.00, estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor1.id_usuario }),
        findOrCreatePublicacion({ titulo: "Tutoría de Inglés Técnico", descripcion: "Preparación para el examen de Inglés Técnico UVG.", precio: 35.00, estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor1.id_usuario }),
        findOrCreatePublicacion({ titulo: "Tutoría de Matemática Discreta", descripcion: "Lógica, conjuntos, combinatoria y grafos.", precio: 50.00, estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor1.id_usuario }),
        findOrCreatePublicacion({ titulo: "Tutoría de Física 1", descripcion: "Mecánica clásica, cinemática y dinámica.", precio: 45.00, estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor.id_usuario }),
        findOrCreatePublicacion({ titulo: "Tutoría de Estadística 1", descripcion: "Probabilidad, distribuciones y análisis de datos.", precio: 40.00, estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor1.id_usuario }),
        findOrCreatePublicacion({ titulo: "Tutoría nocturna de Física 2", descripcion: "Tutoría virtual de electricidad y magnetismo, disponible los viernes por la noche.", precio: 65.00, estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor1.id_usuario }),
    ]);

    const negocios = await Promise.all([
        findOrCreatePublicacion({ titulo: "Diseño de logos universitarios", descripcion: "Logo profesional para tu proyecto o startup. Entrega en 48h.", precio: 100.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor.id_usuario }),
        findOrCreatePublicacion({ titulo: "Desarrollo de landing pages", descripcion: "Landing pages con HTML/CSS/JS. Precio por página.", precio: 200.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor.id_usuario }),
        findOrCreatePublicacion({ titulo: "Impresión y encuadernación", descripcion: "Servicio de impresión en campus, blanco/negro y color.", precio: 5.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor1.id_usuario }),
        findOrCreatePublicacion({ titulo: "Fotografía para presentaciones", descripcion: "Fotos profesionales para defensa de tesis o presentación.", precio: 150.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor.id_usuario }),
        findOrCreatePublicacion({ titulo: "Traducción de documentos ES/EN", descripcion: "Documentos técnicos y académicos. Precio por página.", precio: 25.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor1.id_usuario }),
        findOrCreatePublicacion({ titulo: "Edición de videos promocionales", descripcion: "Edición profesional para proyectos y presentaciones.", precio: 120.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor.id_usuario }),
        findOrCreatePublicacion({ titulo: "Asesoría en Excel avanzado", descripcion: "Macros, tablas dinámicas y automatización.", precio: 60.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor1.id_usuario }),
        findOrCreatePublicacion({ titulo: "Redacción de CV y carta de presentación", descripcion: "CV profesional adaptado a tu perfil.", precio: 50.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor.id_usuario }),
        findOrCreatePublicacion({ titulo: "Caja de brownies artesanales", descripcion: "Caja de seis brownies artesanales, producto listo para entregar dentro del campus.", precio: 73.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor.id_usuario }),
    ]);

    await Promise.all([
        prisma.publicacion.update({ where: { id_publicacion: materiales[3].id_publicacion }, data: { estado: eVendido.id_estado } }),
        prisma.publicacion.update({ where: { id_publicacion: materiales[7].id_publicacion }, data: { estado: eInactivo.id_estado } }),
        prisma.publicacion.update({ where: { id_publicacion: negocios[3].id_publicacion }, data: { estado: eReservado.id_estado } }),
        prisma.publicacion.update({ where: { id_publicacion: tutorias[0].id_publicacion }, data: { is_pinned: true } }),
        prisma.publicacion.update({ where: { id_publicacion: negocios[0].id_publicacion }, data: { is_pinned: true } }),
    ]);

    console.log("  ✅ Publicaciones (9 materiales · 9 tutorías · 9 negocios)");

    // Una imagen visible por publicación. Se reutiliza de forma deliberada un
    // objeto compartido de R2; la relación se identifica por publicación + URL.
    await Promise.all([...materiales, ...tutorias, ...negocios].map(async (publicacion) => {
        const exists = await prisma.imagenPublicacion.findFirst({
            where: { id_publicacion: publicacion.id_publicacion, url_imagen: ASSETS.publicacion },
        });
        if (!exists) {
            await prisma.imagenPublicacion.create({
                data: { id_publicacion: publicacion.id_publicacion, url_imagen: ASSETS.publicacion },
            });
        }
    }));
    console.log("  ✅ Imágenes R2 vinculadas a publicaciones");

    // ─────────────────────────────────────────────
    // Etiquetas por publicación
    // ─────────────────────────────────────────────
    await prisma.publicacionEtiqueta.createMany({
        skipDuplicates: true,
        data: [
            // Materiales
            { id_publicacion: materiales[0].id_publicacion, id_etiqueta: eAED.id_etiqueta },
            { id_publicacion: materiales[0].id_publicacion, id_etiqueta: eBD1.id_etiqueta },
            { id_publicacion: materiales[1].id_publicacion, id_etiqueta: eIS1.id_etiqueta },
            { id_publicacion: materiales[2].id_publicacion, id_etiqueta: eBD1.id_etiqueta },
            { id_publicacion: materiales[3].id_publicacion, id_etiqueta: eCiencias.id_etiqueta },
            { id_publicacion: materiales[3].id_publicacion, id_etiqueta: eBioquim.id_etiqueta },
            { id_publicacion: materiales[4].id_publicacion, id_etiqueta: eBioquim.id_etiqueta },
            { id_publicacion: materiales[5].id_publicacion, id_etiqueta: ePOO.id_etiqueta },
            { id_publicacion: materiales[5].id_publicacion, id_etiqueta: eEDA.id_etiqueta },
            { id_publicacion: materiales[5].id_publicacion, id_etiqueta: eSO.id_etiqueta },
            { id_publicacion: materiales[6].id_publicacion, id_etiqueta: eBioCel.id_etiqueta },
            { id_publicacion: materiales[7].id_publicacion, id_etiqueta: eEDA.id_etiqueta },
            // Compra
            { id_publicacion: materiales[0].id_publicacion, id_etiqueta: eCompra.id_etiqueta },
            { id_publicacion: materiales[1].id_publicacion, id_etiqueta: eCompra.id_etiqueta },
            { id_publicacion: materiales[4].id_publicacion, id_etiqueta: eCompra.id_etiqueta },
            { id_publicacion: materiales[5].id_publicacion, id_etiqueta: eCompra.id_etiqueta },
            { id_publicacion: materiales[7].id_publicacion, id_etiqueta: eCompra.id_etiqueta },

            // Alquiler
            { id_publicacion: materiales[2].id_publicacion, id_etiqueta: eAlquiler.id_etiqueta },
            { id_publicacion: materiales[3].id_publicacion, id_etiqueta: eAlquiler.id_etiqueta },
            { id_publicacion: materiales[6].id_publicacion, id_etiqueta: eAlquiler.id_etiqueta },
            // Tutorías
            { id_publicacion: tutorias[0].id_publicacion, id_etiqueta: eAED.id_etiqueta },
            { id_publicacion: tutorias[1].id_publicacion, id_etiqueta: eBD1.id_etiqueta },
            { id_publicacion: tutorias[1].id_publicacion, id_etiqueta: eIS1.id_etiqueta },
            { id_publicacion: tutorias[2].id_publicacion, id_etiqueta: eRedes.id_etiqueta },
            { id_publicacion: tutorias[3].id_publicacion, id_etiqueta: eCiencias.id_etiqueta },
            { id_publicacion: tutorias[3].id_publicacion, id_etiqueta: eBioquim.id_etiqueta },
            { id_publicacion: tutorias[3].id_publicacion, id_etiqueta: eBioCel.id_etiqueta },
            { id_publicacion: tutorias[4].id_publicacion, id_etiqueta: eGenetica.id_etiqueta },
            { id_publicacion: tutorias[5].id_publicacion, id_etiqueta: eSO.id_etiqueta },
            { id_publicacion: tutorias[6].id_publicacion, id_etiqueta: eArq.id_etiqueta },
            { id_publicacion: tutorias[6].id_publicacion, id_etiqueta: eBD2.id_etiqueta },
            { id_publicacion: tutorias[7].id_publicacion, id_etiqueta: eMicro.id_etiqueta },
            // Presencial
            { id_publicacion: tutorias[0].id_publicacion, id_etiqueta: ePresencial.id_etiqueta },
            { id_publicacion: tutorias[2].id_publicacion, id_etiqueta: ePresencial.id_etiqueta },
            { id_publicacion: tutorias[6].id_publicacion, id_etiqueta: ePresencial.id_etiqueta },

            // En Línea
            { id_publicacion: tutorias[1].id_publicacion, id_etiqueta: eEnLinea.id_etiqueta },
            { id_publicacion: tutorias[4].id_publicacion, id_etiqueta: eEnLinea.id_etiqueta },
            { id_publicacion: tutorias[7].id_publicacion, id_etiqueta: eEnLinea.id_etiqueta },

            // Mixtas (ambas)
            { id_publicacion: tutorias[3].id_publicacion, id_etiqueta: ePresencial.id_etiqueta },
            { id_publicacion: tutorias[3].id_publicacion, id_etiqueta: eEnLinea.id_etiqueta },

            { id_publicacion: tutorias[5].id_publicacion, id_etiqueta: ePresencial.id_etiqueta },
            { id_publicacion: tutorias[5].id_publicacion, id_etiqueta: eEnLinea.id_etiqueta },
            // Negocios
            { id_publicacion: negocios[0].id_publicacion, id_etiqueta: eBD2.id_etiqueta },
            { id_publicacion: negocios[1].id_publicacion, id_etiqueta: eIA.id_etiqueta },
            { id_publicacion: negocios[1].id_publicacion, id_etiqueta: eAED.id_etiqueta },
            { id_publicacion: negocios[2].id_publicacion, id_etiqueta: eEcologia.id_etiqueta },
            { id_publicacion: negocios[3].id_publicacion, id_etiqueta: eAED.id_etiqueta },
            { id_publicacion: negocios[4].id_publicacion, id_etiqueta: eFisio.id_etiqueta },
            { id_publicacion: negocios[5].id_publicacion, id_etiqueta: eBD1.id_etiqueta },
            { id_publicacion: negocios[5].id_publicacion, id_etiqueta: eIS1.id_etiqueta },
            { id_publicacion: negocios[6].id_publicacion, id_etiqueta: eBotanica.id_etiqueta },
            { id_publicacion: negocios[7].id_publicacion, id_etiqueta: eIS1.id_etiqueta },
            { id_publicacion: negocios[7].id_publicacion, id_etiqueta: eRedes.id_etiqueta },
            { id_publicacion: negocios[7].id_publicacion, id_etiqueta: ePOO.id_etiqueta },
            // Servicios
            { id_publicacion: negocios[0].id_publicacion, id_etiqueta: eServicio.id_etiqueta },
            { id_publicacion: negocios[1].id_publicacion, id_etiqueta: eServicio.id_etiqueta },
            { id_publicacion: negocios[4].id_publicacion, id_etiqueta: eServicio.id_etiqueta },
            { id_publicacion: negocios[5].id_publicacion, id_etiqueta: eServicio.id_etiqueta },
            { id_publicacion: negocios[6].id_publicacion, id_etiqueta: eServicio.id_etiqueta },
            { id_publicacion: negocios[7].id_publicacion, id_etiqueta: eServicio.id_etiqueta },
            // Productos
            { id_publicacion: negocios[2].id_publicacion, id_etiqueta: eProducto.id_etiqueta },
            { id_publicacion: negocios[3].id_publicacion, id_etiqueta: eProducto.id_etiqueta },
        ],
    });

    //Aplicación de etiquetas especiales de compra/alquiler


    // Normalizar asociaciones heredadas de versiones previas del seed.
    await prisma.publicacionEtiqueta.deleteMany({
        where: { id_publicacion: { in: [...materiales, ...tutorias, ...negocios].map((p) => p.id_publicacion) } },
    });
    const etiquetasPorPublicacion: Array<[
        { id_publicacion: number },
        ...Array<{ id_etiqueta: number }>,
    ]> = [
            [materiales[0], eAED, eCompra], [materiales[1], eIS1, eAlquiler],
            [materiales[2], eBD1, eCompra], [materiales[3], eCiencias, eCompra],
            [materiales[4], eBioquim, eCompra], [materiales[5], ePOO, eCompra],
            [materiales[6], eCalculo2, eCompra], [materiales[7], eIS1, eCompra],
            [materiales[8], eElectronica1, eAlquiler],
            [tutorias[0], eAED, ePresencial], [tutorias[1], eBD1, eEnLinea],
            [tutorias[2], eCalculo1, ePresencial], [tutorias[3], eCiencias, ePresencial, eEnLinea],
            [tutorias[4], eIngles, eEnLinea], [tutorias[5], eMatDiscreta, ePresencial, eEnLinea],
            [tutorias[6], eFisica1, ePresencial], [tutorias[7], eEstadistica1, eEnLinea],
            [tutorias[8], eFisica2, eEnLinea],
            [negocios[0], eArteDiseno, eServicio], [negocios[1], eTecnologia, eServicio],
            [negocios[2], eServicios, eServicio], [negocios[3], eArteDiseno, eServicio],
            [negocios[4], eComunicacion, eServicio], [negocios[5], eArteDiseno, eServicio],
            [negocios[6], eTecnologia, eServicio], [negocios[7], eComunicacion, eServicio],
            [negocios[8], eReposteria, eProducto],
        ];
    await prisma.publicacionEtiqueta.createMany({
        data: etiquetasPorPublicacion.flatMap(([publicacion, ...etiquetas]) =>
            etiquetas.map((etiqueta) => ({
                id_publicacion: publicacion.id_publicacion,
                id_etiqueta: etiqueta.id_etiqueta,
            })),
        ),
    });

    console.log("  ✅ Etiquetas coherentes vinculadas a publicaciones");

    //Conversaciones
    const c1 = await prisma.conversacion.upsert({
        where: {
            id_usuario_1_id_usuario_2: {
                id_usuario_1: vendedor1.id_usuario,
                id_usuario_2: vendedor.id_usuario,
            },
        },
        update: { estado_conversacion: eActivo.id_estado },
        create: {
            id_usuario_1: vendedor1.id_usuario,
            id_usuario_2: vendedor.id_usuario,
            estado_conversacion: eActivo.id_estado,
        },
    });

    const c2 = await prisma.conversacion.upsert({
        where: {
            id_usuario_1_id_usuario_2: {
                id_usuario_1: comprador.id_usuario,
                id_usuario_2: vendedor.id_usuario,
            },
        },
        update: { estado_conversacion: ePendiente.id_estado },
        create: {
            id_usuario_1: comprador.id_usuario,
            id_usuario_2: vendedor.id_usuario,
            estado_conversacion: ePendiente.id_estado,
        },
    });

    // ─────────────────────────────────────────────
    // Mensajes de prueba para reportes
    // ─────────────────────────────────────────────
    const mensaje1 = await upsertMensaje(c1.id_conversacion, vendedor1.id_usuario,
        "Hola, estoy interesado en la tutoría de Cálculo 1.", eLeido.id_estado, new Date(SEED_NOW.getTime() - 4 * HOUR));
    const mensaje2 = await upsertMensaje(c1.id_conversacion, vendedor.id_usuario,
        "Te puedo ayudar con eso, podemos coordinar mañana.", eEnviado.id_estado, new Date(SEED_NOW.getTime() - 3 * HOUR));
    await upsertMensaje(c2.id_conversacion, comprador.id_usuario,
        "Hola, ¿aún tienes disponible el libro de Clean Code?", eEnviado.id_estado, new Date(SEED_NOW.getTime() - HOUR));

    await Promise.all([
        prisma.contextoConversacion.upsert({
            where: { id_conversacion_id_publicacion: { id_conversacion: c1.id_conversacion, id_publicacion: tutorias[2].id_publicacion } },
            update: { id_usuario: vendedor1.id_usuario, fecha_contexto: new Date(SEED_NOW.getTime() - 4 * HOUR) },
            create: { id_conversacion: c1.id_conversacion, id_publicacion: tutorias[2].id_publicacion, id_usuario: vendedor1.id_usuario, fecha_contexto: new Date(SEED_NOW.getTime() - 4 * HOUR) },
        }),
        prisma.contextoConversacion.upsert({
            where: { id_conversacion_id_publicacion: { id_conversacion: c2.id_conversacion, id_publicacion: materiales[1].id_publicacion } },
            update: { id_usuario: comprador.id_usuario, fecha_contexto: new Date(SEED_NOW.getTime() - HOUR) },
            create: { id_conversacion: c2.id_conversacion, id_publicacion: materiales[1].id_publicacion, id_usuario: comprador.id_usuario, fecha_contexto: new Date(SEED_NOW.getTime() - HOUR) },
        }),
    ]);

    console.log("  ✅ Mensajes de prueba");

    // ─────────────────────────────────────────────
    // Reportes de prueba
    // ─────────────────────────────────────────────
    await Promise.all([
        // Reporte de una publicación por parte de vendedor1
        upsertReportePrueba({
            id_emisor: vendedor1.id_usuario,
            id_receptor: vendedor.id_usuario,
            id_publicacion: materiales[0].id_publicacion,
            id_mensaje: null,
            motivo: motivosReporte[0].id_motivo,
            observaciones: "La publicación contiene información inapropiada.",
            estado: reportePendiente.id_estado,
            link_imagen: JSON.stringify([ASSETS.reporte]),
        }),

        // Reporte de otra publicación por parte de vendedor
        upsertReportePrueba({
            id_emisor: vendedor.id_usuario,
            id_receptor: vendedor1.id_usuario,
            id_publicacion: tutorias[3].id_publicacion,
            id_mensaje: null,
            motivo: motivosReporte[1].id_motivo,
            observaciones: "La publicación parece incumplir las normas de la plataforma.",
            estado: reportePendiente.id_estado,
        }),

        // Reporte de un mensaje enviado por vendedor1
        upsertReportePrueba({
            id_emisor: vendedor.id_usuario,
            id_receptor: vendedor1.id_usuario,
            id_publicacion: null,
            id_mensaje: mensaje1.id_mensaje,
            motivo: motivosReporte[2].id_motivo,
            observaciones: "El mensaje contiene contenido que debería ser revisado por moderación.",
            estado: reportePendiente.id_estado,
        }),

        // Reporte de un mensaje enviado por vendedor
        upsertReportePrueba({
            id_emisor: vendedor1.id_usuario,
            id_receptor: vendedor.id_usuario,
            id_publicacion: null,
            id_mensaje: mensaje2.id_mensaje,
            motivo: motivosReporte[0].id_motivo,
            observaciones: "El usuario envió un mensaje que considero inapropiado.",
            estado: reportePendiente.id_estado,
        }),

        // Reporte de una publicación de negocio
        upsertReportePrueba({
            id_emisor: vendedor1.id_usuario,
            id_receptor: vendedor.id_usuario,
            id_publicacion: negocios[1].id_publicacion,
            id_mensaje: null,
            motivo: motivosReporte[3].id_motivo,
            observaciones: "El servicio anunciado parece no corresponder con la descripción.",
            estado: reporteResuelto.id_estado,
            id_moderador: moderador.id_moderador,
        }),

        // Otro reporte de publicación
        upsertReportePrueba({
            id_emisor: vendedor.id_usuario,
            id_receptor: vendedor1.id_usuario,
            id_publicacion: materiales[3].id_publicacion,
            id_mensaje: null,
            motivo: motivosReporte[1].id_motivo,
            observaciones: "El material publicado podría infringir las reglas de contenido.",
            estado: reporteRechazado.id_estado,
            id_moderador: superadmin.id_moderador,
        }),

        // Reporte de un mensaje de tutoría
        upsertReportePrueba({
            id_emisor: vendedor1.id_usuario,
            id_receptor: vendedor.id_usuario,
            id_publicacion: null,
            id_mensaje: mensaje2.id_mensaje,
            motivo: motivosReporte[2].id_motivo,
            observaciones: "El mensaje enviado durante la tutoría contiene lenguaje inapropiado.",
            estado: reportePendiente.id_estado,
        }),


    ]);

    console.log("  ✅ Reportes de prueba");

    // ─────────────────────────────────────────────
    // Acuerdos de ejemplo
    // ─────────────────────────────────────────────
    await Promise.all([
        upsertAcuerdoPrueba({ id_usuario: vendedor1.id_usuario, id_publicacion: negocios[1].id_publicacion, observaciones: "Lleva tu lapiz y calculadora.", id_conversacion: c1.id_conversacion, fecha_entrega: new Date(SEED_NOW.getTime() - 20 * DAY), id_ofertante: vendedor1.id_usuario, lugar_entrega: "Plaza Paiz", estado: eCompletado.id_estado }),
        upsertAcuerdoPrueba({ id_usuario: vendedor.id_usuario, id_publicacion: negocios[4].id_publicacion, observaciones: "Encontrarnos en el carril bici.", id_conversacion: c1.id_conversacion, fecha_entrega: new Date(SEED_NOW.getTime() - 18 * DAY), id_ofertante: vendedor.id_usuario, lugar_entrega: "Plaza Isabel Gutierrez de Bosch", estado: eCompletado.id_estado }),
        upsertAcuerdoPrueba({ id_usuario: vendedor1.id_usuario, id_publicacion: tutorias[2].id_publicacion, observaciones: "Trae tus libros de mate.", id_conversacion: c1.id_conversacion, fecha_entrega: new Date(SEED_NOW.getTime() - 15 * DAY), id_ofertante: vendedor1.id_usuario, lugar_entrega: "Plaza Isabel Gutierrez de Bosch", estado: eCompletado.id_estado }),
        upsertAcuerdoPrueba({ id_usuario: vendedor.id_usuario, id_publicacion: tutorias[4].id_publicacion, observaciones: "Hagamos un grupos de estudio.", id_conversacion: c1.id_conversacion, fecha_entrega: new Date(SEED_NOW.getTime() - 14 * DAY), id_ofertante: vendedor.id_usuario, lugar_entrega: "CIT", estado: eCompletado.id_estado }),
        upsertAcuerdoPrueba({ id_usuario: vendedor1.id_usuario, id_publicacion: materiales[5].id_publicacion, observaciones: "Trae tus cuadernos viejos.", id_conversacion: c1.id_conversacion, fecha_entrega: new Date(SEED_NOW.getTime() + 2 * DAY), id_ofertante: vendedor1.id_usuario, lugar_entrega: "Campus Central", estado: ePendiente.id_estado }),
        upsertAcuerdoPrueba({ id_usuario: vendedor1.id_usuario, id_publicacion: negocios[5].id_publicacion, observaciones: "Seria ideal vernos un fin de semana.", id_conversacion: c1.id_conversacion, fecha_entrega: new Date(SEED_NOW.getTime() + 7 * DAY), id_ofertante: vendedor1.id_usuario, lugar_entrega: "Plaza Cayalá", estado: eActivo.id_estado }),
        upsertAcuerdoPrueba({ id_usuario: vendedor.id_usuario, id_publicacion: tutorias[5].id_publicacion, observaciones: "Quizás a media semana sea mejor para ambos.", id_conversacion: c1.id_conversacion, fecha_entrega: new Date(SEED_NOW.getTime() - 3 * DAY), id_ofertante: vendedor.id_usuario, lugar_entrega: "Biblioteca Central", estado: eCompletado.id_estado }),
        upsertAcuerdoPrueba({ id_usuario: vendedor.id_usuario, id_publicacion: materiales[6].id_publicacion, observaciones: "Lleva tus apuntes de clase.", id_conversacion: c1.id_conversacion, fecha_entrega: new Date(SEED_NOW.getTime() - 8 * DAY), id_ofertante: vendedor.id_usuario, lugar_entrega: "Plaza Paiz", estado: eCompletado.id_estado }),
        upsertAcuerdoPrueba({ id_usuario: vendedor.id_usuario, id_publicacion: materiales[3].id_publicacion, observaciones: "Historial consumidor vendedor - compra de material.", id_conversacion: c1.id_conversacion, fecha_entrega: new Date(SEED_NOW.getTime() - 10 * DAY), id_ofertante: vendedor.id_usuario, lugar_entrega: "Cafetería Central", estado: eCompletado.id_estado }),
        upsertAcuerdoPrueba({ id_usuario: vendedor.id_usuario, id_publicacion: negocios[2].id_publicacion, observaciones: "Historial consumidor vendedor - producto comprado.", id_conversacion: c1.id_conversacion, fecha_entrega: new Date(SEED_NOW.getTime() - 6 * DAY), id_ofertante: vendedor.id_usuario, lugar_entrega: "Edificio CIT", estado: eCompletado.id_estado }),
        upsertAcuerdoPrueba({ id_usuario: vendedor.id_usuario, id_publicacion: tutorias[7].id_publicacion, observaciones: "Historial consumidor vendedor - tutoría tomada.", id_conversacion: c1.id_conversacion, fecha_entrega: new Date(SEED_NOW.getTime() - 3 * DAY), id_ofertante: vendedor.id_usuario, lugar_entrega: "Biblioteca UVG", estado: eCompletado.id_estado }),
    ]);

    const lugaresHistorial = [
        "Cafetería Central",
        "Biblioteca UVG",
        "Edificio CIT",
        "Plaza Paiz",
        "Campus Central",
        "Plaza Isabel Gutierrez de Bosch",
    ];

    const productosHistorial = [...materiales, ...negocios, ...materiales.slice(0, 4)];
    const tutoriasHistorial = [...tutorias, ...tutorias, ...tutorias.slice(0, 4)];

    await Promise.all([
        ...productosHistorial.map((publicacion, index) =>
            upsertAcuerdoPrueba({
                id_usuario: publicacion.id_usuario === vendedor.id_usuario ? vendedor1.id_usuario : vendedor.id_usuario,
                id_publicacion: publicacion.id_publicacion,
                observaciones: `Historial largo consumidor vendedor - producto ${index + 1}`,
                id_conversacion: c1.id_conversacion,
                fecha_entrega: new Date(SEED_NOW.getTime() - (index + 1) * DAY),
                lugar_entrega: lugaresHistorial[index % lugaresHistorial.length],
                estado: eCompletado.id_estado,
                id_ofertante: publicacion.id_usuario === vendedor.id_usuario ? vendedor1.id_usuario : vendedor.id_usuario,
            })
        ),
        ...tutoriasHistorial.map((publicacion, index) =>
            upsertAcuerdoPrueba({
                id_usuario: publicacion.id_usuario === vendedor.id_usuario ? vendedor1.id_usuario : vendedor.id_usuario,
                id_publicacion: publicacion.id_publicacion,
                observaciones: `Historial largo consumidor vendedor - tutoría ${index + 1}`,
                id_conversacion: c1.id_conversacion,
                fecha_entrega: new Date(SEED_NOW.getTime() - (index + 1) * 12 * HOUR),
                lugar_entrega: lugaresHistorial[(index + 2) % lugaresHistorial.length],
                estado: eCompletado.id_estado,
                id_ofertante: publicacion.id_usuario === vendedor.id_usuario ? vendedor1.id_usuario : vendedor.id_usuario,
            })
        ),
    ]);

    console.log("  ✅ Acuerdos de ejemplo e historial de consumo coherente");

    // ─── Horarios de tutoría ───
    const horarios = [
        { id_usuario: vendedor.id_usuario, dia: "lunes" as const, inicio: "15:00:00", fin: "17:00:00" },
        { id_usuario: vendedor.id_usuario, dia: "miercoles" as const, inicio: "14:00:00", fin: "18:00:00" },
        { id_usuario: vendedor1.id_usuario, dia: "martes" as const, inicio: "09:00:00", fin: "12:00:00" },
        { id_usuario: vendedor1.id_usuario, dia: "jueves" as const, inicio: "13:00:00", fin: "16:00:00" },
        { id_usuario: vendedor1.id_usuario, dia: "viernes" as const, inicio: "18:00:00", fin: "20:00:00" },
    ];
    for (const horario of horarios) {
        const hora_inicio = new Date(`1970-01-01T${horario.inicio}.000Z`);
        const hora_fin = new Date(`1970-01-01T${horario.fin}.000Z`);
        const existing = await prisma.tiempoDisponible.findFirst({
            where: { id_usuario: horario.id_usuario, dia: horario.dia, hora_inicio, hora_fin },
        });
        if (!existing) {
            await prisma.tiempoDisponible.create({
                data: { id_usuario: horario.id_usuario, dia: horario.dia, hora_inicio, hora_fin, estadoId_estado: eDisponible.id_estado },
            });
        } else {
            await prisma.tiempoDisponible.update({ where: { id_tiempo: existing.id_tiempo }, data: { estadoId_estado: eDisponible.id_estado } });
        }
    }

    // ─── Certificaciones ───
    const certificaciones = [
        { id_usuario: vendedor.id_usuario, nombre: "Certificación de algoritmos", lugar_emision: "Universidad del Valle de Guatemala", id_etiqueta: eAED.id_etiqueta },
        { id_usuario: vendedor1.id_usuario, nombre: "Fundamentos de biología celular", lugar_emision: "Universidad del Valle de Guatemala", id_etiqueta: eBioCel.id_etiqueta },
    ];
    for (const certificacion of certificaciones) {
        const existing = await prisma.certificacion.findFirst({ where: { id_usuario: certificacion.id_usuario, nombre: certificacion.nombre } });
        const data = { ...certificacion, ruta_pdf: ASSETS.certificacion };
        if (!existing) await prisma.certificacion.create({ data });
        else await prisma.certificacion.update({ where: { id_certificacion: existing.id_certificacion }, data });
    }

    // ─── Reseñas, favoritos y guardados ───
    await Promise.all([
        upsertResena(comprador.id_usuario, vendedor.id_usuario, trVendedor.id_tipo_resena,
            "Entrega puntual y material en excelente estado.", 5, new Date(SEED_NOW.getTime() - 12 * DAY)),
        upsertResena(vendedor.id_usuario, comprador.id_usuario, trConsumidor.id_tipo_resena,
            "Comunicación clara y pago puntual.", 5, new Date(SEED_NOW.getTime() - 11 * DAY)),
        upsertResena(vendedor.id_usuario, vendedor1.id_usuario, trTutor.id_tipo_resena,
            "Explica con paciencia y utiliza buenos ejemplos.", 4, new Date(SEED_NOW.getTime() - 5 * DAY)),
    ]);
    await Promise.all([
        prisma.usuarioPublicacion.upsert({
            where: { id_usuario_id_publicacion: { id_usuario: comprador.id_usuario, id_publicacion: materiales[0].id_publicacion } },
            update: { is_like: true, is_save: true },
            create: { id_usuario: comprador.id_usuario, id_publicacion: materiales[0].id_publicacion, is_like: true, is_save: true },
        }),
        prisma.usuarioPublicacion.upsert({
            where: { id_usuario_id_publicacion: { id_usuario: comprador.id_usuario, id_publicacion: tutorias[2].id_publicacion } },
            update: { is_like: true, is_save: false },
            create: { id_usuario: comprador.id_usuario, id_publicacion: tutorias[2].id_publicacion, is_like: true, is_save: false },
        }),
        prisma.usuarioPublicacion.upsert({
            where: { id_usuario_id_publicacion: { id_usuario: vendedor1.id_usuario, id_publicacion: negocios[1].id_publicacion } },
            update: { is_like: false, is_save: true },
            create: { id_usuario: vendedor1.id_usuario, id_publicacion: negocios[1].id_publicacion, is_like: false, is_save: true },
        }),
    ]);
    await Promise.all([
        prisma.publicacion.update({ where: { id_publicacion: materiales[0].id_publicacion }, data: { me_gusta: 1 } }),
        prisma.publicacion.update({ where: { id_publicacion: tutorias[2].id_publicacion }, data: { me_gusta: 1 } }),
        prisma.usuario.update({ where: { id_usuario: vendedor.id_usuario }, data: { total_resenas: 1, calificacion: 5 } }),
        prisma.usuario.update({ where: { id_usuario: vendedor1.id_usuario }, data: { total_resenas: 1, calificacion: 4 } }),
        prisma.usuario.update({ where: { id_usuario: comprador.id_usuario }, data: { total_resenas: 1, calificacion: 5 } }),
    ]);

    await Promise.all([
        upsertNotificacion(vendedor.id_usuario, "Sofía guardó tu publicación de apuntes de AED.", eEnviado.id_estado, new Date(SEED_NOW.getTime() - 2 * HOUR)),
        upsertNotificacion(vendedor1.id_usuario, "Tu reporte fue revisado por moderación.", eLeido.id_estado, new Date(SEED_NOW.getTime() - DAY)),
        upsertNotificacion(comprador.id_usuario, "Carlos respondió a tu conversación.", eEnviado.id_estado, new Date(SEED_NOW.getTime() - HOUR)),
    ]);

    // El modelo legado Eventos también queda representado, además del
    // catálogo EventoRecomendacion mantenido por seed.ts.
    for (const evento of [{ nombre: "VISITA_PUBLICACION", peso: 1 }, { nombre: "CONTACTO", peso: 3 }]) {
        const existing = await prisma.eventos.findFirst({ where: { nombre: evento.nombre } });
        if (!existing) await prisma.eventos.create({ data: evento });
        else await prisma.eventos.update({ where: { id_evento: existing.id_evento }, data: evento });
    }

    console.log("  ✅ Horarios, certificaciones, reseñas, interacciones y notificaciones");

    // ─────────────────────────────────────────────
    // Etiquetas asignadas a usuarios
    // ─────────────────────────────────────────────
    await prisma.usuarioEtiqueta.createMany({
        skipDuplicates: true,
        data: [
            { id_usuario: vendedor.id_usuario, id_etiqueta: etiquetaIng.id_etiqueta },
            { id_usuario: vendedor.id_usuario, id_etiqueta: eAED.id_etiqueta },
            { id_usuario: vendedor.id_usuario, id_etiqueta: eBD1.id_etiqueta },
            { id_usuario: vendedor.id_usuario, id_etiqueta: ePOO.id_etiqueta },
            { id_usuario: vendedor.id_usuario, id_etiqueta: eEDA.id_etiqueta },
            { id_usuario: vendedor.id_usuario, id_etiqueta: eSO.id_etiqueta },
            { id_usuario: vendedor.id_usuario, id_etiqueta: eArq.id_etiqueta },
        ],
    });

    await prisma.usuarioEtiqueta.createMany({
        skipDuplicates: true,
        data: [
            { id_usuario: comprador.id_usuario, id_etiqueta: etiquetaIng.id_etiqueta, peso: 2 },
            { id_usuario: comprador.id_usuario, id_etiqueta: eAED.id_etiqueta, peso: 1.7 },
            { id_usuario: comprador.id_usuario, id_etiqueta: eBD1.id_etiqueta, peso: 1.4 },
        ],
    });

    await prisma.usuarioEtiqueta.createMany({
        skipDuplicates: true,
        data: [
            { id_usuario: vendedor1.id_usuario, id_etiqueta: etiquetaBio.id_etiqueta },
            { id_usuario: vendedor1.id_usuario, id_etiqueta: eCiencias.id_etiqueta },
            { id_usuario: vendedor1.id_usuario, id_etiqueta: eBioquim.id_etiqueta },
            { id_usuario: vendedor1.id_usuario, id_etiqueta: eBioCel.id_etiqueta },
            { id_usuario: vendedor1.id_usuario, id_etiqueta: eGenetica.id_etiqueta },
            { id_usuario: vendedor1.id_usuario, id_etiqueta: eMicro.id_etiqueta },
            { id_usuario: vendedor1.id_usuario, id_etiqueta: eEcologia.id_etiqueta },
        ],
    });



    // ─────────────────────────────────────────────
    //  Anuncios de usaurios
    // ─────────────────────────────────────────────

    const anuncios = [
        [vendedor.id_usuario, "¡Oferta de bienvenida!", "10% de descuento en tu primera compra o tutoría. ¡Aprovecha esta oferta especial para nuevos usuarios!"],
        [vendedor1.id_usuario, "¡Material destacado del mes!", "Este mes destacamos nuestros resúmenes y guías con un 15% de descuento."],
        [vendedor.id_usuario, "¡Tutorías personalizadas!", "Sesiones personalizadas para adaptarnos a tus necesidades. ¡Contáctanos!"],
        [vendedor1.id_usuario, "¡Asesoría en Excel avanzado!", "Aprende macros, tablas dinámicas y automatización con ejemplos prácticos."],
    ] as const;
    await Promise.all(anuncios.map(([idUsuario, titulo, descripcion], index) =>
        upsertAnuncio(idUsuario, titulo, descripcion, ASSETS.anuncio, new Date(SEED_NOW.getTime() - index * DAY)),
    ));


    console.log("  ✅ Etiquetas de usuario y anuncios vinculados");

    // Evidencia reproducible de cobertura. Estas consultas usan las mismas
    // relaciones que consumen las vistas y fallan si una sección quedó vacía.
    const emailsSeed = [vendedor.email_institucional, vendedor1.email_institucional, comprador.email_institucional];
    const titulosSeed = [...materiales, ...tutorias, ...negocios].map((p) => p.titulo);
    const evidencia = {
        usuarios: await prisma.usuario.count({ where: { email_institucional: { in: emailsSeed } } }),
        contactos: await prisma.contacto.count({ where: { usuario: { email_institucional: { in: emailsSeed } } } }),
        horarios: await prisma.tiempoDisponible.count({ where: { usuario: { email_institucional: { in: emailsSeed } } } }),
        certificaciones: await prisma.certificacion.count({ where: { usuario: { email_institucional: { in: emailsSeed } } } }),
        publicaciones: await prisma.publicacion.count({ where: { titulo: { in: titulosSeed } } }),
        publicacionesConImagen: await prisma.publicacion.count({ where: { titulo: { in: titulosSeed }, imagenes: { some: {} } } }),
        publicacionesConEtiqueta: await prisma.publicacion.count({ where: { titulo: { in: titulosSeed }, etiquetas: { some: {} } } }),
        conversaciones: await prisma.conversacion.count({ where: { OR: [{ id_conversacion: c1.id_conversacion }, { id_conversacion: c2.id_conversacion }] } }),
        mensajes: await prisma.mensaje.count({ where: { id_conversacion: { in: [c1.id_conversacion, c2.id_conversacion] } } }),
        contextos: await prisma.contextoConversacion.count({ where: { id_conversacion: { in: [c1.id_conversacion, c2.id_conversacion] } } }),
        acuerdos: await prisma.acuerdo.count({ where: { id_conversacion: c1.id_conversacion } }),
        resenas: await prisma.resena.count({ where: { OR: [{ id_emisor: { in: [vendedor.id_usuario, vendedor1.id_usuario, comprador.id_usuario] } }, { id_receptor: { in: [vendedor.id_usuario, vendedor1.id_usuario, comprador.id_usuario] } }] } }),
        reportes: await prisma.reporte.count({ where: { id_emisor: { in: [vendedor.id_usuario, vendedor1.id_usuario] } } }),
        notificaciones: await prisma.notificacion.count({ where: { id_usuario: { in: [vendedor.id_usuario, vendedor1.id_usuario, comprador.id_usuario] } } }),
        interacciones: await prisma.usuarioPublicacion.count({ where: { id_usuario: { in: [vendedor.id_usuario, vendedor1.id_usuario, comprador.id_usuario] } } }),
        anuncios: await prisma.anuncio.count({ where: { id_usuario: { in: [vendedor.id_usuario, vendedor1.id_usuario] } } }),
    };
    const minimos: Record<keyof typeof evidencia, number> = {
        usuarios: 3, contactos: 10, horarios: 5, certificaciones: 2,
        publicaciones: 27, publicacionesConImagen: 27, publicacionesConEtiqueta: 27,
        conversaciones: 2, mensajes: 3, contextos: 2, acuerdos: 11,
        resenas: 3, reportes: 7, notificaciones: 3, interacciones: 3, anuncios: 4,
    };
    const incompletos = Object.entries(evidencia).filter(([nombre, total]) => total < minimos[nombre as keyof typeof evidencia]);
    if (incompletos.length) {
        throw new Error(`Validación integral incompleta: ${incompletos.map(([n, v]) => `${n}=${v}`).join(", ")}`);
    }
    console.table(evidencia);
    console.log("  ✅ Cobertura y relaciones verificadas");

    console.log("\n✅ Seed de prueba completado.");
    console.log("\n▶  Credenciales:");
    console.log("   Usuario   : vendedor@uvg.edu.gt    / Vendedor123!");
    console.log("   Usuario   : vendedor123@uvg.edu.gt / Vendedor123!");
    console.log("   Usuario   : estudiante@uvg.edu.gt  / Estudiante123!");
    console.log("   Moderador : moderador1              / Moderador123!  (nivel: moderador)");
    console.log("   Moderador : superadmin1             / SuperAdmin123!  (nivel: superadmin)");
}

main()
    .catch((e) => {
        console.error("❌ Error en seed de prueba:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
