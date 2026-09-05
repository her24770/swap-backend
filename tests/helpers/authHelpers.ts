import prisma from "../../src/persistencia/prismaClient";
import { ServicioJWT } from "../../src/autenticacion/ServicioJWT";

export interface UsuarioTestFixture {
    id_usuario: number;
    nombre: string;
    carnet: number;
    email_institucional: string;
    sesion_version: number;
    token: string;
}

export interface ModeradorTestFixture {
    id_moderador: number;
    usuario: string;
    id_tipo_moderador: number;
    sesion_version: number;
    token: string;
}

let contadorSecuencia = 1;

/**
 * Genera un número único incremental para evitar colisiones de carnet, email o nombres en tests.
 */
export function generarSufijoUnico(): number {
    return (Date.now() % 1000000) + (contadorSecuencia++);
}

/**
 * Crea un usuario de prueba en la base de datos PostgreSQL de integración
 * y genera un token JWT firmado válido y consistente con su `sesion_version`.
 */
export async function crearUsuarioTest(datosPersonalizados: Partial<{
    nombre: string;
    carnet: number;
    email_institucional: string;
    password: string;
    url_foto_perfil: string;
    sesion_version: number;
}> = {}): Promise<UsuarioTestFixture> {
    const sufijo = generarSufijoUnico();
    const carnet = datosPersonalizados.carnet ?? (900000 + (sufijo % 99999));
    const email = datosPersonalizados.email_institucional ?? `usuario_${sufijo}@integration.test`;
    const nombre = datosPersonalizados.nombre ?? `Usuario Test ${sufijo}`;

    const usuario = await prisma.usuario.create({
        data: {
            nombre,
            carnet,
            email_institucional: email,
            password: datosPersonalizados.password ?? "password_test_123",
            url_foto_perfil: datosPersonalizados.url_foto_perfil ?? "default.png",
            sesion_version: datosPersonalizados.sesion_version ?? 1,
        },
    });

    const token = ServicioJWT.generarToken({
        sub: String(usuario.id_usuario),
        email: usuario.email_institucional,
        rol: "usuario",
        ver: usuario.sesion_version,
    });

    return {
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        carnet: usuario.carnet,
        email_institucional: usuario.email_institucional,
        sesion_version: usuario.sesion_version,
        token,
    };
}

/**
 * Crea un moderador o superadmin de prueba en la base de datos de integración
 * y genera un token JWT firmado válido y consistente con su `sesion_version`.
 */
export async function crearModeradorTest(datosPersonalizados: Partial<{
    usuario: string;
    password: string;
    tipo_moderador: "moderador" | "superadmin";
    sesion_version: number;
}> = {}): Promise<ModeradorTestFixture> {
    const sufijo = generarSufijoUnico();
    const nombreUsuario = datosPersonalizados.usuario ?? `mod_${sufijo}`;
    const nombreTipo = datosPersonalizados.tipo_moderador ?? "moderador";

    // Asegurar que exista el TipoModerador
    let tipo = await prisma.tipoModerador.findUnique({
        where: { tipo_moderador: nombreTipo },
    });
    if (!tipo) {
        tipo = await prisma.tipoModerador.create({
            data: { tipo_moderador: nombreTipo },
        });
    }

    const moderador = await prisma.moderador.create({
        data: {
            usuario: nombreUsuario,
            password: datosPersonalizados.password ?? "mod_password_123",
            id_tipo_moderador: tipo.id_tipo_moderador,
            sesion_version: datosPersonalizados.sesion_version ?? 1,
        },
    });

    const token = ServicioJWT.generarToken({
        sub: String(moderador.id_moderador),
        email: `${moderador.usuario}@moderacion.test`,
        rol: nombreTipo,
        ver: moderador.sesion_version,
    });

    return {
        id_moderador: moderador.id_moderador,
        usuario: moderador.usuario,
        id_tipo_moderador: moderador.id_tipo_moderador,
        sesion_version: moderador.sesion_version,
        token,
    };
}

/**
 * Helper para generar tokens sintéticos rápidos (útiles cuando `servicioSesionVersion` está mockeado).
 */
export function generarTokenSintetico(params: {
    id: number | string;
    email?: string;
    rol?: string;
    ver?: number;
}): string {
    return ServicioJWT.generarToken({
        sub: String(params.id),
        email: params.email ?? `test_${params.id}@uvg.edu.gt`,
        rol: params.rol ?? "usuario",
        ver: params.ver ?? 1,
    });
}
