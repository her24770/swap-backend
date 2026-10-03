import { RekognitionClient, DetectModerationLabelsCommand } from "@aws-sdk/client-rekognition";

const rekognition = new RekognitionClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    credentials: {
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    },
});

const UMBRALES: Record<string, number> = {
    'Explicit Nudity':     parseFloat(process.env.MODERATION_UMBRAL_EXPLICIT_NUDITY     ?? '50'),
    'Non-Explicit Nudity': parseFloat(process.env.MODERATION_UMBRAL_NON_EXPLICIT_NUDITY ?? '80'),
    'Violence':            parseFloat(process.env.MODERATION_UMBRAL_VIOLENCE            ?? '70'),
    'Drugs':               parseFloat(process.env.MODERATION_UMBRAL_DRUGS               ?? '90'),
    'Hate Symbols':        parseFloat(process.env.MODERATION_UMBRAL_HATE_SYMBOLS        ?? '70'),
    'Visually Disturbing': parseFloat(process.env.MODERATION_UMBRAL_VISUALLY_DISTURBING ?? '60'),
};

const UMBRAL_MIN = Math.min(...Object.values(UMBRALES));

interface ResultadoModeracionImagen {
    flagged: boolean;
    etiquetas: string[];
}

async function llamarRekognition(buffer: Buffer): Promise<ResultadoModeracionImagen> {
    const comando = new DetectModerationLabelsCommand({
        Image: { Bytes: buffer },
        MinConfidence: UMBRAL_MIN,
    });

    const respuesta = await rekognition.send(comando);

    const etiquetasFlagged = (respuesta.ModerationLabels ?? []).filter(l => {
        const categoria = l.ParentName ?? l.Name ?? '';
        const umbral = UMBRALES[categoria];
        return umbral !== undefined && (l.Confidence ?? 0) >= umbral;
    }).map(l => l.ParentName ?? l.Name ?? '');

    const flagged = etiquetasFlagged.length > 0;
    return { flagged, etiquetas: etiquetasFlagged };
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
