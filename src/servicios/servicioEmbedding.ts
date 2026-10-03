import prisma from "../persistencia/prismaClient";

const EMBEDDINGS_URL = process.env.EMBEDDINGS_SERVICE_URL ?? 'http://localhost:8001';

export async function generarEmbedding(texto: string): Promise<number[]> {
    const respuesta = await fetch(`${EMBEDDINGS_URL}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto })
    });

    if (!respuesta.ok) {
        throw new Error(`Error al generar embedding: ${respuesta.statusText}`);
    }

    const datos = await respuesta.json() as { vector: number[] };
    return datos.vector;
}

export async function generarYGuardarEmbedding(
    idPublicacion: number,
    texto: string
): Promise<void> {
    const vector = await generarEmbedding(texto);
    const vectorStr = `[${vector.join(',')}]`;

    await prisma.$executeRaw`
        UPDATE "Publicacion"
        SET embedding = ${vectorStr}::vector
        WHERE id_publicacion = ${idPublicacion}
    `;
}
