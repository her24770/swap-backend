import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";

import { configuracionTrustProxy, confiarEnProxy, esIpDeCloudflare } from "../../src/autenticacion/proxyConfiable";

function appCon(trust: ReturnType<typeof configuracionTrustProxy>) {
    const app = express();
    app.set("trust proxy", trust);
    app.get("/ip", (req, res) => { res.json({ ip: req.ip }); });
    return app;
}

async function ipVista(xff?: string, trust = configuracionTrustProxy("cloudflare")): Promise<string> {
    const peticion = request(appCon(trust)).get("/ip");
    if (xff) peticion.set("X-Forwarded-For", xff);
    const res = await peticion;
    return res.body.ip;
}

describe("trust proxy (SWAP-617)", () => {
    describe("sin TRUST_PROXY (desarrollo)", () => {
        it("ignora X-Forwarded-For y usa la conexión directa", async () => {
            const ip = await ipVista("203.0.113.5", configuracionTrustProxy(undefined));
            expect(ip).not.toBe("203.0.113.5");
            expect(ip).toMatch(/127\.0\.0\.1|::1/);
        });

        it("cualquier valor distinto de 'cloudflare' tampoco confía en proxies", () => {
            expect(configuracionTrustProxy("true")).toBe(false);
            expect(configuracionTrustProxy("")).toBe(false);
        });
    });

    describe("con TRUST_PROXY=cloudflare", () => {
        it("petición directa al origen: toma la IP que agrega nginx", async () => {
            expect(await ipVista("203.0.113.5")).toBe("203.0.113.5");
        });

        it("petición por Cloudflare: salta la IP del edge y toma la del cliente", async () => {
            expect(await ipVista("203.0.113.5, 104.16.0.10")).toBe("203.0.113.5");
            expect(await ipVista("203.0.113.5, 2606:4700::1")).toBe("203.0.113.5");
        });

        it("ignora un X-Forwarded-For falsificado por el cliente en la ruta directa", async () => {
            expect(await ipVista("6.6.6.6, 203.0.113.5")).toBe("203.0.113.5");
        });

        it("ignora un X-Forwarded-For falsificado por el cliente pasando por Cloudflare", async () => {
            expect(await ipVista("6.6.6.6, 203.0.113.5, 172.64.1.1")).toBe("203.0.113.5");
        });

        it("no deja que el cliente se haga pasar por Cloudflare para esconder su IP", async () => {
            expect(await ipVista("104.16.0.10, 203.0.113.5")).toBe("203.0.113.5");
        });

        it("clientes distintos detrás del mismo proxy obtienen IPs distintas", async () => {
            const a = await ipVista("198.51.100.1, 104.16.0.10");
            const b = await ipVista("198.51.100.2, 104.16.0.10");
            expect(a).not.toBe(b);
        });
    });

    describe("esIpDeCloudflare / confiarEnProxy", () => {
        it("reconoce rangos IPv4, IPv6 e IPv4 mapeadas", () => {
            expect(esIpDeCloudflare("104.16.0.1")).toBe(true);
            expect(esIpDeCloudflare("::ffff:172.64.0.1")).toBe(true);
            expect(esIpDeCloudflare("2a06:98c0::1")).toBe(true);
        });

        it("rechaza IPs que no son de Cloudflare o mal formadas", () => {
            expect(esIpDeCloudflare("8.8.8.8")).toBe(false);
            expect(esIpDeCloudflare("172.20.0.1")).toBe(false);
            expect(esIpDeCloudflare("no-es-ip")).toBe(false);
        });

        it("confía siempre en la conexión directa y luego solo en Cloudflare", () => {
            expect(confiarEnProxy("172.20.0.1", 0)).toBe(true);
            expect(confiarEnProxy("172.20.0.1", 1)).toBe(false);
            expect(confiarEnProxy("104.16.0.1", 1)).toBe(true);
        });
    });
});
