import prisma from "../persistencia/prismaClient.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const UMBRAL_MODERATION = parseFloat(process.env.MODERATION_UMBRAL ?? '0.5');

interface ResultadoModeracion {
    flagged: boolean;
    categorias: string[];
}

export async function analizarTexto(texto: string): Promise<ResultadoModeracion> {
    // Pre-filtro: palabras restringidas en BD (gratis, instantáneo)
    const palabras = await prisma.palabraRestringida.findMany({ select: { palabra: true } });
    const textoLower = texto.toLowerCase();
    const encontrada = palabras.find(p => textoLower.includes(p.palabra));
    if (encontrada) {
        return { flagged: true, categorias: ['palabras_restringidas'] };
    }

    // Moderación con OpenAI
    if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY no configurada');
    }

    const respuesta = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({ input: texto })
    });

    if (!respuesta.ok) {
        throw new Error(`OpenAI Moderation respondió con ${respuesta.status}`);
    }

    const datos = await respuesta.json() as {
        results: Array<{
            flagged: boolean;
            category_scores: Record<string, number>;
        }>;
    };

    const resultado = datos.results[0];

    const categoriasVioladas = Object.entries(resultado.category_scores)
        .filter(([, score]) => score >= UMBRAL_MODERATION)
        .map(([categoria]) => categoria);

    return {
        flagged: resultado.flagged || categoriasVioladas.length > 0,
        categorias: categoriasVioladas
    };
}
