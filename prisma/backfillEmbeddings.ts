import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const EMBEDDINGS_URL = process.env.EMBEDDINGS_SERVICE_URL ?? "http://embeddings:8000";

async function generarEmbedding(texto: string): Promise<number[]> {
    const res = await fetch(`${EMBEDDINGS_URL}/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
    });
    const datos = await res.json() as { vector: number[] };
    return datos.vector;
}

async function main() {
    const publicaciones = await prisma.publicacion.findMany({
        select: { id_publicacion: true, titulo: true, descripcion: true },
    });

    console.log(`Generando embeddings para ${publicaciones.length} publicaciones...`);

    for (const pub of publicaciones) {
        const texto = `${pub.titulo} ${pub.descripcion}`;
        const vector = await generarEmbedding(texto);
        const vectorStr = `[${vector.join(",")}]`;

        await prisma.$executeRaw`
            UPDATE "Publicacion"
            SET embedding = ${vectorStr}::vector
            WHERE id_publicacion = ${pub.id_publicacion}
        `;

        console.log(`  ✅ ${pub.id_publicacion} — ${pub.titulo}`);
    }

    console.log("\n✅ Backfill completado.");
}

main()
    .catch((e) => console.error("❌ Error:", e))
    .finally(() => prisma.$disconnect());
