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
        prisma.tipoPerfil.upsert({ where: { tipo_perfil: "tutoria" }, update: {}, create: { tipo_perfil: "tutoria" } }),
        prisma.tipoPerfil.upsert({ where: { tipo_perfil: "negocio" }, update: {}, create: { tipo_perfil: "negocio" } }),
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
        prisma.motivoReporte.upsert({ where: { motivo: "Fraude o estafa" }, update: {}, create: { motivo: "Fraude o estafa" } }),
        prisma.motivoReporte.upsert({ where: { motivo: "Spam" }, update: {}, create: { motivo: "Spam" } }),
        prisma.motivoReporte.upsert({ where: { motivo: "Acoso" }, update: {}, create: { motivo: "Acoso" } }),
        prisma.motivoReporte.upsert({ where: { motivo: "Información falsa" }, update: {}, create: { motivo: "Información falsa" } }),
    ]);
    console.log("  ✅ Motivos de reporte");

    // ─────────────────────────────────────────────
    // 5. Palabras restringidas
    // ─────────────────────────────────────────────
    const palabrasRestringidas = [
        // Groserías base CA/Guatemala
        "puta", "putas", "puto", "putada", "putear", "hpta", "hijueputa", "hijuepucha",
        "malparido", "malparida", "hijuemadre", "hijuemama",
        // Excremento
        "mierda", "mierdas", "cagada", "cagado", "cagar", "cagón", "cagona", "cerote",
        // Genitales como insulto
        "verga", "vergas", "vergón",
        // Insultos directos
        "cabrón", "cabrona", "cabrones",
        "pendejo", "pendeja", "pendejos",
        "culero", "culera", "culeros", "culiado", "culiao",
        "mamón", "mamona", "mamones", "mamada",
        "maricón", "marica", "maricas", "maricon",
        "carajo", "carajos",
        "baboso", "babosa", "babosos",
        "idiota", "idiotas",
        "imbécil", "imbéciles",
        "estúpido", "estúpida", "estúpidos",
        "bastardo", "bastarda", "bastardos",
        "zorra", "zorras",
        "perra", "perras",
        "gonorrea",
        "ojete", "ojetes",
        "piche", "piches",
        "bicho",
        // Insultos con chinga (México/CA)
        "chingada", "chingado", "chingas", "chingón", "chinguen",
        // Insultos con pinche (CA)
        "pinche", "pinches",
        // Insultos con joto
        "joto", "jotos",
        // Insultos con güey
        "güey", "wey", "buey",
        // Insultos con concha
        "conchetumare", "conchetumadre",
        // Insultos con maje (GT)
        "maje", "majes",
        // Insultos con zoquete
        "zoquete", "zoquetes",
        // Insultos GT adicionales
        "chucho",
        // Palabras inglesas vulgares comunes
        "fuck", "fucking", "fucked", "shit", "bitch", "asshole", "bastard", "damn",
        // Fraude/spam (originales)
        "spam", "fraude", "estafa",
    ];

    for (const palabra of palabrasRestringidas) {
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

    // ─────────────────────────────────────────────
    // 3. Etiquetas padre (ramas del conocimiento)
    // ─────────────────────────────────────────────

    const eMatematica   = await prisma.etiqueta.upsert({ where: { nombre: "Matemática" },   update: {}, create: { nombre: "Matemática",   descripcion: "Rama de las matemáticas" } });
    const eFisica       = await prisma.etiqueta.upsert({ where: { nombre: "Física" },       update: {}, create: { nombre: "Física",       descripcion: "Rama de la física" } });
    const eQuimica      = await prisma.etiqueta.upsert({ where: { nombre: "Química" },      update: {}, create: { nombre: "Química",      descripcion: "Rama de la química" } });
    const eBiologia     = await prisma.etiqueta.upsert({ where: { nombre: "Biología" },     update: {}, create: { nombre: "Biología",     descripcion: "Rama de la biología" } });
    const eComputacion  = await prisma.etiqueta.upsert({ where: { nombre: "Computación" },  update: {}, create: { nombre: "Computación",  descripcion: "Rama de la computación" } });
    const eElectronica  = await prisma.etiqueta.upsert({ where: { nombre: "Electrónica" },  update: {}, create: { nombre: "Electrónica",  descripcion: "Rama de la electrónica" } });
    const eEstadistica  = await prisma.etiqueta.upsert({ where: { nombre: "Estadística" },  update: {}, create: { nombre: "Estadística",  descripcion: "Rama de la estadística" } });
    const eComunicacion = await prisma.etiqueta.upsert({ where: { nombre: "Comunicación" }, update: {}, create: { nombre: "Comunicación", descripcion: "Rama de la comunicación" } });
    const eModalidad    = await prisma.etiqueta.upsert({ where: { nombre: "Modalidad" }, update: {}, create: { nombre: "Modalidad", descripcion: "Modalidad de la Tutoria" } });
    console.log("✅ Etiquetas padre creadas");

    // ─────────────────────────────────────────────
    // 4. Etiquetas hija (cursos UVG)
    // ─────────────────────────────────────────────

    const cursosMatematica = await Promise.all([
        prisma.etiqueta.upsert({ where: { nombre: "Cálculo Diferencial e Integral" }, update: {}, create: { nombre: "Cálculo Diferencial e Integral", descripcion: "Cálculo 1 UVG",                    id_etiqueta_padre: eMatematica.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Cálculo en Varias Variables" },    update: {}, create: { nombre: "Cálculo en Varias Variables",    descripcion: "Cálculo 2 UVG",                    id_etiqueta_padre: eMatematica.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Álgebra Lineal" },                 update: {}, create: { nombre: "Álgebra Lineal",                 descripcion: "Álgebra Lineal UVG",               id_etiqueta_padre: eMatematica.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Matemática Discreta" },            update: {}, create: { nombre: "Matemática Discreta",            descripcion: "Matemática Discreta UVG",          id_etiqueta_padre: eMatematica.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Ecuaciones Diferenciales" },       update: {}, create: { nombre: "Ecuaciones Diferenciales",       descripcion: "Ecuaciones Diferenciales UVG",     id_etiqueta_padre: eMatematica.id_etiqueta } }),
    ]);

    const cursosFisica = await Promise.all([
        prisma.etiqueta.upsert({ where: { nombre: "Física 1" },              update: {}, create: { nombre: "Física 1",              descripcion: "Física 1 UVG",              id_etiqueta_padre: eFisica.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Física 2" },              update: {}, create: { nombre: "Física 2",              descripcion: "Física 2 UVG",              id_etiqueta_padre: eFisica.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Física 3" },              update: {}, create: { nombre: "Física 3",              descripcion: "Física 3 UVG",              id_etiqueta_padre: eFisica.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Laboratorio de Física" }, update: {}, create: { nombre: "Laboratorio de Física", descripcion: "Laboratorio de Física UVG", id_etiqueta_padre: eFisica.id_etiqueta } }),
    ]);

    const cursosQuimica = await Promise.all([
        prisma.etiqueta.upsert({ where: { nombre: "Química 1" },              update: {}, create: { nombre: "Química 1",              descripcion: "Química 1 UVG",              id_etiqueta_padre: eQuimica.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Química 2" },              update: {}, create: { nombre: "Química 2",              descripcion: "Química 2 UVG",              id_etiqueta_padre: eQuimica.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Laboratorio de Química" }, update: {}, create: { nombre: "Laboratorio de Química", descripcion: "Laboratorio de Química UVG", id_etiqueta_padre: eQuimica.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Química Orgánica" },       update: {}, create: { nombre: "Química Orgánica",       descripcion: "Química Orgánica UVG",       id_etiqueta_padre: eQuimica.id_etiqueta } }),
    ]);

    const cursosBiologia = await Promise.all([
        prisma.etiqueta.upsert({ where: { nombre: "Biología General" },           update: {}, create: { nombre: "Biología General",           descripcion: "Biología General UVG",           id_etiqueta_padre: eBiologia.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Biología Celular y Molecular" }, update: {}, create: { nombre: "Biología Celular y Molecular", descripcion: "Biología Celular y Molecular UVG", id_etiqueta_padre: eBiologia.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Genética" },                   update: {}, create: { nombre: "Genética",                   descripcion: "Genética UVG",                   id_etiqueta_padre: eBiologia.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Ecología" },                   update: {}, create: { nombre: "Ecología",                   descripcion: "Ecología UVG",                   id_etiqueta_padre: eBiologia.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Microbiología" },              update: {}, create: { nombre: "Microbiología",              descripcion: "Microbiología UVG",              id_etiqueta_padre: eBiologia.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Bioquímica" },                update: {}, create: { nombre: "Bioquímica",                descripcion: "Bioquímica UVG",                id_etiqueta_padre: eBiologia.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Fisiología Animal" },          update: {}, create: { nombre: "Fisiología Animal",          descripcion: "Fisiología Animal UVG",          id_etiqueta_padre: eBiologia.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Botánica" },                   update: {}, create: { nombre: "Botánica",                   descripcion: "Botánica UVG",                   id_etiqueta_padre: eBiologia.id_etiqueta } }),
            prisma.etiqueta.upsert({ where: { nombre: "Ciencias de la Vida" },          update: {}, create: { nombre: "Ciencias de la Vida",          descripcion: "Ciencias de la Vida UVG",          id_etiqueta_padre: eBiologia.id_etiqueta } }),
    prisma.etiqueta.upsert({ where: { nombre: "Biología Celular" },             update: {}, create: { nombre: "Biología Celular",             descripcion: "Biología Celular UVG",             id_etiqueta_padre: eBiologia.id_etiqueta } }),
    ]);

    const cursosComputacion = await Promise.all([
        prisma.etiqueta.upsert({ where: { nombre: "Algoritmos y Estructuras de Datos" }, update: {}, create: { nombre: "Algoritmos y Estructuras de Datos", descripcion: "AED UVG",  id_etiqueta_padre: eComputacion.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Bases de Datos 1" },                  update: {}, create: { nombre: "Bases de Datos 1",                  descripcion: "BD1 UVG",  id_etiqueta_padre: eComputacion.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Bases de Datos 2" },                  update: {}, create: { nombre: "Bases de Datos 2",                  descripcion: "BD2 UVG",  id_etiqueta_padre: eComputacion.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Ingeniería de Software 1" },          update: {}, create: { nombre: "Ingeniería de Software 1",          descripcion: "IS1 UVG",  id_etiqueta_padre: eComputacion.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Sistemas Operativos 1" },             update: {}, create: { nombre: "Sistemas Operativos 1",             descripcion: "SO1 UVG",  id_etiqueta_padre: eComputacion.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Redes de Computadoras" },             update: {}, create: { nombre: "Redes de Computadoras",             descripcion: "Redes UVG", id_etiqueta_padre: eComputacion.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Arquitectura de Computadoras" },      update: {}, create: { nombre: "Arquitectura de Computadoras",      descripcion: "Arq. UVG", id_etiqueta_padre: eComputacion.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Inteligencia Artificial 1" },         update: {}, create: { nombre: "Inteligencia Artificial 1",         descripcion: "IA1 UVG",  id_etiqueta_padre: eComputacion.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Programación Orientada a Objetos" },  update: {}, create: { nombre: "Programación Orientada a Objetos",  descripcion: "POO UVG",  id_etiqueta_padre: eComputacion.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Estructuras de Datos Avanzadas" }, update: {}, create: { nombre: "Estructuras de Datos Avanzadas", descripcion: "EDA UVG",  id_etiqueta_padre: eComputacion.id_etiqueta } }),
    ]);

    const cursosElectronica = await Promise.all([
        prisma.etiqueta.upsert({ where: { nombre: "Electrónica 1" },     update: {}, create: { nombre: "Electrónica 1",     descripcion: "Electrónica 1 UVG",     id_etiqueta_padre: eElectronica.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Electrónica 2" },     update: {}, create: { nombre: "Electrónica 2",     descripcion: "Electrónica 2 UVG",     id_etiqueta_padre: eElectronica.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Microprocesadores" }, update: {}, create: { nombre: "Microprocesadores", descripcion: "Microprocesadores UVG", id_etiqueta_padre: eElectronica.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Assembler" },         update: {}, create: { nombre: "Assembler",         descripcion: "Assembler UVG",         id_etiqueta_padre: eElectronica.id_etiqueta } }),
    ]);

    const cursosEstadistica = await Promise.all([
        prisma.etiqueta.upsert({ where: { nombre: "Estadística 1" },              update: {}, create: { nombre: "Estadística 1",              descripcion: "Estadística 1 UVG",              id_etiqueta_padre: eEstadistica.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Estadística 2" },              update: {}, create: { nombre: "Estadística 2",              descripcion: "Estadística 2 UVG",              id_etiqueta_padre: eEstadistica.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Probabilidad y Estadística" }, update: {}, create: { nombre: "Probabilidad y Estadística", descripcion: "Probabilidad y Estadística UVG", id_etiqueta_padre: eEstadistica.id_etiqueta } }),
    ]);

    const cursosComunicacion = await Promise.all([
        prisma.etiqueta.upsert({ where: { nombre: "Comunicación Oral y Escrita" }, update: {}, create: { nombre: "Comunicación Oral y Escrita", descripcion: "Comunicación Oral y Escrita UVG", id_etiqueta_padre: eComunicacion.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "Inglés Técnico" },              update: {}, create: { nombre: "Inglés Técnico",              descripcion: "Inglés Técnico UVG",              id_etiqueta_padre: eComunicacion.id_etiqueta } }),
    ]);

    const cursosModalidad = await Promise.all([
        prisma.etiqueta.upsert({ where: { nombre: "Presencial" }, update: {}, create: { nombre: "Presencial", descripcion: "Modalidad Presencial", id_etiqueta_padre: eModalidad.id_etiqueta } }),
        prisma.etiqueta.upsert({ where: { nombre: "En Línea" },   update: {}, create: { nombre: "En Línea",   descripcion: "Modalidad En Línea",   id_etiqueta_padre: eModalidad.id_etiqueta } }),
    ]);

    console.log("✅ Etiquetas hija creadas");

    // ─────────────────────────────────────────────
    // 7. Eventos de recomendación
    // ─────────────────────────────────────────────
    // Catálogo de acciones del usuario y su peso sobre UsuarioEtiqueta.
    // FAVORITA: etiquetas elegidas al registrarse (peso más alto, cold start).
    // Los demás se disparan desde publicaciones interactuadas.
    await Promise.all([
        prisma.eventoRecomendacion.upsert({ where: { tipo_evento: "FAVORITA" },           update: {}, create: { tipo_evento: "FAVORITA",           peso: 2.0 } }),
        prisma.eventoRecomendacion.upsert({ where: { tipo_evento: "VER_PUBLICACION" },    update: {}, create: { tipo_evento: "VER_PUBLICACION",    peso: 0.1 } }),
        prisma.eventoRecomendacion.upsert({ where: { tipo_evento: "BUSCAR_ETIQUETA" },    update: {}, create: { tipo_evento: "BUSCAR_ETIQUETA",    peso: 0.3 } }),
        prisma.eventoRecomendacion.upsert({ where: { tipo_evento: "VER_PERFIL" },         update: {}, create: { tipo_evento: "VER_PERFIL",         peso: 0.2 } }),
        prisma.eventoRecomendacion.upsert({ where: { tipo_evento: "CONTACTAR_VENDEDOR" }, update: {}, create: { tipo_evento: "CONTACTAR_VENDEDOR", peso: 0.5 } }),
        prisma.eventoRecomendacion.upsert({ where: { tipo_evento: "DEJAR_RESENA" },       update: {}, create: { tipo_evento: "DEJAR_RESENA",       peso: 0.8 } }),
        prisma.eventoRecomendacion.upsert({ where: { tipo_evento: "AGENDAR_TUTORIA" },    update: {}, create: { tipo_evento: "AGENDAR_TUTORIA",    peso: 1.0 } }),
        prisma.eventoRecomendacion.upsert({ where: { tipo_evento: "COMPLETAR_COMPRA" },   update: {}, create: { tipo_evento: "COMPLETAR_COMPRA",   peso: 1.0 } }),
    ]);
    console.log("  ✅ Eventos de recomendación");

    console.log("\n✅ Seed de estructura completado.");
}

main()
    .catch((e) => {
        console.error("❌ Error en seed de estructura:", e);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });