import { Resend } from "resend";

const DEFAULT_FROM = "SWAP <noreply@swap.jhgo.online>";

let resend: Resend | null = null;

function obtenerClienteResend(): Resend {
    if (!resend) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            throw new Error("RESEND_API_KEY no configurada");
        }
        resend = new Resend(apiKey);
    }
    return resend;
}

async function enviarCodigo(to: string, subject: string, titulo: string, code: string): Promise<void> {
    await obtenerClienteResend().emails.send({
        from: process.env.SMTP_FROM ?? DEFAULT_FROM,
        to,
        subject,
        html: `
            <p>${titulo}</p>
            <p>Tu código es: <strong>${code}</strong></p>
            <p>Este código es válido por <strong>5 minutos</strong>.</p>
            <p>Si no solicitaste esto, ignora este correo.</p>
        `,
    });
}

export async function enviarCodigoRecuperacion(to: string, code: string): Promise<void> {
    await enviarCodigo(
        to,
        "Código de recuperación SWAP",
        "Recibiste este correo porque solicitaste recuperar tu contraseña.",
        code
    );
}

export async function enviarCodigoVerificacionRegistro(to: string, code: string): Promise<void> {
    await enviarCodigo(
        to,
        "Código de verificación SWAP",
        "Usa este código para verificar tu correo institucional y completar tu registro en SWAP.",
        code
    );
}
