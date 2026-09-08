import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
    generarMarkdown,
    inventariarOpenApi,
    inventariarRutas,
} from "../../scripts/generarMatrizEndpoints";
import {
    POLITICA_AUTORIZACION,
    POLITICA_POR_ENDPOINT,
    clavePolitica,
} from "../../scripts/politicaAutorizacion";

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

    it("SP-01: define exactamente una política independiente para cada endpoint", () => {
        const rutasReales = rutas.map((item) => clavePolitica(item.metodo, item.rutaExpress)).sort();
        const rutasEsperadas = POLITICA_AUTORIZACION
            .map((item) => clavePolitica(item.metodo, item.ruta))
            .sort();

        expect(new Set(rutasEsperadas).size).toBe(POLITICA_AUTORIZACION.length);
        expect(rutasEsperadas).toEqual(rutasReales);
    });

    it("SP-01: los roles y middlewares de propietario coinciden con la política", () => {
        const diferencias = rutas.flatMap((endpoint) => {
            const clave = clavePolitica(endpoint.metodo, endpoint.rutaExpress);
            const politica = POLITICA_POR_ENDPOINT.get(clave);
            if (!politica) return [`${clave}: sin política`];

            const problemas: string[] = [];
            if (politica.rol !== endpoint.rol) {
                problemas.push(`${clave}: rol esperado ${politica.rol}, implementado ${endpoint.rol}`);
            }
            const esperaPropietarioParametro = politica.propiedad === "propietario por parámetro";
            if (esperaPropietarioParametro !== endpoint.verificaPropietarioParametro) {
                problemas.push(`${clave}: verificarPropietario esperado=${esperaPropietarioParametro}, implementado=${endpoint.verificaPropietarioParametro}`);
            }
            return problemas;
        });

        expect(diferencias).toEqual([]);
    });

    it("SP-01: la matriz versionada está sincronizada con rutas, política y pruebas", () => {
        const versionada = readFileSync(resolve("docs/matriz-endpoints.md"), "utf8")
            .replace(/\r\n/g, "\n");
        expect(versionada).toBe(generarMarkdown().replace(/\r\n/g, "\n"));
    });
});
