import { beforeEach, describe, expect, it, vi } from "vitest";

const redisMock = vi.hoisted(() => ({ eval: vi.fn() }));
vi.mock("../../src/persistencia/redisClient", () => ({ default: redisMock }));

import { procesarEventoParaAlertas } from "../../src/observabilidad/servicioAlertas";

describe("alertas de seguridad por webhook", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.SECURITY_ALERT_WEBHOOK_URL = "https://alertas.invalid/security";
        redisMock.eval.mockResolvedValue(1);
        fetchMock.mockResolvedValue({ ok: true, status: 200 });
        vi.stubGlobal("fetch", fetchMock);
    });

    it.each([
        ["auth.login", { result: "failure", ip: "203.0.113.50", route: "/api/auth/login" }, "failed_login_spike"],
        ["security.rate_limit.blocked", { ip: "203.0.113.51", route: "/api/auth/login" }, "rate_limit_blocks"],
        ["moderation.provider_failed", { providerType: "image", route: "/api/publicacion" }, "moderation_provider_failures"],
        ["http.request_completed", { statusCode: 503, route: "/api/publicacion" }, "http_5xx_spike"],
    ])("simula %s y envía la alerta %s", async (event, data, expectedAlert) => {
        await procesarEventoParaAlertas(event, {
            ...data,
            requestId: "req-test",
            password: "no-debe-salir",
            token: "tampoco-debe-salir",
            code: "123456",
        });

        expect(redisMock.eval).toHaveBeenCalledOnce();
        expect(fetchMock).toHaveBeenCalledOnce();
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe("https://alertas.invalid/security");
        const payload = JSON.parse(options.body);
        expect(payload).toMatchObject({ event: "security.alert.triggered", alert: expectedAlert });
        expect(options.body).not.toContain("no-debe-salir");
        expect(options.body).not.toContain("tampoco-debe-salir");
        expect(options.body).not.toContain("123456");
    });
});
