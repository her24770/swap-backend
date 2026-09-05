import { describe, expect, it } from "vitest";
import { inventariarOpenApi, inventariarRutas } from "../../scripts/generarMatrizEndpoints";

describe("Contrato rutas ↔ OpenAPI", () => {
    const rutas = inventariarRutas();
    const operaciones = inventariarOpenApi();

    it("documenta cada endpoint de Express y no publica operaciones inexistentes", () => {
        const faltantes = rutas.flatMap((endpoint) => endpoint.rutasOpenApi
            .filter((ruta) => !operaciones.some((operacion) =>
                operacion.metodo === endpoint.metodo && operacion.ruta === ruta,
            ))
            .map((ruta) => `${endpoint.metodo.toUpperCase()} ${ruta}`));
        const sobrantes = operaciones.filter((operacion) => !rutas.some((endpoint) =>
            endpoint.metodo === operacion.metodo && endpoint.rutasOpenApi.includes(operacion.ruta),
        )).map((operacion) => `${operacion.metodo.toUpperCase()} ${operacion.ruta}`);

        expect({ faltantes, sobrantes }).toEqual({ faltantes: [], sobrantes: [] });
    });

    it("documenta 401 y 403 exactamente en las rutas protegidas", () => {
        const diferencias = rutas.flatMap((endpoint) => endpoint.rutasOpenApi.flatMap((ruta) => {
            const operacion = operaciones.find((item) => item.metodo === endpoint.metodo && item.ruta === ruta);
            if (!operacion) return [];
            const tieneErroresAuth = operacion.respuestas.includes("401") && operacion.respuestas.includes("403");
            return operacion.autenticado === endpoint.autenticado && tieneErroresAuth === endpoint.autenticado
                ? []
                : [`${endpoint.metodo.toUpperCase()} ${ruta}`];
        }));

        expect(diferencias).toEqual([]);
    });
});
