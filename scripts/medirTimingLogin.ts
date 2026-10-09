import express from "express";
import request from "supertest";

import routerAuth from "../src/api_rest/routerAuth.js";
import { ServicioBcrypt } from "../src/autenticacion/ServicioBcrypt.js";
import {
    construirIdentificadorLogin,
    estaBloqueado,
    limpiarIntentos,
    registrarIntento,
} from "../src/autenticacion/rateLimiter.js";
import prisma from "../src/persistencia/prismaClient.js";
import redis from "../src/persistencia/redisClient.js";
import {
    cerrarEntornoIntegracion,
    limpiarEntornoIntegracion,
    verificarEntornoIntegracion,
} from "../tests/integration/entornoIntegracion.js";

const ITERACIONES = 100;
const CALENTAMIENTO = 10;
const IP_PRUEBA = "198.51.100.10";
const EMAIL_EXISTENTE = "timing-existente@uvg.edu.gt";
const EMAIL_INEXISTENTE = "timing-inexistente@uvg.edu.gt";
const PASSWORD_REAL = "TimingPassword1";
const PASSWORD_INCORRECTA = "TimingPassword2";
const MODO_LEGACY = process.argv.includes("--legacy");

type TipoIntento = "existente" | "inexistente";

interface ResultadoIntento {
    tipo: TipoIntento;
    duracionMs: number;
    status: number;
}

function percentil(valoresOrdenados: number[], porcentaje: number): number {
    const indice = (valoresOrdenados.length - 1) * porcentaje;
    const inferior = Math.floor(indice);
    const superior = Math.ceil(indice);
    if (inferior === superior) return valoresOrdenados[inferior];
    return valoresOrdenados[inferior] + (valoresOrdenados[superior] - valoresOrdenados[inferior]) * (indice - inferior);
}

function resumir(valores: number[]) {
    const ordenados = [...valores].sort((a, b) => a - b);
    const media = valores.reduce((total, valor) => total + valor, 0) / valores.length;
    const varianza = valores.reduce((total, valor) => total + (valor - media) ** 2, 0) / valores.length;
    return {
        cantidad: valores.length,
        mediaMs: Number(media.toFixed(2)),
        desviacionMs: Number(Math.sqrt(varianza).toFixed(2)),
        minimoMs: Number(ordenados[0].toFixed(2)),
        p25Ms: Number(percentil(ordenados, 0.25).toFixed(2)),
        medianaMs: Number(percentil(ordenados, 0.5).toFixed(2)),
        p75Ms: Number(percentil(ordenados, 0.75).toFixed(2)),
        p95Ms: Number(percentil(ordenados, 0.95).toFixed(2)),
        maximoMs: Number(ordenados.at(-1)!.toFixed(2)),
    };
}

/**
 * Delta de Cliff: 0 indica distribuciones superpuestas; +/-1, separacion total.
 */
function deltaCliff(existentes: number[], inexistentes: number[]): number {
    let mayores = 0;
    let menores = 0;
    for (const existente of existentes) {
        for (const inexistente of inexistentes) {
            if (existente > inexistente) mayores += 1;
            if (existente < inexistente) menores += 1;
        }
    }
    return Number(((mayores - menores) / (existentes.length * inexistentes.length)).toFixed(4));
}

function secuenciaIntercalada(cantidad: number): TipoIntento[] {
    const secuencia: TipoIntento[] = [];
    for (let indice = 0; indice < cantidad; indice += 1) {
        // Alternar el orden de cada pareja evita favorecer siempre al segundo caso.
        if (indice % 2 === 0) secuencia.push("existente", "inexistente");
        else secuencia.push("inexistente", "existente");
    }
    return secuencia;
}

