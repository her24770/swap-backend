/**
 * seed.ts — Datos estructurales permanentes
 *
 * Este seed se ejecuta SIEMPRE que se levanta la base de datos desde cero.
 * Contiene únicamente catálogos de referencia que nunca deben cambiar:
 *   - Estados del sistema
 *   - Tipos de perfil / publicación
 *   - Tipos de contacto
 *   - Motivos de reporte
 *   - Palabras restringidas
 *   - Etiquetas (carreras y cursos)
 *
 * Todos los registros usan upsert por campo único natural para que el seed
 * sea idempotente: ejecutarlo varias veces no genera duplicados.
 *
 * Uso (con los contenedores corriendo):
 *   docker compose exec api npx ts-node --transpile-only prisma/seed.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Iniciando seed de estructura...");

    // ─────────────────────────────────────────────
    // 1. Estados del sistema
    // ─────────────────────────────────────────────
    // Usados por: Publicacion, Conversacion, Mensaje, Acuerdo,
    //             Reporte, TiempoDisponible
    await Promise.all([
        prisma.estado.upsert({ where: { estado: "activo" },      update: {}, create: { estado: "activo" } }),
        prisma.estado.upsert({ where: { estado: "inactivo" },    update: {}, create: { estado: "inactivo" } }),
        prisma.estado.upsert({ where: { estado: "pendiente" },   update: {}, create: { estado: "pendiente" } }),
        prisma.estado.upsert({ where: { estado: "completado" },  update: {}, create: { estado: "completado" } }),
        prisma.estado.upsert({ where: { estado: "cancelado" },   update: {}, create: { estado: "cancelado" } }),
        prisma.estado.upsert({ where: { estado: "leido" },       update: {}, create: { estado: "leido" } }),
        prisma.estado.upsert({ where: { estado: "enviado" },     update: {}, create: { estado: "enviado" } }),
        prisma.estado.upsert({ where: { estado: "disponible" },  update: {}, create: { estado: "disponible" } }),
        prisma.estado.upsert({ where: { estado: "vendido" },     update: {}, create: { estado: "vendido" } }),
        prisma.estado.upsert({ where: { estado: "reservado" },   update: {}, create: { estado: "reservado" } }),
    ]);
    console.log("  ✅ Estados");

    // ─────────────────────────────────────────────
    // 2. Tipos de publicación (perfil)
    // ─────────────────────────────────────────────
    await Promise.all([
        prisma.tipoPerfil.upsert({ where: { tipo_perfil: "material" }, update: {}, create: { tipo_perfil: "material" } }),
        prisma.tipoPerfil.upsert({ where: { tipo_perfil: "tutoria" },  update: {}, create: { tipo_perfil: "tutoria" } }),
        prisma.tipoPerfil.upsert({ where: { tipo_perfil: "negocio" },  update: {}, create: { tipo_perfil: "negocio" } }),
    ]);
    console.log("  ✅ Tipos de perfil");

    // ─────────────────────────────────────────────
    // 3. Tipos de contacto
    // ─────────────────────────────────────────────
    await Promise.all([
        prisma.tipoContacto.upsert({ where: { tipo_contacto: "telefono" },        update: {}, create: { tipo_contacto: "telefono" } }),
        prisma.tipoContacto.upsert({ where: { tipo_contacto: "whatsapp" },        update: {}, create: { tipo_contacto: "whatsapp" } }),
        prisma.tipoContacto.upsert({ where: { tipo_contacto: "instagram" },       update: {}, create: { tipo_contacto: "instagram" } }),
        prisma.tipoContacto.upsert({ where: { tipo_contacto: "correo_personal" }, update: {}, create: { tipo_contacto: "correo_personal" } }),
    ]);
    console.log("  ✅ Tipos de contacto");

    // ─────────────────────────────────────────────
    // 4. Motivos de reporte
    // ─────────────────────────────────────────────
    await Promise.all([
        prisma.motivoReporte.upsert({ where: { motivo: "Contenido inapropiado" }, update: {}, create: { motivo: "Contenido inapropiado" } }),
        prisma.motivoReporte.upsert({ where: { motivo: "Fraude o estafa" },       update: {}, create: { motivo: "Fraude o estafa" } }),
        prisma.motivoReporte.upsert({ where: { motivo: "Spam" },                  update: {}, create: { motivo: "Spam" } }),
        prisma.motivoReporte.upsert({ where: { motivo: "Acoso" },                 update: {}, create: { motivo: "Acoso" } }),
        prisma.motivoReporte.upsert({ where: { motivo: "Información falsa" },     update: {}, create: { motivo: "Información falsa" } }),
    ]);
    console.log("  ✅ Motivos de reporte");

    // ─────────────────────────────────────────────
    // 5. Palabras restringidas
    // ─────────────────────────────────────────────
    for (const palabra of ["spam", "fraude", "estafa", "inapropiado", "prohibido"]) {
        await prisma.palabraRestringida.upsert({
            where:  { palabra },
            update: {},
            create: { palabra },
        });
    }
    console.log("  ✅ Palabras restringidas");

    // ─────────────────────────────────────────────
    // 6. Etiquetas — Carreras (padres) y Cursos (hijos)
    // ─────────────────────────────────────────────

    // — Carreras (etiquetas raíz, sin padre) —
    const etiquetaIng = await prisma.etiqueta.upsert({
        where:  { nombre: "Ingeniería en Ciencias de la Computación" },
        update: {},
        create: { nombre: "Ingeniería en Ciencias de la Computación", descripcion: "Carrera ICC" },
    });

    const etiquetaBio = await prisma.etiqueta.upsert({
        where:  { nombre: "Biologia" },
        update: {},
        create: { nombre: "Biologia", descripcion: "Carrera de Biologia" },
    });

    // — Cursos de ICC (hijos de etiquetaIng) —
    await Promise.all([
        prisma.etiqueta.upsert({ where: { nombre: "Algoritmos y Estructuras de Datos" }, update: {}, create: { nombre: "Algoritmos y Estructuras de Datos", descripcion: "Curso AED",                              id_etiqueta_padre: etiquetaIng.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Bases de Datos 1" },                  update: {}, create: { nombre: "Bases de Datos 1",                  descripcion: "Curso BD1",                              id_etiqueta_padre: etiquetaIng.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Ingeniería de Software 1" },          update: {}, create: { nombre: "Ingeniería de Software 1",          descripcion: "Curso IS1",                              id_etiqueta_padre: etiquetaIng.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Redes de Computadoras" },             update: {}, create: { nombre: "Redes de Computadoras",             descripcion: "Curso Redes",                            id_etiqueta_padre: etiquetaIng.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Programación Orientada a Objetos" },  update: {}, create: { nombre: "Programación Orientada a Objetos",  descripcion: "Curso POO - Java",                       id_etiqueta_padre: etiquetaIng.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Estructuras de Datos Avanzadas" },    update: {}, create: { nombre: "Estructuras de Datos Avanzadas",    descripcion: "Curso de Árboles AVL, Grafos y Hash",    id_etiqueta_padre: etiquetaIng.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Sistemas Operativos 1" },             update: {}, create: { nombre: "Sistemas Operativos 1",             descripcion: "Curso SO - Procesos, Memoria, Archivos", id_etiqueta_padre: etiquetaIng.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Arquitectura de Computadoras" },      update: {}, create: { nombre: "Arquitectura de Computadoras",      descripcion: "Curso de Arquitectura - Assembly",       id_etiqueta_padre: etiquetaIng.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Bases de Datos 2" },                  update: {}, create: { nombre: "Bases de Datos 2",                  descripcion: "Curso BD2 - NoSQL, Optimización",        id_etiqueta_padre: etiquetaIng.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Inteligencia Artificial 1" },         update: {}, create: { nombre: "Inteligencia Artificial 1",         descripcion: "Curso IA - Búsqueda, Lógica",            id_etiqueta_padre: etiquetaIng.id_etiqueta } }),
    ]);

    // — Cursos de Biología (hijos de etiquetaBio) —
    await Promise.all([
        prisma.etiqueta.upsert({ where: { nombre: "Ciencias de la Vida" },  update: {}, create: { nombre: "Ciencias de la Vida",  descripcion: "Curso de Ciencias de la Vida",  id_etiqueta_padre: etiquetaBio.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Bioquímica" },           update: {}, create: { nombre: "Bioquímica",           descripcion: "Curso de Bioquímica",           id_etiqueta_padre: etiquetaBio.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Biología Celular" },     update: {}, create: { nombre: "Biología Celular",     descripcion: "Curso de Biología Celular",     id_etiqueta_padre: etiquetaBio.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Genética" },             update: {}, create: { nombre: "Genética",             descripcion: "Curso de Genética",             id_etiqueta_padre: etiquetaBio.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Microbiología" },        update: {}, create: { nombre: "Microbiología",        descripcion: "Curso de Microbiología",        id_etiqueta_padre: etiquetaBio.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Ecología" },             update: {}, create: { nombre: "Ecología",             descripcion: "Curso de Ecología",             id_etiqueta_padre: etiquetaBio.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Fisiología Animal" },    update: {}, create: { nombre: "Fisiología Animal",    descripcion: "Curso de Fisiología Animal",    id_etiqueta_padre: etiquetaBio.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Botánica" },             update: {}, create: { nombre: "Botánica",             descripcion: "Curso de Botánica",             id_etiqueta_padre: etiquetaBio.id_etiqueta } }),
    ]);

    console.log("  ✅ Etiquetas (carreras y cursos)");

    console.log("\n✅ Seed de estructura completado.");
}

main()
    .catch((e) => {
        console.error("❌ Error en seed de estructura:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });