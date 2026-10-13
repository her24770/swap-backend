import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { crearLogger, sanitizarDatos } from "../../src/observabilidad/logger";

describe("logger estructurado", () => {
    it("redacta datos sensibles incluso cuando están anidados", () => {
        expect(sanitizarDatos({
            password: "secreto",
            nested: {
                newPassword: "nuevo-secreto",
                token: "jwt-secreto",
                code: "123456",
                permitido: "visible",
            },
        })).toEqual({
            password: "[REDACTED]",
            nested: {
                newPassword: "[REDACTED]",
                token: "[REDACTED]",
                code: "[REDACTED]",
                permitido: "visible",
            },
        });
    });

    it("emite JSON con nivel, timestamp y redacción defensiva de Pino", () => {
        const nivelAnterior = process.env.LOG_LEVEL;
        process.env.LOG_LEVEL = "info";
        let salida = "";
        const destino = new Writable({
            write(chunk, _encoding, callback) {
                salida += chunk.toString();
                callback();
            },
        });
        const logger = crearLogger(destino);

        logger.info({ event: "test.event", password: "no-debe-salir", result: "success" });

        const linea = JSON.parse(salida);
        expect(linea).toMatchObject({
            level: "info",
            event: "test.event",
            password: "[REDACTED]",
            result: "success",
        });
        expect(linea.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(salida).not.toContain("no-debe-salir");
        process.env.LOG_LEVEL = nivelAnterior;
    });
});
