import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

async function main() {
    console.log("🌱 Iniciando seed...");

    // ─────────────────────────────────────────────
    // 1. Datos de catálogo (lookup tables)
    // ─────────────────────────────────────────────

    const estados = await Promise.all([
        prisma.estado.upsert({ where: { estado: "activo" }, update: {}, create: { estado: "activo" } }),
        prisma.estado.upsert({ where: { estado: "inactivo" }, update: {}, create: { estado: "inactivo" } }),
        prisma.estado.upsert({ where: { estado: "pendiente" }, update: {}, create: { estado: "pendiente" } }),
        prisma.estado.upsert({ where: { estado: "completado" }, update: {}, create: { estado: "completado" } }),
        prisma.estado.upsert({ where: { estado: "cancelado" }, update: {}, create: { estado: "cancelado" } }),
        prisma.estado.upsert({ where: { estado: "leido" }, update: {}, create: { estado: "leido" } }),
        prisma.estado.upsert({ where: { estado: "enviado" }, update: {}, create: { estado: "enviado" } }),
    ]);
    const [eActivo, ePendiente, eCompletado] = estados;
    console.log("✅ Estados creados");

    const tiposPerfiles = await Promise.all([
        prisma.tipoPerfil.upsert({ where: { tipo_perfil: "material" }, update: {}, create: { tipo_perfil: "material" } }),
        prisma.tipoPerfil.upsert({ where: { tipo_perfil: "tutoria" }, update: {}, create: { tipo_perfil: "tutoria" } }),
        prisma.tipoPerfil.upsert({ where: { tipo_perfil: "negocio" }, update: {}, create: { tipo_perfil: "negocio" } }),
    ]);
    const [tMaterial, tTutoria, tNegocio] = tiposPerfiles;
    console.log("✅ Tipos de perfil creados");

    const tiposContacto = await Promise.all([
        prisma.tipoContacto.upsert({ where: { tipo_contacto: "telefono" }, update: {}, create: { tipo_contacto: "telefono" } }),
        prisma.tipoContacto.upsert({ where: { tipo_contacto: "whatsapp" }, update: {}, create: { tipo_contacto: "whatsapp" } }),
        prisma.tipoContacto.upsert({ where: { tipo_contacto: "instagram" }, update: {}, create: { tipo_contacto: "instagram" } }),
        prisma.tipoContacto.upsert({ where: { tipo_contacto: "correo_personal" }, update: {}, create: { tipo_contacto: "correo_personal" } }),
    ]);
    const [, tcWa, tcIg] = tiposContacto;
    console.log("✅ Tipos de contacto creados");

    await Promise.all([
        prisma.motivoReporte.upsert({ where: { motivo: "Contenido inapropiado" }, update: {}, create: { motivo: "Contenido inapropiado" } }),
        prisma.motivoReporte.upsert({ where: { motivo: "Fraude o estafa" }, update: {}, create: { motivo: "Fraude o estafa" } }),
        prisma.motivoReporte.upsert({ where: { motivo: "Spam" }, update: {}, create: { motivo: "Spam" } }),
        prisma.motivoReporte.upsert({ where: { motivo: "Acoso" }, update: {}, create: { motivo: "Acoso" } }),
        prisma.motivoReporte.upsert({ where: { motivo: "Información falsa" }, update: {}, create: { motivo: "Información falsa" } }),
    ]);
    console.log("✅ Motivos de reporte creados");

    for (const palabra of ["spam", "fraude", "estafa", "inapropiado", "prohibido"]) {
        await prisma.palabraRestringida.upsert({ where: { palabra }, update: {}, create: { palabra } });
    }
    console.log("✅ Palabras restringidas creadas");

    // ─────────────────────────────────────────────
    // 2. Etiquetas (carreras y cursos)
    // ─────────────────────────────────────────────

    const etiquetaIng = await prisma.etiqueta.upsert({
        where: { nombre: "Ingeniería en Ciencias de la Computación" },
        update: {},
        create: { nombre: "Ingeniería en Ciencias de la Computación", descripcion: "Carrera ICC" },
    });

    const etiquetaBio = await prisma.etiqueta.upsert({
        where: { nombre: "Biologia" },
        update: {},
        create: { nombre: "Biologia", descripcion: "Carrera de Biologia" },
    });

    const cursosIng = await Promise.all([
        prisma.etiqueta.upsert({ where: { nombre: "Algoritmos y Estructuras de Datos" }, update: {}, create: { nombre: "Algoritmos y Estructuras de Datos", descripcion: "Curso AED", id_etiqueta_padre: etiquetaIng.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Bases de Datos 1" }, update: {}, create: { nombre: "Bases de Datos 1", descripcion: "Curso BD1", id_etiqueta_padre: etiquetaIng.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Ingeniería de Software 1" }, update: {}, create: { nombre: "Ingeniería de Software 1", descripcion: "Curso IS1", id_etiqueta_padre: etiquetaIng.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Redes de Computadoras" }, update: {}, create: { nombre: "Redes de Computadoras", descripcion: "Curso Redes", id_etiqueta_padre: etiquetaIng.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Programación Orientada a Objetos" }, update: {}, create: { nombre: "Programación Orientada a Objetos", descripcion: "Curso POO - Java", id_etiqueta_padre: etiquetaIng.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Estructuras de Datos Avanzadas" }, update: {}, create: { nombre: "Estructuras de Datos Avanzadas", descripcion: "Curso de Árboles AVL, Grafos y Hash", id_etiqueta_padre: etiquetaIng.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Sistemas Operativos 1" }, update: {}, create: { nombre: "Sistemas Operativos 1", descripcion: "Curso SO - Procesos, Memoria, Archivos", id_etiqueta_padre: etiquetaIng.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Arquitectura de Computadoras" }, update: {}, create: { nombre: "Arquitectura de Computadoras", descripcion: "Curso de Arquitectura - Assembly", id_etiqueta_padre: etiquetaIng.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Bases de Datos 2" }, update: {}, create: { nombre: "Bases de Datos 2", descripcion: "Curso BD2 - NoSQL, Optimización", id_etiqueta_padre: etiquetaIng.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Inteligencia Artificial 1" }, update: {}, create: { nombre: "Inteligencia Artificial 1", descripcion: "Curso IA - Búsqueda, Lógica", id_etiqueta_padre: etiquetaIng.id_etiqueta } })
    ]);

    const cursosBio = await Promise.all([
        prisma.etiqueta.upsert({ where: { nombre: "Ciencias de la Vida" }, update: {}, create: { nombre: "Ciencias de la Vida", descripcion: "Curso de Ciencias de la Vida", id_etiqueta_padre: etiquetaBio.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Bioquímica" }, update: {}, create: { nombre: "Bioquímica", descripcion: "Curso de Bioquímica", id_etiqueta_padre: etiquetaBio.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Biología Celular" }, update: {}, create: { nombre: "Biología Celular", descripcion: "Curso de Biología Celular", id_etiqueta_padre: etiquetaBio.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Genética" }, update: {}, create: { nombre: "Genética", descripcion: "Curso de Genética", id_etiqueta_padre: etiquetaBio.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Microbiología" }, update: {}, create: { nombre: "Microbiología", descripcion: "Curso de Microbiología", id_etiqueta_padre: etiquetaBio.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Ecología" }, update: {}, create: { nombre: "Ecología", descripcion: "Curso de Ecología", id_etiqueta_padre: etiquetaBio.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Fisiología Animal" }, update: {}, create: { nombre: "Fisiología Animal", descripcion: "Curso de Fisiología Animal", id_etiqueta_padre: etiquetaBio.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Botánica" }, update: {}, create: { nombre: "Botánica", descripcion: "Curso de Botánica", id_etiqueta_padre: etiquetaBio.id_etiqueta } }),
    ]);
    console.log(" Etiquetas creadas");

    // ─────────────────────────────────────────────
    // 3. Moderador
    // ─────────────────────────────────────────────

    await prisma.moderador.upsert({
        where: { usuario: "moderador1" },
        update: {},
        create: { usuario: "moderador1", password: await bcrypt.hash("Moderador123!", SALT_ROUNDS) },
    });
    console.log(" Moderador creado");

    // ─────────────────────────────────────────────
    // 4. Usuario de prueba (vendedor)
    // ─────────────────────────────────────────────

    const vendedor = await prisma.usuario.upsert({
        where: { email_institucional: "vendedor@uvg.edu.gt" },
        update: {},
        create: {
            id_usuario: 1,
            nombre: "Carlos Méndez",
            carnet: 21002,
            email_institucional: "vendedor@uvg.edu.gt",
            password: await bcrypt.hash("Vendedor123!", SALT_ROUNDS),
            url_foto_perfil: "https://i.pravatar.cc/150?u=vendedor",
            descripcion: "Usuario de prueba — vende materiales, ofrece tutorías y servicios.",
            calificacion: 4.8,
        },
    });

    await prisma.contacto.createMany({
        skipDuplicates: true,
        data: [
            { id_usuario: vendedor.id_usuario, tipo_contacto: tcWa.id_tipo_contacto, valor: "+502 5555-1001" },
            { id_usuario: vendedor.id_usuario, tipo_contacto: tcIg.id_tipo_contacto, valor: "@carlos.mendez.uvg" },
        ],
    });
    console.log(" Usuario vendedor creado");

    const vendedor1 = await prisma.usuario.upsert({
        where: { email_institucional: "vendedor123@uvg.edu.gt" },
        update: {},
        create: {
            id_usuario: 2,
            nombre: "Adriana Jiménez",
            carnet: 21064,
            email_institucional: "vendedor123@uvg.edu.gt",
            password: await bcrypt.hash("Vendedor123!", SALT_ROUNDS),
            url_foto_perfil: "https://i.pravatar.cc/150?u=vendedor",
            descripcion: "Usuario de prueba — vende materiales, ofrece tutorías y servicios.",
            calificacion: 4.2,
        },
    });

    await prisma.contacto.createMany({
        skipDuplicates: true,
        data: [
            { id_usuario: vendedor1.id_usuario, tipo_contacto: tcWa.id_tipo_contacto, valor: "+502 5164-8081" },
            { id_usuario: vendedor1.id_usuario, tipo_contacto: tcIg.id_tipo_contacto, valor: "@adriana.jimenez.uvg" },
        ],
    });
    console.log(" Usuario vendedor 1 creado");

    // ─────────────────────────────────────────────
    // 5. Publicaciones de prueba (8 por tipo)
    // ─────────────────────────────────────────────

    const materiales = await Promise.all([
        prisma.publicacion.create({ data: { id_publicacion: 1, titulo: "Apuntes de AED — Árboles y Grafos", descripcion: "Apuntes completos del tema 3, incluye ejercicios resueltos.", precio: 15.00, estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { id_publicacion: 2, titulo: "Libro: Clean Code — Robert Martin", descripcion: "Libro físico en buen estado, ideal para IS1.", precio: 80.00, estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { id_publicacion: 3, titulo: "Guías de BD1 — Semestre I 2024", descripcion: "Todas las guías del curso con soluciones.", precio: 20.00, estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { id_publicacion: 4, titulo: "Flashcards de Anatomía", descripcion: "200 tarjetas de estudio de anatomía humana.", precio: 30.00, estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor1.id_usuario } }),
        prisma.publicacion.create({ data: { id_publicacion: 5, titulo: "Resúmenes de Bioquímica", descripcion: "Resúmenes de todos los parciales con diagramas.", precio: 25.00, estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor1.id_usuario } }),
        prisma.publicacion.create({ data: { id_publicacion: 6, titulo: "Manual de Python para Data Science", descripcion: "Guía completa de Python con ejercicios prácticos.", precio: 45.00, estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { id_publicacion: 7, titulo: "Cuaderno de ejercicios de Cálculo 2", descripcion: "100 problemas resueltos paso a paso.", precio: 35.00, estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor1.id_usuario } }),
        prisma.publicacion.create({ data: { id_publicacion: 8, titulo: "Plantillas de tesis en LaTeX", descripcion: "Plantilla lista para usar, incluye tutorial.", precio: 25.00, estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor.id_usuario } })
    ]);

    const tutorias = await Promise.all([
        prisma.publicacion.create({ data: { id_publicacion: 9, titulo: "Tutoría de AED — Recursión y Grafos", descripcion: "Sesiones personalizadas, 1 hora, virtual o presencial.", precio: 50.00, estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { id_publicacion: 10, titulo: "Tutoría de BD1 — SQL y Diseño", descripcion: "Ayuda con consultas SQL, ER y normalización.", precio: 45.00, estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { id_publicacion: 11, titulo: "Tutoría de Cálculo 1", descripcion: "Límites, derivadas e integrales.", precio: 40.00, estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { id_publicacion: 12, titulo: "Tutoría de Anatomía Humana", descripcion: "Repaso de anatomía enfocado en exámenes.", precio: 55.00, estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor1.id_usuario } }),
        prisma.publicacion.create({ data: { id_publicacion: 13, titulo: "Tutoría de Inglés Técnico", descripcion: "Preparación para el examen de Inglés Técnico UVG.", precio: 35.00, estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor1.id_usuario } }),
        prisma.publicacion.create({ data: { id_publicacion: 14, titulo: "Tutoría de Matemática Discreta", descripcion: "Lógica, conjuntos, combinatoria y grafos.", precio: 50.00, estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor1.id_usuario } }),
        prisma.publicacion.create({ data: { id_publicacion: 15, titulo: "Tutoría de Física 1", descripcion: "Mecánica clásica, cinemática y dinámica.", precio: 45.00, estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { id_publicacion: 16, titulo: "Tutoría de Estadística 1", descripcion: "Probabilidad, distribuciones y análisis de datos.", precio: 40.00, estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor1.id_usuario } })
    ]);

    const negocios = await Promise.all([
        prisma.publicacion.create({ data: { id_publicacion: 17, titulo: "Diseño de logos universitarios", descripcion: "Logo profesional para tu proyecto o startup. Entrega en 48h.", precio: 100.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { id_publicacion: 18, titulo: "Desarrollo de landing pages", descripcion: "Landing pages con HTML/CSS/JS. Precio por página.", precio: 200.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { id_publicacion: 19, titulo: "Impresión y encuadernación", descripcion: "Servicio de impresión en campus, blanco/negro y color.", precio: 5.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor1.id_usuario } }),
        prisma.publicacion.create({ data: { id_publicacion: 20, titulo: "Fotografía para presentaciones", descripcion: "Fotos profesionales para defensa de tesis o presentación.", precio: 150.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { id_publicacion: 21, titulo: "Traducción de documentos ES/EN", descripcion: "Documentos técnicos y académicos. Precio por página.", precio: 25.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor1.id_usuario } }),
        prisma.publicacion.create({ data: { id_publicacion: 22, titulo: "Edición de videos promocionales", descripcion: "Edición profesional para proyectos y presentaciones.", precio: 120.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { id_publicacion: 23, titulo: "Asesoría en Excel avanzado", descripcion: "Macros, tablas dinámicas y automatización.", precio: 60.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor1.id_usuario } }),
        prisma.publicacion.create({ data: { id_publicacion: 24, titulo: "Redacción de CV y carta de presentación", descripcion: "CV profesional adaptado a tu perfil.", precio: 50.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor.id_usuario } })
    ]);
    console.log(" Publicaciones creadas (8 materiales · 8 tutorías · 8 negocios)");

    // ─────────────────────────────────────────────
    // 6. Etiquetas en publicaciones y usuario
    // ─────────────────────────────────────────────

    await prisma.publicacionEtiqueta.createMany({
        skipDuplicates: true,
        data: [
            // Materiales (IDs 1-8)
            { id_publicacion: 1, id_etiqueta: cursosIng[0].id_etiqueta },
            { id_publicacion: 1, id_etiqueta: cursosIng[1].id_etiqueta }, // segunda etiqueta
            { id_publicacion: 2, id_etiqueta: cursosIng[2].id_etiqueta },
            { id_publicacion: 3, id_etiqueta: cursosIng[1].id_etiqueta },
            { id_publicacion: 4, id_etiqueta: cursosBio[0].id_etiqueta },
            { id_publicacion: 4, id_etiqueta: cursosBio[1].id_etiqueta }, // segunda etiqueta
            { id_publicacion: 5, id_etiqueta: cursosBio[1].id_etiqueta },
            { id_publicacion: 6, id_etiqueta: cursosIng[4].id_etiqueta },
            { id_publicacion: 6, id_etiqueta: cursosIng[5].id_etiqueta }, // segunda etiqueta
            { id_publicacion: 6, id_etiqueta: cursosIng[6].id_etiqueta }, // tercera etiqueta
            { id_publicacion: 7, id_etiqueta: cursosBio[2].id_etiqueta },
            { id_publicacion: 8, id_etiqueta: cursosIng[5].id_etiqueta },
            // Tutorías (IDs 9-16)
            { id_publicacion: 9, id_etiqueta: cursosIng[0].id_etiqueta },
            { id_publicacion: 10, id_etiqueta: cursosIng[1].id_etiqueta },
            { id_publicacion: 10, id_etiqueta: cursosIng[2].id_etiqueta }, // segunda etiqueta
            { id_publicacion: 11, id_etiqueta: cursosIng[3].id_etiqueta },
            { id_publicacion: 12, id_etiqueta: cursosBio[0].id_etiqueta },
            { id_publicacion: 12, id_etiqueta: cursosBio[1].id_etiqueta }, // segunda etiqueta
            { id_publicacion: 12, id_etiqueta: cursosBio[2].id_etiqueta }, // tercera etiqueta
            { id_publicacion: 13, id_etiqueta: cursosBio[3].id_etiqueta },
            { id_publicacion: 14, id_etiqueta: cursosIng[6].id_etiqueta },
            { id_publicacion: 15, id_etiqueta: cursosIng[7].id_etiqueta },
            { id_publicacion: 15, id_etiqueta: cursosIng[8].id_etiqueta }, // segunda etiqueta
            { id_publicacion: 16, id_etiqueta: cursosBio[4].id_etiqueta },
            // Negocios (IDs 17-24)
            { id_publicacion: 17, id_etiqueta: cursosIng[8].id_etiqueta },
            { id_publicacion: 18, id_etiqueta: cursosIng[9].id_etiqueta },
            { id_publicacion: 18, id_etiqueta: cursosIng[0].id_etiqueta }, // segunda etiqueta
            { id_publicacion: 19, id_etiqueta: cursosBio[5].id_etiqueta },
            { id_publicacion: 20, id_etiqueta: cursosIng[0].id_etiqueta },
            { id_publicacion: 21, id_etiqueta: cursosBio[6].id_etiqueta },
            { id_publicacion: 22, id_etiqueta: cursosIng[1].id_etiqueta },
            { id_publicacion: 22, id_etiqueta: cursosIng[2].id_etiqueta }, // segunda etiqueta
            { id_publicacion: 23, id_etiqueta: cursosBio[7].id_etiqueta },
            { id_publicacion: 24, id_etiqueta: cursosIng[2].id_etiqueta },
            { id_publicacion: 24, id_etiqueta: cursosIng[3].id_etiqueta }, // segunda etiqueta
            { id_publicacion: 24, id_etiqueta: cursosIng[4].id_etiqueta }, // tercera etiqueta
        ],
    });

    //Etiquetas para el primer vendedor
    await prisma.usuarioEtiqueta.createMany({
        skipDuplicates: true,
        data: [
            { id_usuario: vendedor.id_usuario, id_etiqueta: etiquetaIng.id_etiqueta },
            { id_usuario: vendedor.id_usuario, id_etiqueta: cursosIng[0].id_etiqueta },
            { id_usuario: vendedor.id_usuario, id_etiqueta: cursosIng[1].id_etiqueta },
            { id_usuario: vendedor.id_usuario, id_etiqueta: cursosIng[4].id_etiqueta },
            { id_usuario: vendedor.id_usuario, id_etiqueta: cursosIng[5].id_etiqueta },
            { id_usuario: vendedor.id_usuario, id_etiqueta: cursosIng[6].id_etiqueta },
            { id_usuario: vendedor.id_usuario, id_etiqueta: cursosIng[7].id_etiqueta },
        ],
    });

    // Etiquetas para el segundo vendedor
    await prisma.usuarioEtiqueta.createMany({
        skipDuplicates: true,
        data: [
            { id_usuario: vendedor1.id_usuario, id_etiqueta: etiquetaBio.id_etiqueta },
            { id_usuario: vendedor1.id_usuario, id_etiqueta: cursosBio[0].id_etiqueta },
            { id_usuario: vendedor1.id_usuario, id_etiqueta: cursosBio[1].id_etiqueta },
            { id_usuario: vendedor1.id_usuario, id_etiqueta: cursosBio[2].id_etiqueta },
            { id_usuario: vendedor1.id_usuario, id_etiqueta: cursosBio[3].id_etiqueta },
            { id_usuario: vendedor1.id_usuario, id_etiqueta: cursosBio[4].id_etiqueta },
            { id_usuario: vendedor1.id_usuario, id_etiqueta: cursosBio[5].id_etiqueta },
        ],
    });

    // Acuerdos entre usuario
    await prisma.acuerdo.createMany({
        skipDuplicates: true,
        data: [
            { id_usuario: vendedor1.id_usuario, id_publicacion: negocios[1].id_publicacion, fecha_entrega: new Date(), lugar_entrega: "Plaza Paiz", estado: eCompletado.id_estado },
            { id_usuario: vendedor.id_usuario, id_publicacion: negocios[4].id_publicacion, fecha_entrega: new Date(), lugar_entrega: "Plaza Isabel Gutierrez de Bosch", estado: ePendiente.id_estado },
            { id_usuario: vendedor1.id_usuario, id_publicacion: tutorias[2].id_publicacion, fecha_entrega: new Date(), lugar_entrega: "Plaza Isabel Gutierrez de Bosch", estado: eCompletado.id_estado },
            { id_usuario: vendedor.id_usuario, id_publicacion: tutorias[4].id_publicacion, fecha_entrega: new Date(), lugar_entrega: "CIT", estado: ePendiente.id_estado },
            { id_usuario: vendedor1.id_usuario, id_publicacion: materiales[5].id_publicacion, fecha_entrega: new Date(), lugar_entrega: "Campus Central", estado: ePendiente.id_estado },
            { id_usuario: vendedor1.id_usuario, id_publicacion: negocios[5].id_publicacion, fecha_entrega: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), lugar_entrega: "Plaza Cayalá", estado: eActivo.id_estado },
            { id_usuario: vendedor.id_usuario, id_publicacion: tutorias[5].id_publicacion, fecha_entrega: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), lugar_entrega: "Biblioteca Central", estado: eCompletado.id_estado },
            { id_usuario: vendedor.id_usuario, id_publicacion: materiales[6].id_publicacion, fecha_entrega: new Date(), lugar_entrega: "Plaza Paiz", estado: ePendiente.id_estado },
        ]
    })

    console.log(" Etiquetas vinculadas");

    console.log("\n Seed completado.");
    console.log("\n Credenciales de prueba:");
    console.log("   Usuario   : vendedor@uvg.edu.gt / Vendedor123!");
    console.log("   Usuario   : vendedor123@uvg.edu.gt / Vendedor123!");
    console.log("   Moderador : moderador1          / Moderador123!");
    console.log("\n▶  Para correr el seed: npm run prisma:seed");
    console.log("=== VERIFICANDO ETIQUETAS EN PUBLICACIONES ===");
    const countPubEtiquetas = await prisma.publicacionEtiqueta.count();
    console.log(`Total publicacion_etiquetas: ${countPubEtiquetas}`);

    // Verificar específicamente algunas
    const muestra = await prisma.publicacionEtiqueta.findFirst();
    console.log("Muestra de publicacion_etiqueta:", muestra);

    // Después de crear etiquetas de usuario
    console.log("=== VERIFICANDO ETIQUETAS DE USUARIO ===");
    const countUserEtiquetas = await prisma.usuarioEtiqueta.count();
    console.log(`Total usuario_etiquetas: ${countUserEtiquetas}`);
}

main()
    .catch((e) => {
        console.error(" Error en seed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });