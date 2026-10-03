import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../../src/app";

describe("Documentación OpenAPI", () => {
    it("expone la especificación OpenAPI 3.2 completa", async () => {
        const response = await request(app).get("/api/openapi.json");

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toContain("application/vnd.oai.openapi+json");
        expect(response.body.openapi).toBe("3.2.0");
        expect(response.body.servers).toEqual(
            expect.arrayContaining([expect.objectContaining({ url: "/api" })]),
        );

        const operations = Object.values(response.body.paths)
            .flatMap((pathItem) => Object.values(pathItem as Record<string, unknown>));

        // El parámetro opcional `:tipo?` de Express se representa como dos rutas
        // válidas en OpenAPI, porque los parámetros de ruta no pueden ser opcionales.
        expect(operations).toHaveLength(101);
        expect(operations.every((operation) => {
            const value = operation as Record<string, unknown>;
            return Boolean(value.operationId && value.tags && value.responses);
        })).toBe(true);

        const operationIds = operations.map((operation) =>
            (operation as Record<string, unknown>).operationId,
        );
        expect(new Set(operationIds).size).toBe(operationIds.length);

        for (const [path, pathItem] of Object.entries(response.body.paths)) {
            const variables = [...path.matchAll(/{([^}]+)}/g)]
                .map((match) => match[1])
                .sort();

            for (const operation of Object.values(pathItem as Record<string, unknown>)) {
                const value = operation as {
                    parameters?: Array<{ in: string; name: string; required?: boolean }>;
                };
                const pathParameters = (value.parameters ?? [])
                    .filter((parameter) => parameter.in === "path");

                expect(pathParameters.map((parameter) => parameter.name).sort()).toEqual(variables);
                expect(pathParameters.every((parameter) => parameter.required === true)).toBe(true);
            }
        }
    });

    it("sirve la interfaz interactiva Swagger UI", async () => {
        const response = await request(app).get("/api/docs/");

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toContain("text/html");
        expect(response.text).toContain("Swap API · OpenAPI");
    });
});
