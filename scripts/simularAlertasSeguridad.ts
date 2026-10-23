import { createServer } from "node:http";
import redis, { conectarRedis } from "../src/persistencia/redisClient.js";

async function main(): Promise<void> {
    if (process.env.NODE_ENV !== "test" || process.env.RUN_INTEGRATION !== "true") {
        throw new Error("La simulación solo puede ejecutarse en el entorno aislado de integración.");
    }

    const recibidas: Array<Record<string, unknown>> = [];
    const servidor = createServer((req, res) => {
        let cuerpo = "";
        req.setEncoding("utf8");
        req.on("data", (fragmento) => { cuerpo += fragmento; });
        req.on("end", () => {
            recibidas.push(JSON.parse(cuerpo));
            res.writeHead(204);
            res.end();
        });
    });

    await new Promise<void>((resolve) => servidor.listen(0, "127.0.0.1", resolve));
    const direccion = servidor.address();
    if (!direccion || typeof direccion === "string") throw new Error("No se pudo iniciar el webhook temporal.");

    process.env.SECURITY_ALERT_WEBHOOK_URL = `http://127.0.0.1:${direccion.port}/security`;
    await conectarRedis();
    await redis.flushDb();

    // El import ocurre después de configurar el receptor para simular el arranque real.
    const { procesarEventoParaAlertas } = await import("../src/observabilidad/servicioAlertas.js");

    for (let intento = 0; intento < 5; intento += 1) {
        await procesarEventoParaAlertas("auth.login", { result: "failure", ip: "203.0.113.70" });
    }
    for (let intento = 0; intento < 3; intento += 1) {
        await procesarEventoParaAlertas("security.rate_limit.blocked", { ip: "203.0.113.71" });
    }
    await procesarEventoParaAlertas("moderation.provider_failed", { providerType: "image" });
    for (let intento = 0; intento < 5; intento += 1) {
        await procesarEventoParaAlertas("http.request_completed", { statusCode: 503, route: "/api/simulacion" });
    }

    const alertas = recibidas.map((evento) => evento.alert).sort();
    const esperadas = [
        "failed_login_spike",
        "http_5xx_spike",
        "moderation_provider_failures",
        "rate_limit_blocks",
    ].sort();
    if (JSON.stringify(alertas) !== JSON.stringify(esperadas)) {
        throw new Error(`Alertas recibidas inesperadas: ${JSON.stringify(alertas)}`);
    }

    console.log(JSON.stringify({ success: true, channel: "webhook", alertsReceived: alertas }, null, 2));

    await redis.flushDb();
    await redis.quit();
    await new Promise<void>((resolve, reject) => servidor.close((error) => error ? reject(error) : resolve()));
}

main().catch(async (error) => {
    console.error(error);
    if (redis.isOpen) await redis.quit();
    process.exitCode = 1;
});
