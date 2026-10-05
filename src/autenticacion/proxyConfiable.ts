import { BlockList, isIPv4, isIPv6 } from "net";

// Rangos publicados por Cloudflare (https://www.cloudflare.com/ips), consultados el 2026-10-04.
const RANGOS_CLOUDFLARE_IPV4 = [
    "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22",
    "141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20",
    "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
    "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
];
const RANGOS_CLOUDFLARE_IPV6 = [
    "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32",
    "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32",
];

const cloudflare = new BlockList();
for (const rango of RANGOS_CLOUDFLARE_IPV4) {
    const [red, prefijo] = rango.split("/");
    cloudflare.addSubnet(red, Number(prefijo), "ipv4");
}
for (const rango of RANGOS_CLOUDFLARE_IPV6) {
    const [red, prefijo] = rango.split("/");
    cloudflare.addSubnet(red, Number(prefijo), "ipv6");
}

export function esIpDeCloudflare(direccion: string): boolean {
    const ip = direccion.startsWith("::ffff:") && isIPv4(direccion.slice(7)) ? direccion.slice(7) : direccion;
    if (isIPv4(ip)) return cloudflare.check(ip, "ipv4");
    if (isIPv6(ip)) return cloudflare.check(ip, "ipv6");
    return false;
}

/**
 * Función para `app.set("trust proxy", ...)`. Express recorre la cadena desde
 * la conexión directa (i = 0) hacia atrás por X-Forwarded-For y toma como IP
 * del cliente la primera dirección no confiable.
 *
 * - i = 0 es siempre el nginx propio: en producción el puerto de la API solo
 *   escucha en 127.0.0.1, así que nadie más puede conectarse directo.
 * - Más atrás solo se confía en Cloudflare. El origen también es accesible
 *   sin pasar por Cloudflare, por eso no sirve confiar en un número fijo de
 *   saltos: un X-Forwarded-For inventado por el cliente quedaría como su IP.
 */
export function confiarEnProxy(direccion: string, salto: number): boolean {
    return salto === 0 || esIpDeCloudflare(direccion);
}

/** Valor para `trust proxy` según TRUST_PROXY. Sin la variable no se confía en ningún proxy. */
export function configuracionTrustProxy(valor = process.env.TRUST_PROXY): false | typeof confiarEnProxy {
    return valor === "cloudflare" ? confiarEnProxy : false;
}
