import { afterEach, describe, expect, it } from "vitest";
import { verificarEntornoIntegracion } from "../integration/entornoIntegracion";

const entornoOriginal = {
    NODE_ENV: process.env.NODE_ENV,
    RUN_INTEGRATION: process.env.RUN_INTEGRATION,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
};

afterEach(() => {
    Object.assign(process.env, entornoOriginal);
    if (entornoOriginal.RUN_INTEGRATION === undefined) delete process.env.RUN_INTEGRATION;
});

describe("protecciones del entorno de integración", () => {
    it("rechaza ejecutar limpieza fuera del modo explícito de integración", () => {
        process.env.RUN_INTEGRATION = "false";
        expect(() => verificarEntornoIntegracion()).toThrow(/solo puede ejecutarse/i);
    });

    it("rechaza una base cuyo nombre no termina en _test", () => {
        process.env.RUN_INTEGRATION = "true";
        process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/swap_production";
        expect(() => verificarEntornoIntegracion()).toThrow(/debe terminar en _test/i);
    });

    it("rechaza usar el namespace Redis predeterminado", () => {
        process.env.RUN_INTEGRATION = "true";
        process.env.DATABASE_URL = "postgresql://user:pass@localhost:55432/swap_integration_test";
        process.env.REDIS_URL = "redis://localhost:6379/0";
        expect(() => verificarEntornoIntegracion()).toThrow(/base lógica 15/i);
    });

    it("rechaza PostgreSQL en el puerto habitual aunque la base termine en _test", () => {
        process.env.RUN_INTEGRATION = "true";
        process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/swap_integration_test";
        process.env.REDIS_URL = "redis://localhost:56379/15";
        expect(() => verificarEntornoIntegracion()).toThrow(/puerto aislado/i);
    });

    it("rechaza Redis en el puerto habitual aunque seleccione DB 15", () => {
        process.env.RUN_INTEGRATION = "true";
        process.env.DATABASE_URL = "postgresql://user:pass@localhost:55432/swap_integration_test";
        process.env.REDIS_URL = "redis://localhost:6379/15";
        expect(() => verificarEntornoIntegracion()).toThrow(/puerto aislado/i);
    });

    it("acepta las variables aisladas documentadas", () => {
        process.env.RUN_INTEGRATION = "true";
        process.env.DATABASE_URL = "postgresql://swap_test:swap_test@localhost:55432/swap_integration_test";
        process.env.REDIS_URL = "redis://localhost:56379/15";
        expect(() => verificarEntornoIntegracion()).not.toThrow();
    });
});
