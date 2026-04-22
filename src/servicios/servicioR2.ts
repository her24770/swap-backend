import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    },
});

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL!;

export async function subirImagenR2(
    buffer: Buffer,
    mimetype: string,
    carpeta: string,
    nombreArchivo?: string
): Promise<string> {
    const ext = mimetype.split("/")[1];
    const nombre = nombreArchivo
        ? `${carpeta}/${nombreArchivo}.${ext}`
        : `${carpeta}/${crypto.randomUUID()}.${ext}`;

    await r2.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: nombre,
            Body: buffer,
            ContentType: mimetype,
        })
    );

    return `${PUBLIC_URL}/${nombre}`;
}

export async function eliminarImagenR2(url: string): Promise<void> {
    const key = url.replace(`${PUBLIC_URL}/`, "");
    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function imagenExisteR2(carpeta: string, nombreArchivo: string, ext: string): Promise<boolean> {
    try {
        const key = `${carpeta}/${nombreArchivo}.${ext}`;
        await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
        return true;
    } catch {
        return false;
    }
}

export function construirUrlR2(carpeta: string, nombreArchivo: string, ext: string): string {
    return `${PUBLIC_URL}/${carpeta}/${nombreArchivo}.${ext}`;
}
