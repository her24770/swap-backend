import redis from "../persistencia/redisClient.js";
import { logger, sanitizarDatos, suscribirEventosLog } from "./logger.js";

interface ReglaAlerta {
    id: string;
    threshold: number;
    windowSeconds: number;
    cooldownSeconds: number;
    aplica: (evento: string, datos: Record<string, unknown>) => boolean;
    grupo: (datos: Record<string, unknown>) => string;
}
const numeroEntorno = (nombre: string, predeterminado: number): number => {
    const valor = Number.parseInt(process.env[nombre] ?? "", 10);
    return Number.isFinite(valor) && valor > 0 ? valor : predeterminado;
};

const REGLAS: ReglaAlerta[] = [
    {
        id: "failed_login_spike",
        threshold: numeroEntorno("ALERT_FAILED_LOGIN_THRESHOLD", 5),
        windowSeconds: numeroEntorno("ALERT_FAILED_LOGIN_WINDOW_SECONDS", 300),
        cooldownSeconds: 900,
        aplica: (evento, datos) => ["auth.login", "auth.moderator_login"].includes(evento) && datos.result === "failure",
        grupo: (datos) => String(datos.ip ?? "unknown"),
    },
    {
        id: "rate_limit_blocks",
        threshold: numeroEntorno("ALERT_RATE_LIMIT_THRESHOLD", 3),
        windowSeconds: numeroEntorno("ALERT_RATE_LIMIT_WINDOW_SECONDS", 300),
        cooldownSeconds: 900,
        aplica: (evento) => evento === "security.rate_limit.blocked",
        grupo: (datos) => String(datos.ip ?? "unknown"),
    },
    {
        id: "moderation_provider_failures",
        threshold: numeroEntorno("ALERT_MODERATION_FAILURE_THRESHOLD", 1),
        windowSeconds: numeroEntorno("ALERT_MODERATION_FAILURE_WINDOW_SECONDS", 300),
        cooldownSeconds: 900,
        aplica: (evento) => evento === "moderation.provider_failed",
        grupo: (datos) => String(datos.providerType ?? "unknown"),
    },
    {
        id: "http_5xx_spike",
        threshold: numeroEntorno("ALERT_HTTP_5XX_THRESHOLD", 5),
        windowSeconds: numeroEntorno("ALERT_HTTP_5XX_WINDOW_SECONDS", 300),
        cooldownSeconds: 900,
        aplica: (evento, datos) => evento === "http.request_completed" && Number(datos.statusCode) >= 500,
        grupo: () => "global",
    },
];

const EVALUAR_REGLA = `
local cantidad = redis.call("INCR", KEYS[1])
if cantidad == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
end
if cantidad >= tonumber(ARGV[2]) then
    local adquirido = redis.call("SET", KEYS[2], "1", "NX", "EX", ARGV[3])
    if adquirido then return 1 end
end
return 0
`;

function claveSegura(valor: string): string {
    return Buffer.from(valor).toString("base64url");
}

async function debeNotificar(regla: ReglaAlerta, grupo: string): Promise<boolean> {
    const base = `security-alert:${regla.id}:${claveSegura(grupo)}`;
    const resultado = await redis.eval(EVALUAR_REGLA, {
        keys: [`${base}:count`, `${base}:cooldown`],
        arguments: [String(regla.windowSeconds), String(regla.threshold), String(regla.cooldownSeconds)],
    });
    return Number(resultado) === 1;
}

async function enviarWebhook(regla: ReglaAlerta, grupo: string, datos: Record<string, unknown>): Promise<void> {
    const url = process.env.SECURITY_ALERT_WEBHOOK_URL;
    if (!url) return;

    const payload = sanitizarDatos({
        event: "security.alert.triggered",
        alert: regla.id,
        threshold: regla.threshold,
        windowSeconds: regla.windowSeconds,
        group: grupo,
        timestamp: new Date().toISOString(),
        sample: {
            requestId: datos.requestId,
            route: datos.route,
            statusCode: datos.statusCode,
            providerType: datos.providerType,
            ip: datos.ip,
        },
    });

    const respuesta = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5_000),
    });
    if (!respuesta.ok) throw new Error(`Webhook de seguridad respondió HTTP ${respuesta.status}`);
}

export async function procesarEventoParaAlertas(evento: string, datos: Record<string, unknown>): Promise<void> {
    if (!process.env.SECURITY_ALERT_WEBHOOK_URL) return;

    for (const regla of REGLAS.filter((candidata) => candidata.aplica(evento, datos))) {
        const grupo = regla.grupo(datos);
        try {
            if (!await debeNotificar(regla, grupo)) continue;
            await enviarWebhook(regla, grupo, datos);
            logger.info({ event: "security.alert.sent", alert: regla.id, group: grupo });
        } catch (error) {
            logger.error({
                event: "security.alert.failed",
                alert: regla.id,
                error: sanitizarDatos(error),
            });
        }
    }
}

let desuscribir: (() => void) | undefined;

export function iniciarAlertasSeguridad(): void {
    if (desuscribir || !process.env.SECURITY_ALERT_WEBHOOK_URL) return;
    desuscribir = suscribirEventosLog(procesarEventoParaAlertas);
    logger.info({ event: "security.alerts_started", channel: "webhook", rules: REGLAS.map(({ id }) => id) });
}
