import { RANGOS_CLOUDFLARE_IPV4, RANGOS_CLOUDFLARE_IPV6 } from "../src/autenticacion/proxyConfiable";

const URL_IPV4 = process.env.CLOUDFLARE_IPV4_URL ?? "https://www.cloudflare.com/ips-v4";
const URL_IPV6 = process.env.CLOUDFLARE_IPV6_URL ?? "https://www.cloudflare.com/ips-v6";

async function obtenerRangos(url: string): Promise<string[]> {
    const respuesta = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!respuesta.ok) throw new Error(`${url} respondió HTTP ${respuesta.status}`);
    const rangos = (await respuesta.text()).split(/\s+/).filter(Boolean).sort();
    if (rangos.length === 0) throw new Error(`${url} devolvió una lista vacía`);
    return rangos;
}

function diferencia(nombre: string, versionados: string[], publicados: string[]): string[] {
    const esperados = [...versionados].sort();
    if (JSON.stringify(esperados) === JSON.stringify(publicados)) return [];
    return [
        `${nombre} cambió:`,
        `  sólo versionados: ${esperados.filter(rango => !publicados.includes(rango)).join(", ") || "ninguno"}`,
        `  sólo publicados: ${publicados.filter(rango => !esperados.includes(rango)).join(", ") || "ninguno"}`,
    ];
}

async function main(): Promise<void> {
    const [ipv4, ipv6] = await Promise.all([obtenerRangos(URL_IPV4), obtenerRangos(URL_IPV6)]);
    const cambios = [
        ...diferencia("IPv4", RANGOS_CLOUDFLARE_IPV4, ipv4),
        ...diferencia("IPv6", RANGOS_CLOUDFLARE_IPV6, ipv6),
    ];

    if (cambios.length > 0) {
        console.error(cambios.join("\n"));
        process.exitCode = 1;
    } else {
        console.log("Los rangos IPv4 e IPv6 de Cloudflare siguen sincronizados.");
    }
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
