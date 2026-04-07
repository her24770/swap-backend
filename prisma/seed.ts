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
    const [eActivo] = estados;
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
    ]);

    const cursosBio = await Promise.all([
        prisma.etiqueta.upsert({ where: { nombre: "Ciencias de la Vida" }, update: {}, create: { nombre: "Ciencias de la Vida", descripcion: "Curso de Ciencias de la Vida", id_etiqueta_padre: etiquetaBio.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Bioquímica" }, update: {}, create: { nombre: "Bioquímica", descripcion: "Curso de Bioquímica", id_etiqueta_padre: etiquetaBio.id_etiqueta } }),
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

    // ─────────────────────────────────────────────
    // 5. Publicaciones de prueba (5 por tipo)
    // ─────────────────────────────────────────────

    const materiales = await Promise.all([
        prisma.publicacion.create({ data: { titulo: "Apuntes de AED — Árboles y Grafos", descripcion: "Apuntes completos del tema 3, incluye ejercicios resueltos.", precio: 15.00, estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { titulo: "Libro: Clean Code — Robert Martin", descripcion: "Libro físico en buen estado, ideal para IS1.", precio: 80.00, estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { titulo: "Guías de BD1 — Semestre I 2024", descripcion: "Todas las guías del curso con soluciones.", precio: 20.00, estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { titulo: "Flashcards de Anatomía", descripcion: "200 tarjetas de estudio de anatomía humana.", precio: 30.00, estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { titulo: "Resúmenes de Bioquímica", descripcion: "Resúmenes de todos los parciales con diagramas.", precio: 25.00, estado: eActivo.id_estado, tipo_publicacion: tMaterial.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
    ]);

    const tutorias = await Promise.all([
        prisma.publicacion.create({ data: { titulo: "Tutoría de AED — Recursión y Grafos", descripcion: "Sesiones personalizadas, 1 hora, virtual o presencial.", precio: 50.00, estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { titulo: "Tutoría de BD1 — SQL y Diseño", descripcion: "Ayuda con consultas SQL, ER y normalización.", precio: 45.00, estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { titulo: "Tutoría de Cálculo 1", descripcion: "Límites, derivadas e integrales.", precio: 40.00, estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { titulo: "Tutoría de Anatomía Humana", descripcion: "Repaso de anatomía enfocado en exámenes.", precio: 55.00, estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { titulo: "Tutoría de Inglés Técnico", descripcion: "Preparación para el examen de Inglés Técnico UVG.", precio: 35.00, estado: eActivo.id_estado, tipo_publicacion: tTutoria.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
    ]);

    const negocios = await Promise.all([
        prisma.publicacion.create({ data: { titulo: "Diseño de logos universitarios", descripcion: "Logo profesional para tu proyecto o startup. Entrega en 48h.", precio: 100.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { titulo: "Desarrollo de landing pages", descripcion: "Landing pages con HTML/CSS/JS. Precio por página.", precio: 200.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { titulo: "Impresión y encuadernación", descripcion: "Servicio de impresión en campus, blanco/negro y color.", precio: 5.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { titulo: "Fotografía para presentaciones", descripcion: "Fotos profesionales para defensa de tesis o presentación.", precio: 150.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
        prisma.publicacion.create({ data: { titulo: "Traducción de documentos ES/EN", descripcion: "Documentos técnicos y académicos. Precio por página.", precio: 25.00, estado: eActivo.id_estado, tipo_publicacion: tNegocio.id_tipo_perfil, id_usuario: vendedor.id_usuario } }),
    ]);
    console.log(" Publicaciones creadas (5 materiales · 5 tutorías · 5 negocios)");

    // ─────────────────────────────────────────────
    // 6. Etiquetas en publicaciones y usuario
    // ─────────────────────────────────────────────

    await prisma.publicacionEtiqueta.createMany({
        skipDuplicates: true,
        data: [
            { id_publicacion: materiales[0].id_publicacion, id_etiqueta: cursosIng[0].id_etiqueta },
            { id_publicacion: materiales[1].id_publicacion, id_etiqueta: cursosIng[2].id_etiqueta },
            { id_publicacion: materiales[2].id_publicacion, id_etiqueta: cursosIng[1].id_etiqueta },
            { id_publicacion: materiales[3].id_publicacion, id_etiqueta: cursosBio[0].id_etiqueta },
            { id_publicacion: materiales[4].id_publicacion, id_etiqueta: cursosBio[1].id_etiqueta },
            { id_publicacion: tutorias[0].id_publicacion, id_etiqueta: cursosIng[0].id_etiqueta },
            { id_publicacion: tutorias[1].id_publicacion, id_etiqueta: cursosIng[1].id_etiqueta },
            { id_publicacion: tutorias[3].id_publicacion, id_etiqueta: cursosBio[0].id_etiqueta },
        ],
    });

    await prisma.usuarioEtiqueta.createMany({
        skipDuplicates: true,
        data: [
            { id_usuario: vendedor.id_usuario, id_etiqueta: etiquetaIng.id_etiqueta },
            { id_usuario: vendedor.id_usuario, id_etiqueta: cursosIng[0].id_etiqueta },
            { id_usuario: vendedor.id_usuario, id_etiqueta: cursosIng[1].id_etiqueta },
        ],
    });
    console.log(" Etiquetas vinculadas");

    console.log("\n Seed completado.");
    console.log("\n Credenciales de prueba:");
    console.log("   Usuario   : vendedor@uvg.edu.gt / Vendedor123!");
    console.log("   Moderador : moderador1          / Moderador123!");
    console.log("\n▶  Para correr el seed: npm run prisma:seed");
}

main()
    .catch((e) => {
        console.error(" Error en seed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });