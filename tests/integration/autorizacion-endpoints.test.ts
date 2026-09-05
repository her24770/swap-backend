import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { inventariarRutas } from "../../scripts/generarMatrizEndpoints";
import { generarTokenSintetico } from "../helpers";
import app from "../../src/app";

// COBERTURA_AUTORIZACION_DINAMICA: el generador de matriz reconoce que esta
// suite prueba todos los endpoints protegidos obtenidos desde las rutas reales.
vi.mock("../../src/autenticacion/blacklist", () => ({ estaRevocado: vi.fn().mockResolvedValue(false) }));
vi.mock("../../src/autenticacion/servicioSesionVersion", () => ({
    obtenerVersionActual: vi.fn().mockResolvedValue(1),
}));
vi.mock("../../src/autenticacion/rateLimiter", () => ({
    rateLimitGlobal: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const rutas = inventariarRutas();
const rutasProtegidas = rutas.flatMap((endpoint) => endpoint.rutasOpenApi.map((ruta) => ({
    ...endpoint,
    ruta: ruta.replace(/\{[^}]+\}/g, "1"),
})) ).filter((endpoint) => endpoint.autenticado);

const rutasConRol = rutasProtegidas.filter((endpoint) =>
    endpoint.rol === "usuario" || endpoint.rol === "moderador" || endpoint.rol === "superadmin",
);

function tokenParaRol(rol: string): string {
    return generarTokenSintetico({ id: 999, email: "prueba@uvg.edu.gt", rol, ver: 1 });
}

function ejecutar(metodo: string, ruta: string) {
    return (request(app) as any)[metodo](`/api${ruta}`);
}

describe("matriz de autorización de endpoints", () => {
    it.each(rutasProtegidas)(
        "$metodo $ruta devuelve 401 sin credenciales",
        async ({ metodo, ruta }) => {
            const respuesta = await ejecutar(metodo, ruta);
            expect(respuesta.status).toBe(401);
        },
    );

    it.each(rutasConRol)(
        "$metodo $ruta devuelve 403 con un rol insuficiente",
        async ({ metodo, ruta, rol }) => {
            const rolInsuficiente = rol === "usuario" ? "moderador" : "usuario";
            const respuesta = await ejecutar(metodo, ruta)
                .set("Authorization", `Bearer ${tokenParaRol(rolInsuficiente)}`);
            expect(respuesta.status).toBe(403);
        },
    );
});

