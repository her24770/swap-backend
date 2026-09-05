import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../../src/app";
import { openApiDocument } from "../../src/openapi/openapi";

describe("contrato REST v1", () => {
    it("expone /api/v1 como versión canónica y conserva /api", async () => {
        const [versionada, compatible] = await Promise.all([
            request(app).get("/api/v1/health"),
            request(app).get("/api/health"),
        ]);

        expect(versionada.status).toBe(200);
        expect(compatible.status).toBe(200);
        expect(versionada.headers["x-api-version"]).toBe("1");
        expect(openApiDocument.servers.map((server) => server.url)).toEqual(["/api/v1", "/api"]);
    });

    it.each([
        ["/publicacion/{id}", "patch", "put"],
        ["/anuncio/{id_anuncio}", "patch", "put"],
        ["/conversacion/{id}/estado", "patch", "put"],
        ["/acuerdo/{id}/estado", "patch", null],
        ["/reportes/{id}/estado", "patch", null],
    ])("documenta PATCH como operación parcial canónica en %s", (ruta, metodo, _legacy) => {
        const operacion = (openApiDocument.paths as any)[ruta][metodo];
        expect(operacion).toBeDefined();
        expect(operacion.deprecated).not.toBe(true);
    });

    it("marca los PUT parciales heredados en respuesta y OpenAPI", async () => {
        const respuesta = await request(app).put("/api/publicacion/1");
        expect(respuesta.status).toBe(401);
        expect(respuesta.headers.deprecation).toBe("true");
        expect(respuesta.headers.warning).toContain("PATCH");
        expect(respuesta.headers.link).toContain("/api/v1/publicacion/1");
        expect((openApiDocument.paths as any)["/publicacion/{id}"].put.deprecated).toBe(true);
    });

    it("mantiene PUT para reemplazos completos", () => {
        const paths = openApiDocument.paths as any;
        expect(paths["/horarios/{usuarioId}"].put.deprecated).not.toBe(true);
        expect(paths["/resenas/{id_resena}"].put.deprecated).not.toBe(true);
        expect(paths["/acuerdo/{id}/detalle"].put.deprecated).not.toBe(true);
    });
});
