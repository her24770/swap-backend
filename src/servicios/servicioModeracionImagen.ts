import { RekognitionClient, DetectModerationLabelsCommand } from "@aws-sdk/client-rekognition";

const rekognition = new RekognitionClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    credentials: {
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    },
});

const UMBRAL_IMAGEN = parseFloat(process.env.MODERATION_IMAGEN_UMBRAL ?? '70');

// Categorías que justifican rechazo inmediato
const CATEGORIAS_BLOQUEADAS = [
    'Explicit Nudity',
    'Non-Explicit Nudity',
    'Violence',
    'Drugs',
    'Hate Symbols',
    'Visually Disturbing',
];

interface ResultadoModeracionImagen {
    flagged: boolean;
    etiquetas: string[];
}

async function llamarRekognition(buffer: Buffer): Promise<ResultadoModeracionImagen> {
    const comando = new DetectModerationLabelsCommand({
        Image: { Bytes: buffer },
        MinConfidence: UMBRAL_IMAGEN,
    });

    const respuesta = await rekognition.send(comando);
    const etiquetas = (respuesta.ModerationLabels ?? [])
        .map(l => l.ParentName ?? l.Name ?? '')
        .filter(Boolean);

    const flagged = etiquetas.some(e => CATEGORIAS_BLOQUEADAS.includes(e));
    return { flagged, etiquetas };
}

export async function analizarImagen(buffer: Buffer): Promise<ResultadoModeracionImagen> {
    try {
        return await llamarRekognition(buffer);
    } catch (error: any) {
        // Reintento único si se superó el límite de TPS
        if (error?.name === 'ProvisionedThroughputExceededException') {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return await llamarRekognition(buffer);
        }
        throw error;
    }
}