async function medirIntento(app: express.Express, tipo: TipoIntento): Promise<ResultadoIntento> {
    const email = tipo === "existente" ? EMAIL_EXISTENTE : EMAIL_INEXISTENTE;
    const inicio = process.hrtime.bigint();
    const respuesta = await request(app)
        .post("/auth/login")
        .set("X-Forwarded-For", IP_PRUEBA)
        .send({ email_institucional: email, password: PASSWORD_INCORRECTA });
    const fin = process.hrtime.bigint();

    // La limpieza queda fuera de la medicion para que el bloqueo no altere la muestra.
    await limpiarIntentos("login", construirIdentificadorLogin(IP_PRUEBA, email));

    return {
        tipo,
        duracionMs: Number(fin - inicio) / 1_000_000,
        status: respuesta.status,
    };
}

async function main(): Promise<void> {
    verificarEntornoIntegracion();
    await limpiarEntornoIntegracion();

    const hash = await ServicioBcrypt.hashearPassword(PASSWORD_REAL);
    await prisma.usuario.create({
        data: {
            nombre: "Usuario benchmark timing",
            carnet: 990001,
            email_institucional: EMAIL_EXISTENTE,
            password: hash,
            url_foto_perfil: "default.png",
        },
    });

    const app = express();
    app.set("trust proxy", true);
    app.use(express.json());
    if (MODO_LEGACY) {
        // Reproduce solo en el benchmark el flujo previo al hash señuelo. No
        // existe ninguna bandera equivalente en la aplicación de producción.
        app.post("/auth/login", async (req, res, next) => {
            try {
                const email = String(req.body.email_institucional).toLowerCase();
                const identificador = construirIdentificadorLogin(req.ip ?? "unknown", email);
                if (await estaBloqueado("login", identificador)) {
                    res.status(429).json({ success: false });
                    return;
                }
                const usuario = await prisma.usuario.findUnique({ where: { email_institucional: email } });
                if (usuario) {
                    await ServicioBcrypt.compararPassword(req.body.password, usuario.password);
                }
                await registrarIntento("login", identificador);
                res.status(401).json({ success: false, message: "Credenciales invalidas" });
            } catch (error) {
                next(error);
            }
        });
    } else {
        app.use("/auth", routerAuth);
    }

    for (const tipo of secuenciaIntercalada(CALENTAMIENTO)) {
        await medirIntento(app, tipo);
    }

    const resultados: ResultadoIntento[] = [];
    for (const tipo of secuenciaIntercalada(ITERACIONES)) {
        resultados.push(await medirIntento(app, tipo));
    }

    const estadosInvalidos = resultados.filter((resultado) => resultado.status !== 401);
    if (estadosInvalidos.length > 0) {
        throw new Error(`El benchmark obtuvo ${estadosInvalidos.length} respuestas distintas de 401.`);
    }

    const existentes = resultados.filter(({ tipo }) => tipo === "existente").map(({ duracionMs }) => duracionMs);
    const inexistentes = resultados.filter(({ tipo }) => tipo === "inexistente").map(({ duracionMs }) => duracionMs);
    const resumenExistentes = resumir(existentes);
    const resumenInexistentes = resumir(inexistentes);

    console.log(JSON.stringify({
        fecha: new Date().toISOString(),
        mode: MODO_LEGACY ? "legacy_without_dummy_hash" : "current_with_dummy_hash",
        iteracionesPorTipo: ITERACIONES,
        calentamientoPorTipo: CALENTAMIENTO,
        bcryptSaltRounds: Number.parseInt(process.env.BCRYPT_SALT_ROUNDS ?? "10", 10),
        existente: resumenExistentes,
        inexistente: resumenInexistentes,
        diferenciaMedianasMs: Number((resumenExistentes.medianaMs - resumenInexistentes.medianaMs).toFixed(2)),
        deltaCliff: deltaCliff(existentes, inexistentes),
        muestrasMs: { existente: existentes, inexistente: inexistentes },
    }, null, 2));
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.usuario.deleteMany({
            where: { email_institucional: { in: [EMAIL_EXISTENTE, EMAIL_INEXISTENTE] } },
        }).catch(() => undefined);
        await redis.flushDb().catch(() => undefined);
        await cerrarEntornoIntegracion();
    });
