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
 * Crea:
 *   - 1 moderador de prueba
 *   - 2 usuarios vendedores de prueba
 *   - 8 publicaciones de material, 8 tutorías, 8 negocios
 *   - Relaciones de etiquetas por publicación
 *   - Acuerdos de ejemplo
 *   - Etiquetas asignadas a los usuarios
 *
 * Uso (con los contenedores corriendo):
 *   docker compose exec api npx ts-node --transpile-only prisma/seedPruebas.ts
 *
 * Credenciales creadas:
 *   Usuario   : vendedor@uvg.edu.gt    / Vendedor123!
 *   Usuario   : vendedor123@uvg.edu.gt / Vendedor123!
 *   Moderador : moderador1             / Moderador123!
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

// ─── Helper: busca una publicación por título, la crea si no existe ───────────
async function findOrCreatePublicacion(
    data: Parameters<typeof prisma.publicacion.create>[0]["data"]
) {
    const existing = await prisma.publicacion.findFirst({
        where: { titulo: data.titulo as string },
    });
    return existing ?? (await prisma.publicacion.create({ data }));
}

async function main() {
    console.log("🌱 Iniciando seed de datos de prueba...");

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
    const eActivo     = await prisma.estado.findUniqueOrThrow({ where: { estado: "activo" } });
    const ePendiente  = await prisma.estado.findUniqueOrThrow({ where: { estado: "pendiente" } });
    const eCompletado = await prisma.estado.findUniqueOrThrow({ where: { estado: "completado" } });

    const tMaterial = await prisma.tipoPerfil.findUniqueOrThrow({ where: { tipo_perfil: "material" } });
    const tTutoria  = await prisma.tipoPerfil.findUniqueOrThrow({ where: { tipo_perfil: "tutoria" } });
    const tNegocio  = await prisma.tipoPerfil.findUniqueOrThrow({ where: { tipo_perfil: "negocio" } });

    const tcWa = await prisma.tipoContacto.findUniqueOrThrow({ where: { tipo_contacto: "whatsapp" } });
    const tcIg = await prisma.tipoContacto.findUniqueOrThrow({ where: { tipo_contacto: "instagram" } });

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

    console.log("  ✅ Catálogos de referencia leídos");

    // ─────────────────────────────────────────────
    // Moderador
    // ─────────────────────────────────────────────
    await prisma.moderador.upsert({
        where:  { usuario: "moderador1" },
        update: {},
        create: {
            usuario:  "moderador1",
            password: await bcrypt.hash("Moderador123!", SALT_ROUNDS),
        },
    });
    console.log("  ✅ Moderador");

    // ─────────────────────────────────────────────
    // Usuarios de prueba
    // ─────────────────────────────────────────────
    const vendedor = await prisma.usuario.upsert({
        where:  { email_institucional: "vendedor@uvg.edu.gt" },
        update: {},
        create: {
            nombre:              "Carlos Méndez",
            carnet:              21002,
            email_institucional: "vendedor@uvg.edu.gt",
            password:            await bcrypt.hash("Vendedor123!", SALT_ROUNDS),
            url_foto_perfil:     "https://i.pravatar.cc/150?u=vendedor",
            descripcion:         "Usuario de prueba — vende materiales, ofrece tutorías y servicios.",
            calificacion:        4.8,
        },
    });

    await prisma.contacto.createMany({
        skipDuplicates: true,
        data: [
            { id_usuario: vendedor.id_usuario, tipo_contacto: tcWa.id_tipo_contacto, valor: "+502 5555-1001" },
            { id_usuario: vendedor.id_usuario, tipo_contacto: tcIg.id_tipo_contacto, valor: "@carlos.mendez.uvg" },
        ],
    });

    const vendedor1 = await prisma.usuario.upsert({
        where:  { email_institucional: "vendedor123@uvg.edu.gt" },
        update: {},
        create: {
            nombre:              "Adriana Jiménez",
            carnet:              21064,
            email_institucional: "vendedor123@uvg.edu.gt",
            password:            await bcrypt.hash("Vendedor123!", SALT_ROUNDS),
            url_foto_perfil:     "https://i.pravatar.cc/150?u=vendedor1",
            descripcion:         "Usuario de prueba — vende materiales, ofrece tutorías y servicios.",
            calificacion:        4.2,
        },
    });

    await prisma.contacto.createMany({
        skipDuplicates: true,
        data: [
            { id_usuario: vendedor1.id_usuario, tipo_contacto: tcWa.id_tipo_contacto, valor: "+502 5164-8081" },
            { id_usuario: vendedor1.id_usuario, tipo_contacto: tcIg.id_tipo_contacto, valor: "@adriana.jimenez.uvg" },
        ],
    });

    console.log("  ✅ Usuarios de prueba");

    // ─────────────────────────────────────────────
    // Publicaciones de prueba
    // ─────────────────────────────────────────────
    const materiales = await Promise.all([
        findOrCreatePublicacion({ titulo: "Apuntes de AED — Árboles y Grafos",    descripcion: "Apuntes completos del tema 3, incluye ejercicios resueltos.",           precio: 15.00,  estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor.id_usuario  }),
        findOrCreatePublicacion({ titulo: "Libro: Clean Code — Robert Martin",    descripcion: "Libro físico en buen estado, ideal para IS1.",                          precio: 80.00,  estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor.id_usuario  }),
        findOrCreatePublicacion({ titulo: "Guías de BD1 — Semestre I 2024",       descripcion: "Todas las guías del curso con soluciones.",                             precio: 20.00,  estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor.id_usuario  }),
        findOrCreatePublicacion({ titulo: "Flashcards de Anatomía",               descripcion: "200 tarjetas de estudio de anatomía humana.",                           precio: 30.00,  estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor1.id_usuario }),
        findOrCreatePublicacion({ titulo: "Resúmenes de Bioquímica",              descripcion: "Resúmenes de todos los parciales con diagramas.",                       precio: 25.00,  estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor1.id_usuario }),
        findOrCreatePublicacion({ titulo: "Manual de Python para Data Science",   descripcion: "Guía completa de Python con ejercicios prácticos.",                     precio: 45.00,  estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor.id_usuario  }),
        findOrCreatePublicacion({ titulo: "Cuaderno de ejercicios de Cálculo 2",  descripcion: "100 problemas resueltos paso a paso.",                                  precio: 35.00,  estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor1.id_usuario }),
        findOrCreatePublicacion({ titulo: "Plantillas de tesis en LaTeX",         descripcion: "Plantilla lista para usar, incluye tutorial.",                          precio: 25.00,  estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor.id_usuario  }),
    ]);

    const tutorias = await Promise.all([
        findOrCreatePublicacion({ titulo: "Tutoría de AED — Recursión y Grafos",  descripcion: "Sesiones personalizadas, 1 hora, virtual o presencial.",               precio: 50.00,  estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor.id_usuario  }),
        findOrCreatePublicacion({ titulo: "Tutoría de BD1 — SQL y Diseño",        descripcion: "Ayuda con consultas SQL, ER y normalización.",                          precio: 45.00,  estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor.id_usuario  }),
        findOrCreatePublicacion({ titulo: "Tutoría de Cálculo 1",                 descripcion: "Límites, derivadas e integrales.",                                      precio: 40.00,  estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor.id_usuario  }),
        findOrCreatePublicacion({ titulo: "Tutoría de Anatomía Humana",           descripcion: "Repaso de anatomía enfocado en exámenes.",                              precio: 55.00,  estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor1.id_usuario }),
        findOrCreatePublicacion({ titulo: "Tutoría de Inglés Técnico",            descripcion: "Preparación para el examen de Inglés Técnico UVG.",                    precio: 35.00,  estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor1.id_usuario }),
        findOrCreatePublicacion({ titulo: "Tutoría de Matemática Discreta",       descripcion: "Lógica, conjuntos, combinatoria y grafos.",                             precio: 50.00,  estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor1.id_usuario }),
        findOrCreatePublicacion({ titulo: "Tutoría de Física 1",                  descripcion: "Mecánica clásica, cinemática y dinámica.",                              precio: 45.00,  estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor.id_usuario  }),
        findOrCreatePublicacion({ titulo: "Tutoría de Estadística 1",             descripcion: "Probabilidad, distribuciones y análisis de datos.",                     precio: 40.00,  estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor1.id_usuario }),
    ]);

    const negocios = await Promise.all([
        findOrCreatePublicacion({ titulo: "Diseño de logos universitarios",        descripcion: "Logo profesional para tu proyecto o startup. Entrega en 48h.",        precio: 100.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor.id_usuario  }),
        findOrCreatePublicacion({ titulo: "Desarrollo de landing pages",           descripcion: "Landing pages con HTML/CSS/JS. Precio por página.",                   precio: 200.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor.id_usuario  }),
        findOrCreatePublicacion({ titulo: "Impresión y encuadernación",            descripcion: "Servicio de impresión en campus, blanco/negro y color.",              precio: 5.00,   estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor1.id_usuario }),
        findOrCreatePublicacion({ titulo: "Fotografía para presentaciones",        descripcion: "Fotos profesionales para defensa de tesis o presentación.",           precio: 150.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor.id_usuario  }),
        findOrCreatePublicacion({ titulo: "Traducción de documentos ES/EN",        descripcion: "Documentos técnicos y académicos. Precio por página.",                precio: 25.00,  estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor1.id_usuario }),
        findOrCreatePublicacion({ titulo: "Edición de videos promocionales",       descripcion: "Edición profesional para proyectos y presentaciones.",                precio: 120.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor.id_usuario  }),
        findOrCreatePublicacion({ titulo: "Asesoría en Excel avanzado",            descripcion: "Macros, tablas dinámicas y automatización.",                          precio: 60.00,  estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor1.id_usuario }),
        findOrCreatePublicacion({ titulo: "Redacción de CV y carta de presentación", descripcion: "CV profesional adaptado a tu perfil.",                             precio: 50.00,  estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor.id_usuario  }),
    ]);

    console.log("  ✅ Publicaciones (8 materiales · 8 tutorías · 8 negocios)");

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
        ],
    });

    console.log("  ✅ Etiquetas vinculadas a publicaciones");

    // ─────────────────────────────────────────────
    // Acuerdos de ejemplo
    // ─────────────────────────────────────────────
    await prisma.acuerdo.createMany({
        skipDuplicates: true,
        data: [
            { id_usuario: vendedor1.id_usuario, id_publicacion: negocios[1].id_publicacion,   fecha_entrega: new Date(),                                       lugar_entrega: "Plaza Paiz",                       estado: eCompletado.id_estado },
            { id_usuario: vendedor.id_usuario,  id_publicacion: negocios[4].id_publicacion,   fecha_entrega: new Date(),                                       lugar_entrega: "Plaza Isabel Gutierrez de Bosch",  estado: ePendiente.id_estado  },
            { id_usuario: vendedor1.id_usuario, id_publicacion: tutorias[2].id_publicacion,   fecha_entrega: new Date(),                                       lugar_entrega: "Plaza Isabel Gutierrez de Bosch",  estado: eCompletado.id_estado },
            { id_usuario: vendedor.id_usuario,  id_publicacion: tutorias[4].id_publicacion,   fecha_entrega: new Date(),                                       lugar_entrega: "CIT",                              estado: ePendiente.id_estado  },
            { id_usuario: vendedor1.id_usuario, id_publicacion: materiales[5].id_publicacion, fecha_entrega: new Date(),                                       lugar_entrega: "Campus Central",                   estado: ePendiente.id_estado  },
            { id_usuario: vendedor1.id_usuario, id_publicacion: negocios[5].id_publicacion,   fecha_entrega: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),  lugar_entrega: "Plaza Cayalá",                     estado: eActivo.id_estado     },
            { id_usuario: vendedor.id_usuario,  id_publicacion: tutorias[5].id_publicacion,   fecha_entrega: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),  lugar_entrega: "Biblioteca Central",               estado: eCompletado.id_estado },
            { id_usuario: vendedor.id_usuario,  id_publicacion: materiales[6].id_publicacion, fecha_entrega: new Date(),                                       lugar_entrega: "Plaza Paiz",                       estado: ePendiente.id_estado  },
        ],
    });

    console.log("  ✅ Acuerdos de ejemplo");

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

    await prisma.anuncio.createMany({
        skipDuplicates: true,
        data: [
            { id_usuario: vendedor.id_usuario, titulo: "¡Oferta de bienvenida!", descripcion: "10% de descuento en tu primera compra o tutoría. ¡Aprovecha esta oferta especial para nuevos usuarios!", fecha_anuncio: new Date(), imagen_url: "https://i.pravatar.cc/300?u=anuncio1" },
            { id_usuario: vendedor1.id_usuario, titulo: "¡Material destacado del mes!", descripcion: "Este mes destacamos nuestro 'Manual de Python para Data Science' con un 15% de descuento. ¡No te lo pierdas!", fecha_anuncio: new Date(), imagen_url: "https://i.pravatar.cc/300?u=anuncio2" },
            { id_usuario: vendedor.id_usuario, titulo: "¡Tutorías personalizadas!", descripcion: "¿Necesitas ayuda con un tema específico? Ofrecemos tutorías personalizadas para adaptarnos a tus necesidades. ¡Contáctanos!", fecha_anuncio: new Date(), imagen_url: "https://i.pravatar.cc/300?u=anuncio3" },
            { id_usuario: vendedor.id_usuario, titulo: "¡Servicio de impresión exprés!", descripcion: "¿Necesitas imprimir algo urgente? Ofrecemos servicio de impresión exprés en campus. ¡Entrega en el mismo día!", fecha_anuncio: new Date(), imagen_url: "https://i.pravatar.cc/300?u=anuncio4" },
            { id_usuario: vendedor1.id_usuario, titulo: "¡Asesoría en Excel avanzado!", descripcion: "¿Quieres dominar Excel? Ofrecemos asesoría en Excel avanzado para ayudarte a mejorar tus habilidades. ¡Contáctanos!", fecha_anuncio: new Date(), imagen_url: "https://i.pravatar.cc/300?u=anuncio5" },
            { id_usuario: vendedor1.id_usuario, titulo: "¡Descuentos por temporada!", descripcion: "Aprovecha nuestros descuentos por temporada en materiales seleccionados. ¡Consulta nuestras ofertas actuales!", fecha_anuncio: new Date(), imagen_url: "https://i.pravatar.cc/300?u=anuncio6" },
            { id_usuario: vendedor.id_usuario, titulo: "¡Nuevos materiales disponibles!", descripcion: "Hemos agregado nuevos materiales a nuestro catálogo. ¡Echa un vistazo y encuentra lo que necesitas!", fecha_anuncio: new Date(), imagen_url: "https://i.pravatar.cc/300?u=anuncio7" },
            { id_usuario: vendedor1.id_usuario, titulo: "¡Servicios de diseño gráfico!", descripcion: "¿Necesitas un logo o una presentación impactante? Ofrecemos servicios de diseño gráfico para ayudarte a destacar. ¡Contáctanos!", fecha_anuncio: new Date(), imagen_url: "https://i.pravatar.cc/300?u=anuncio8"   },
        ],
    }); 


    console.log("  ✅ Etiquetas de usuario vinculadas");

    console.log("\n✅ Seed de prueba completado.");
    console.log("\n▶  Credenciales:");
    console.log("   Usuario   : vendedor@uvg.edu.gt    / Vendedor123!");
    console.log("   Usuario   : vendedor123@uvg.edu.gt / Vendedor123!");
    console.log("   Moderador : moderador1              / Moderador123!");
}

main()
    .catch((e) => {
        console.error("❌ Error en seed de prueba:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });