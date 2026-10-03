/**
 * Política de acceso aprobada por endpoint (SP-01).
 *
 * Esta lista es deliberadamente independiente de los routers: representa lo
 * que el sistema espera permitir, no lo que los middlewares implementan hoy.
 * Por eso no debe generarse a partir de `src/api_rest`.
 */
export type RolEsperado = "público" | "autenticado" | "usuario" | "moderador" | "superadmin";
export type AlcancePropiedad =
    | "no aplica"
    | "sesión propia"
    | "propietario por parámetro"
    | "propietario del recurso"
    | "participante del recurso";

export interface PoliticaEndpoint {
    metodo: "get" | "post" | "put" | "patch" | "delete";
    ruta: string;
    rol: RolEsperado;
    propiedad: AlcancePropiedad;
}

const p = (
    metodo: PoliticaEndpoint["metodo"],
    ruta: string,
    rol: RolEsperado,
    propiedad: AlcancePropiedad = "no aplica",
): PoliticaEndpoint => ({ metodo, ruta, rol, propiedad });

export const POLITICA_AUTORIZACION: readonly PoliticaEndpoint[] = [
    p("get", "/acuerdo", "usuario", "sesión propia"),
    p("post", "/acuerdo/:id", "usuario", "sesión propia"),
    p("put", "/acuerdo/:id", "usuario", "participante del recurso"),
    p("put", "/acuerdo/:id/detalle", "usuario", "participante del recurso"),
    p("put", "/acuerdo/:id/editar", "usuario", "participante del recurso"),
    p("patch", "/acuerdo/:id/estado", "usuario", "participante del recurso"),
    p("get", "/acuerdo/conversacion/:id", "usuario", "participante del recurso"),

    p("get", "/anuncio", "autenticado"),
    p("post", "/anuncio", "usuario", "sesión propia"),
    p("delete", "/anuncio/:id_anuncio", "usuario", "propietario del recurso"),
    p("patch", "/anuncio/:id_anuncio", "usuario", "propietario del recurso"),
    p("put", "/anuncio/:id_anuncio", "usuario", "propietario del recurso"),
    p("get", "/anuncio/user/:id_usuario", "autenticado"),

    p("post", "/auth/forgot-password", "público"),
    p("post", "/auth/login", "público"),
    p("post", "/auth/logout", "público"),
    p("get", "/auth/me", "usuario", "sesión propia"),
    p("post", "/auth/register", "público"),
    p("post", "/auth/reset-password", "público"),
    p("post", "/auth/send-register-code", "público"),
    p("post", "/auth/verify-reset-code", "público"),

    p("get", "/busqueda", "autenticado"),
    p("post", "/certificacion", "usuario", "sesión propia"),
    p("delete", "/certificacion/:id", "usuario", "propietario del recurso"),
    p("get", "/certificacion/:id", "autenticado"),
    p("get", "/certificacion/user/:id_usuario", "autenticado"),

    p("post", "/conversacion", "usuario", "sesión propia"),
    p("patch", "/conversacion/:id/estado", "usuario", "participante del recurso"),
    p("put", "/conversacion/:id/estado", "usuario", "participante del recurso"),
    p("get", "/conversacion/:id/mensajes", "usuario", "participante del recurso"),
    p("get", "/conversacion/conversaciones", "usuario", "sesión propia"),

    p("get", "/estado", "público"),
    p("get", "/etiqueta", "público"),
    p("get", "/etiqueta/publicacion/:id", "autenticado"),
    p("get", "/etiqueta/user/:id", "autenticado"),
    p("post", "/etiqueta/user/:id", "usuario", "propietario por parámetro"),

    p("get", "/guardados", "usuario", "sesión propia"),
    p("delete", "/guardados/:publicacionId", "usuario", "sesión propia"),
    p("post", "/guardados/:publicacionId", "usuario", "sesión propia"),
    p("get", "/health", "público"),
    p("get", "/horarios/:usuarioId", "público"),
    p("put", "/horarios/:usuarioId", "usuario", "propietario por parámetro"),
    p("put", "/imagen/perfil/:id", "usuario", "propietario por parámetro"),
    p("post", "/imagen/upload", "autenticado", "sesión propia"),
    p("delete", "/likes/:publicacionId", "usuario", "sesión propia"),
    p("post", "/likes/:publicacionId", "usuario", "sesión propia"),

    p("get", "/moderador", "superadmin"),
    p("post", "/moderador", "superadmin"),
    p("delete", "/moderador/:id", "superadmin"),
    p("patch", "/moderador/:id", "superadmin"),
    p("patch", "/moderador/:id/estado", "superadmin"),
    p("post", "/moderador/login", "público"),
    p("get", "/moderador/me", "moderador", "sesión propia"),
    p("get", "/moderador/palabras", "moderador"),
    p("post", "/moderador/palabras", "moderador"),
    p("delete", "/moderador/palabras/:id", "moderador"),
    p("patch", "/moderador/palabras/:id", "moderador"),
    p("get", "/moderador/publicaciones", "moderador"),
    p("delete", "/moderador/publicaciones/:id", "moderador"),
    p("patch", "/moderador/publicaciones/:id/bajar", "moderador"),
    p("patch", "/moderador/publicaciones/:id/reactivar", "moderador"),
    p("get", "/moderador/usuarios", "moderador"),
    p("post", "/moderador/usuarios/:id/advertencia", "moderador"),
    p("patch", "/moderador/usuarios/:id/estado", "moderador"),

    p("get", "/notificacion", "usuario", "sesión propia"),
    p("patch", "/notificacion/:id/estado", "usuario", "propietario del recurso"),

    p("get", "/publicacion", "autenticado"),
    p("post", "/publicacion", "usuario", "sesión propia"),
    p("delete", "/publicacion/:id", "usuario", "propietario del recurso"),
    p("get", "/publicacion/:id", "autenticado"),
    p("patch", "/publicacion/:id", "usuario", "propietario del recurso"),
    p("put", "/publicacion/:id", "usuario", "propietario del recurso"),
    p("patch", "/publicacion/:id/destacar", "usuario", "propietario del recurso"),
    p("patch", "/publicacion/:id/estado", "usuario", "propietario del recurso"),
    p("post", "/publicacion/buscar", "autenticado"),
    p("get", "/publicacion/destacadas/user/:id", "autenticado"),
    p("get", "/publicacion/user/:id", "autenticado"),

    p("post", "/recomendacion/evento", "usuario", "sesión propia"),
    p("delete", "/recomendacion/favoritas", "usuario", "sesión propia"),
    p("post", "/recomendacion/favoritas", "usuario", "sesión propia"),
    p("get", "/recomendacion/globales/:tipo?", "autenticado"),
    p("get", "/recomendacion/mias", "usuario", "sesión propia"),
    p("get", "/recomendacion/personalizadas", "usuario", "sesión propia"),
    p("get", "/recomendacion/similares/:id", "autenticado"),
    p("get", "/recomendacion/tutores", "autenticado"),

    p("post", "/reportes", "usuario", "sesión propia"),
    p("get", "/reportes/:id", "moderador"),
    p("put", "/reportes/:id", "moderador"),
    p("patch", "/reportes/:id/estado", "moderador"),
    p("post", "/reportes/buscar", "moderador"),

    p("post", "/resenas", "usuario", "sesión propia"),
    p("delete", "/resenas/:id_resena", "usuario", "propietario del recurso"),
    p("put", "/resenas/:id_resena", "usuario", "propietario del recurso"),
    p("get", "/resenas/usuario/:id_usuario", "público"),

    p("get", "/user/:id", "autenticado"),
    p("patch", "/user/:id", "usuario", "propietario por parámetro"),
    p("get", "/user/:id/contactos", "autenticado"),
    p("put", "/user/:id/contactos", "usuario", "propietario por parámetro"),
    p("get", "/user/:id/perfil-publico", "autenticado"),
    p("post", "/user/tutores/buscar", "autenticado"),
];

export function clavePolitica(metodo: string, ruta: string): string {
    return `${metodo.toUpperCase()} ${ruta}`;
}

export const POLITICA_POR_ENDPOINT = new Map(
    POLITICA_AUTORIZACION.map((item) => [clavePolitica(item.metodo, item.ruta), item]),
);
