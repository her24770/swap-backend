import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { openApiDocument } from "../src/openapi/openapi";

const METODOS = ["get", "post", "put", "patch", "delete"] as const;
type Metodo = typeof METODOS[number];

export interface EndpointRuta {
    metodo: Metodo;
    rutaExpress: string;
    rutasOpenApi: string[];
    archivo: string;
    autenticado: boolean;
    rol: "público" | "autenticado" | "usuario" | "moderador" | "superadmin";
}

export interface OperacionOpenApi {
    metodo: Metodo;
    ruta: string;
    operationId: string;
    autenticado: boolean;
    respuestas: string[];
}

function unirRutas(prefijo: string, ruta: string): string {
    const unida = `${prefijo}/${ruta}`.replace(/\/+/g, "/");
    return unida.length > 1 && unida.endsWith("/") ? unida.slice(0, -1) : unida;
}

function convertirRutaOpenApi(ruta: string): string[] {
    const opcional = ruta.match(/:([A-Za-z0-9_]+)\?/);
    if (!opcional) return [ruta.replace(/:([A-Za-z0-9_]+)/g, "{$1}")];

    return [
        ruta.replace(new RegExp(`/:${opcional[1]}\\?`), ""),
        ruta.replace(`:${opcional[1]}?`, `{${opcional[1]}}`),
    ];
}

function detectarRol(fragmento: string, middlewareGlobal: string): EndpointRuta["rol"] {
    const middlewares = `${middlewareGlobal} ${fragmento}`;
    if (middlewares.includes("soloSuperadmin")) return "superadmin";
    if (middlewares.includes("soloModerador")) return "moderador";
    if (middlewares.includes("soloUsuario")) return "usuario";
    if (middlewares.includes("autenticar")) return "autenticado";
    return "público";
}

