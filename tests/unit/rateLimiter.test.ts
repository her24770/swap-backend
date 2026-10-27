import { beforeEach, describe, expect, it, vi } from "vitest";

const redisMock = vi.hoisted(() => ({
    eval: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
}));

vi.mock("../../src/persistencia/redisClient", () => ({ default: redisMock }));

import {
    construirIdentificadoresRecuperacion,
    consumirIntentos,
    estaBloqueado,
    MENSAJE_RATE_LIMITER_NO_DISPONIBLE,
    permitirEventoSocket,
    rateLimitGlobal,
    rateLimitOperacionCostosa,
    RateLimiterNoDisponibleError,
    registrarIntento,
    reiniciarRateLimiters,
} from "../../src/autenticacion/rateLimiter";

function respuestaMock() {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const setHeader = vi.fn();
    return { res: { status, setHeader } as any, status, json, setHeader };
}

describe("rate limiting distribuido", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("permite hasta 120 solicitudes globales y bloquea la siguiente", async () => {
        redisMock.eval.mockResolvedValueOnce(120).mockResolvedValueOnce(121);
        const next = vi.fn();
        const primera = respuestaMock();
        const excedida = respuestaMock();

        await rateLimitGlobal({ ip: "203.0.113.10" } as any, primera.res, next);
        await rateLimitGlobal({ ip: "203.0.113.10" } as any, excedida.res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(excedida.status).toHaveBeenCalledWith(429);
        expect(excedida.json).toHaveBeenCalledWith({
            success: false,
            message: "Demasiadas solicitudes. Intenta nuevamente más tarde.",
        });
    });

    it("incrementa el contador con TTL de forma atómica en Redis", async () => {
        redisMock.eval.mockResolvedValue(1);

        await registrarIntento("login", "ip+cuenta");

        expect(redisMock.eval).toHaveBeenCalledWith(expect.stringContaining("INCR"), {
            keys: ["rate:login:ip+cuenta"],
            arguments: ["900"],
        });
    });

    it("consume en una sola operación las cuotas de cuenta e IP", async () => {
        redisMock.eval.mockResolvedValue(1);
        const identificadores = construirIdentificadoresRecuperacion(
            "203.0.113.20",
            " USUARIO@UVG.EDU.GT ",
        );

        await expect(consumirIntentos("verificar_codigo_recuperacion", identificadores))
            .resolves.toBe(true);

        expect(redisMock.eval).toHaveBeenCalledWith(expect.stringContaining("ipairs(KEYS)"), {
            keys: [
                "rate:verificar_codigo_recuperacion:usuario@uvg.edu.gt",
                'rate:verificar_codigo_recuperacion:["ip","203.0.113.20"]',
            ],
            arguments: ["600", "5"],
        });
    });

    it("rechaza la acción si cualquiera de las cuotas fue excedida", async () => {
        redisMock.eval.mockResolvedValue(0);

        await expect(consumirIntentos(
            "solicitar_codigo_recuperacion",
            construirIdentificadoresRecuperacion("203.0.113.21", "cuenta@uvg.edu.gt"),
        )).resolves.toBe(false);
    });

    it("no pierde la cuota al reiniciar el proceso", async () => {
        redisMock.eval.mockResolvedValue(121);
        const next = vi.fn();
        const respuesta = respuestaMock();

        reiniciarRateLimiters();
        await rateLimitGlobal({ ip: "203.0.113.11" } as any, respuesta.res, next);

        expect(redisMock.eval).toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
        expect(respuesta.status).toHaveBeenCalledWith(429);
    });

    it("responde 503 y no ejecuta la ruta cuando Redis no responde", async () => {
        redisMock.eval.mockRejectedValue(new Error("Redis caído"));
        const next = vi.fn();
        const respuesta = respuestaMock();

        await rateLimitGlobal({ ip: "203.0.113.12" } as any, respuesta.res, next);

        expect(next).not.toHaveBeenCalled();
        expect(respuesta.status).toHaveBeenCalledWith(503);
        expect(respuesta.json).toHaveBeenCalledWith({
            success: false,
            message: MENSAJE_RATE_LIMITER_NO_DISPONIBLE,
        });
    });

    it("falla cerrado en buckets de autenticación si Redis no responde", async () => {
        redisMock.get.mockRejectedValue(new Error("Redis caído"));

        await expect(estaBloqueado("verificar_codigo_registro", "cuenta@uvg.edu.gt"))
            .rejects.toBeInstanceOf(RateLimiterNoDisponibleError);
    });

    it("comparte en Redis el límite de eventos sensibles de socket", async () => {
        redisMock.eval.mockResolvedValueOnce(60).mockResolvedValueOnce(61);

        await expect(permitirEventoSocket(7, "mensaje:enviar")).resolves.toBe(true);
        await expect(permitirEventoSocket(7, "mensaje:enviar")).resolves.toBe(false);
        expect(redisMock.eval).toHaveBeenLastCalledWith(expect.any(String), {
            keys: ["rate:socket_evento:7:mensaje:enviar"],
            arguments: ["60"],
        });
    });

    it.each([
        ["publicacion_moderada", "900", 11],
        ["subida_imagen_moderada", "900", 21],
        ["subida_certificacion", "3600", 4],
        ["creacion_reporte", "3600", 11],
    ] as const)("aplica el bucket %s por usuario", async (bucket, ventana, excedido) => {
        redisMock.eval.mockResolvedValueOnce(1).mockResolvedValueOnce(excedido);
        const next = vi.fn();
        const respuesta = respuestaMock();

        await rateLimitOperacionCostosa(bucket)(
            { usuario: { sub: 42 }, ip: "203.0.113.30" } as any,
            respuesta.res,
            next,
        );

        expect(next).toHaveBeenCalledOnce();
        expect(redisMock.eval).toHaveBeenCalledWith(expect.stringContaining("INCR"), {
            keys: [`rate:${bucket}:usuario:42`],
            arguments: [ventana],
        });

        const respuestaExcedida = respuestaMock();
        await rateLimitOperacionCostosa(bucket)(
            { usuario: { sub: 42 }, ip: "203.0.113.30" } as any,
            respuestaExcedida.res,
            next,
        );
        expect(next).toHaveBeenCalledOnce();
        expect(respuestaExcedida.status).toHaveBeenCalledWith(429);
    });

    it("responde 429 sin ejecutar el proveedor al exceder la cuota", async () => {
        redisMock.eval.mockResolvedValue(11);
        const proveedorCostoso = vi.fn();
        const respuesta = respuestaMock();

        await rateLimitOperacionCostosa("publicacion_moderada")(
            { usuario: { sub: 42 }, ip: "203.0.113.30" } as any,
            respuesta.res,
            proveedorCostoso,
        );

        expect(proveedorCostoso).not.toHaveBeenCalled();
        expect(respuesta.setHeader).toHaveBeenCalledWith("Retry-After", "900");
        expect(respuesta.status).toHaveBeenCalledWith(429);
    });

    it("falla cerrado antes del proveedor cuando Redis no está disponible", async () => {
        redisMock.eval.mockRejectedValue(new Error("Redis caído"));
        const proveedorCostoso = vi.fn();
        const respuesta = respuestaMock();

        await rateLimitOperacionCostosa("subida_certificacion")(
            { usuario: { sub: 42 }, ip: "203.0.113.30" } as any,
            respuesta.res,
            proveedorCostoso,
        );

        expect(proveedorCostoso).not.toHaveBeenCalled();
        expect(respuesta.status).toHaveBeenCalledWith(503);
    });
});