function extraerEndpointsArchivo(
    raiz: string,
    archivo: string,
    prefijo: string,
): EndpointRuta[] {
    const contenido = readFileSync(join(raiz, archivo), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
    const primerEndpoint = contenido.search(/router\.(?:get|post|put|patch|delete)\s*\(/);
    const antesDelPrimerEndpoint = primerEndpoint >= 0 ? contenido.slice(0, primerEndpoint) : contenido;
    const middlewareGlobal = [...antesDelPrimerEndpoint.matchAll(/router\.use\(([^;]+)\)/gs)]
        .map((match) => match[1])
        .join(" ");
    const patron = /router\.(get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']/g;
    const coincidencias = [...contenido.matchAll(patron)];

    return coincidencias.map((coincidencia, indice) => {
        const inicio = coincidencia.index ?? 0;
        const fin = coincidencias[indice + 1]?.index ?? contenido.length;
        const fragmento = contenido.slice(inicio, fin);
        const rutaExpress = unirRutas(prefijo, coincidencia[2]);
        const rol = detectarRol(fragmento, middlewareGlobal);
        return {
            metodo: coincidencia[1] as Metodo,
            rutaExpress,
            rutasOpenApi: convertirRutaOpenApi(rutaExpress),
            archivo,
            autenticado: rol !== "público",
            rol,
        };
    });
}

export function inventariarRutas(directorioProyecto = process.cwd()): EndpointRuta[] {
    const directorioRutas = resolve(directorioProyecto, "src/api_rest");
    const raiz = readFileSync(join(directorioRutas, "routes.ts"), "utf8");
    const importaciones = new Map<string, string>();
    for (const match of raiz.matchAll(/import\s+(\w+)\s+from\s+["']\.\/(\w+)\.js["']/g)) {
        importaciones.set(match[1], `${match[2]}.ts`);
    }

    const endpoints = extraerEndpointsArchivo(directorioRutas, "routes.ts", "");
    for (const match of raiz.matchAll(/router\.use\(\s*["']([^"']+)["']\s*,\s*(\w+)\s*\)/g)) {
        const archivo = importaciones.get(match[2]);
        if (archivo) endpoints.push(...extraerEndpointsArchivo(directorioRutas, archivo, match[1]));
    }

    return endpoints.sort((a, b) =>
        a.rutaExpress.localeCompare(b.rutaExpress) || a.metodo.localeCompare(b.metodo),
    );
}

export function inventariarOpenApi(): OperacionOpenApi[] {
    return Object.entries(openApiDocument.paths).flatMap(([ruta, pathItem]) =>
        Object.entries(pathItem).flatMap(([metodo, valor]) => {
            if (!METODOS.includes(metodo as Metodo)) return [];
            const operacion = valor as {
                operationId?: string;
                security?: unknown[];
                responses?: Record<string, unknown>;
            };
            return [{
                metodo: metodo as Metodo,
                ruta,
                operationId: operacion.operationId ?? "sin-operationId",
                autenticado: (operacion.security?.length ?? 0) > 0,
                respuestas: Object.keys(operacion.responses ?? {}),
            }];
        }),
    );
}

function buscarPruebasHttp(directorioProyecto: string): {
    casos: Map<string, Set<string>>;
    coberturaAutorizacion: Set<string>;
} {
    const pruebas = resolve(directorioProyecto, "tests");
    const archivos: string[] = [];
    const recorrer = (directorio: string) => {
        for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
            const ruta = join(directorio, entrada.name);
            if (entrada.isDirectory()) recorrer(ruta);
            else if (entrada.name.endsWith(".test.ts")) archivos.push(ruta);
        }
    };
    recorrer(pruebas);

    const casos = new Map<string, Set<string>>();
    const coberturaAutorizacion = new Set<string>();
    for (const archivo of archivos) {
        const contenido = readFileSync(archivo, "utf8");
        if (contenido.includes("COBERTURA_AUTORIZACION_DINAMICA")) {
            coberturaAutorizacion.add(basename(archivo));
        }
        for (const match of contenido.matchAll(/\.(get|post|put|patch|delete)\(\s*["'`]\/api([^"'`]+)["'`]/g)) {
            const llave = `${match[1].toUpperCase()} ${match[2] || "/"}`;
            const referencias = casos.get(llave) ?? new Set<string>();
            referencias.add(basename(archivo));
            casos.set(llave, referencias);
        }
    }
    return { casos, coberturaAutorizacion };
}

function coincideRutaConcreta(rutaExpress: string, rutaConcreta: string): boolean {
    const patron = rutaExpress.split("/").map((segmento, indice) => {
        if (indice === 0) return "";
        if (segmento.startsWith(":")) {
            return segmento.endsWith("?") ? "(?:/[^/]+)?" : "/[^/]+";
        }
        return `/${segmento.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
    }).join("");
    return new RegExp(`^${patron}$`).test(rutaConcreta);
}

export function generarMarkdown(directorioProyecto = process.cwd()): string {
    const rutas = inventariarRutas(directorioProyecto);
    const openapi = inventariarOpenApi();
    const { casos: pruebas, coberturaAutorizacion } = buscarPruebasHttp(directorioProyecto);
    const filas = rutas.map((endpoint, indice) => {
        const operaciones = openapi.filter((operacion) =>
            operacion.metodo === endpoint.metodo && endpoint.rutasOpenApi.includes(operacion.ruta),
        );
        const referencias = [...pruebas.entries()]
            .filter(([llave]) => {
                const [metodo, ruta] = llave.split(" ", 2);
                return metodo === endpoint.metodo.toUpperCase() && coincideRutaConcreta(endpoint.rutaExpress, ruta);
            })
            .flatMap(([, archivos]) => [...archivos]);
        if (endpoint.autenticado) referencias.push(...coberturaAutorizacion);
        const id = `EP-${String(indice + 1).padStart(3, "0")}`;
        return `| ${id} | ${endpoint.metodo.toUpperCase()} | \`${endpoint.rutaExpress}\` | ${endpoint.rol} | ${operaciones.map((op) => `\`${op.operationId}\``).join(", ") || "❌"} | ${[...new Set(referencias)].map((item) => `\`${item}\``).join(", ") || "pendiente"} |`;
    });

    const documentados = rutas.filter((endpoint) => openapi.some((operacion) =>
        operacion.metodo === endpoint.metodo && endpoint.rutasOpenApi.includes(operacion.ruta),
    )).length;
    const probados = rutas.filter((endpoint) => endpoint.autenticado && coberturaAutorizacion.size > 0
        || [...pruebas.keys()].some((llave) => {
        const [metodo, ruta] = llave.split(" ", 2);
        return metodo === endpoint.metodo.toUpperCase() && coincideRutaConcreta(endpoint.rutaExpress, ruta);
    })).length;

    return [
        "# Matriz trazable de endpoints",
        "",
        "> Archivo generado por `npm run endpoints:inventory`. No editar manualmente.",
        "",
        `- Rutas Express inventariadas: **${rutas.length}**`,
        `- Rutas documentadas en OpenAPI: **${documentados}/${rutas.length}**`,
        `- Rutas con al menos una invocación HTTP localizada: **${probados}/${rutas.length}**`,
        "",
        "La columna de prueba HTTP solo acredita que existe una invocación; los escenarios mínimos pendientes por endpoint son: caso exitoso, 401 sin sesión, 403 con rol/propietario incorrecto, 400 de validación y errores de dominio 404/409 cuando apliquen.",
        "",
        "| ID | Método | Ruta Express | Acceso según middleware | OpenAPI | Prueba HTTP localizada |",
        "| --- | --- | --- | --- | --- | --- |",
        ...filas,
        "",
    ].join("\n");
}

if (process.argv[1]?.endsWith("generarMatrizEndpoints.ts")) {
    const directorioProyecto = process.cwd();
    const salida = resolve(directorioProyecto, "docs/matriz-endpoints.md");
    writeFileSync(salida, generarMarkdown(directorioProyecto));
    console.log(`Matriz generada en ${salida}`);
}
