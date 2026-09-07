import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import app from "../../src/app";
import prisma from "../../src/persistencia/prismaClient";
import { crearPublicacionTest, crearUsuarioTest } from "../helpers";
import {
    cerrarEntornoIntegracion,
    limpiarEntornoIntegracion,
} from "./entornoIntegracion";

interface Catalogos {
    estados: Record<"activo" | "inactivo" | "disponible" | "reservado" | "vendido", number>;
    tipos: Record<"material" | "tutoria" | "negocio", number>;
}

let catalogos: Catalogos;

async function crearCatalogos(): Promise<Catalogos> {
    await prisma.estado.createMany({
        data: ["activo", "inactivo", "disponible", "reservado", "vendido"]
            .map((estado) => ({ estado })),
    });
    await prisma.tipoPerfil.createMany({
        data: ["material", "tutoria", "negocio"]
            .map((tipo_perfil) => ({ tipo_perfil })),
    });
    await prisma.tipoResena.createMany({
        data: ["vendedor", "tutor", "consumidor"]
            .map((tipo_resena) => ({ tipo_resena })),
    });

    const [estados, tipos] = await Promise.all([
        prisma.estado.findMany(),
        prisma.tipoPerfil.findMany(),
    ]);

    return {
        estados: Object.fromEntries(estados.map(({ estado, id_estado }) => [estado, id_estado])),
        tipos: Object.fromEntries(tipos.map(({ tipo_perfil, id_tipo_perfil }) => [tipo_perfil, id_tipo_perfil])),
    } as Catalogos;
}

describe.runIf(process.env.RUN_INTEGRATION === "true")(
    "perfil, publicaciones y reseñas con PostgreSQL/Redis reales",
    () => {
        beforeEach(async () => {
            await limpiarEntornoIntegracion();
            catalogos = await crearCatalogos();
        });

        afterEach(async () => {
            await limpiarEntornoIntegracion();
        });

        afterAll(async () => {
            await cerrarEntornoIntegracion();
        });

        it("IT-12: muestra el perfil completo del vendedor, sus publicaciones y reseñas sin exponer datos privados", async () => {
            const [vendedor, comprador] = await Promise.all([
                crearUsuarioTest({ nombre: "Vendedor Completo" }),
                crearUsuarioTest({ nombre: "Comprador Perfil" }),
            ]);
            await prisma.usuario.update({
                where: { id_usuario: vendedor.id_usuario },
                data: { descripcion: "Vendo materiales universitarios en buen estado." },
            });
            const tipoContacto = await prisma.tipoContacto.create({
                data: { tipo_contacto: "whatsapp" },
            });
            await prisma.contacto.create({
                data: {
                    id_usuario: vendedor.id_usuario,
                    tipo_contacto: tipoContacto.id_tipo_contacto,
                    valor: "+502 5555-0101",
                },
            });
            const etiqueta = await prisma.etiqueta.create({
                data: { nombre: "Cálculo", descripcion: "Cursos de cálculo" },
            });
            await prisma.usuarioEtiqueta.create({
                data: { id_usuario: vendedor.id_usuario, id_etiqueta: etiqueta.id_etiqueta },
            });
            const publicacion = await crearPublicacionTest({
                id_usuario: vendedor.id_usuario,
                titulo: "Libro de cálculo diferencial",
                descripcion: "Libro usado con ejercicios resueltos y anotaciones.",
                estado: catalogos.estados.activo,
                tipo_publicacion: catalogos.tipos.material,
            });

            await request(app)
                .post("/api/v1/resenas")
                .set("Authorization", `Bearer ${comprador.token}`)
                .send({
                    id_receptor: vendedor.id_usuario,
                    tipo_resena: "vendedor",
                    calificacion: 5,
                    contenido: "Entrega puntual y artículo tal como se describió.",
                })
                .expect(201);

            const [perfil, publicaciones, resenas] = await Promise.all([
                request(app).get(`/api/v1/user/${vendedor.id_usuario}/perfil-publico`).expect(200),
                request(app)
                    .get(`/api/v1/publicacion/user/${vendedor.id_usuario}`)
                    .query({ tipo: "material" })
                    .set("Authorization", `Bearer ${comprador.token}`)
                    .expect(200),
                request(app)
                    .get(`/api/v1/resenas/usuario/${vendedor.id_usuario}`)
                    .query({ tipo: "vendedor" })
                    .expect(200),
            ]);

            expect(perfil.body.data).toEqual(expect.objectContaining({
                id_usuario: vendedor.id_usuario,
                nombre: vendedor.nombre,
                descripcion: "Vendo materiales universitarios en buen estado.",
                calificacion: 5,
                total_resenas: 1,
                contactos: [expect.objectContaining({ valor: "+502 5555-0101" })],
                etiquetas: [expect.objectContaining({ id_etiqueta: etiqueta.id_etiqueta })],
            }));
            expect(perfil.body.data).not.toHaveProperty("password");
            expect(perfil.body.data).not.toHaveProperty("email_institucional");
            expect(perfil.body.data).not.toHaveProperty("carnet");
            expect(publicaciones.body.data.map((item: { id_publicacion: number }) => item.id_publicacion))
                .toEqual([publicacion.id_publicacion]);
            expect(resenas.body.data).toEqual([
                expect.objectContaining({
                    id_receptor: vendedor.id_usuario,
                    calificacion: 5,
                    emisor: expect.objectContaining({ id_usuario: comprador.id_usuario }),
                }),
            ]);
        });

        it("IT-10: explora publicaciones y combina tipo, estado, precio, reputación y etiqueta al filtrarlas", async () => {
            const [visitante, vendedorConfiable, vendedorFueraDeRango] = await Promise.all([
                crearUsuarioTest({ nombre: "Visitante Filtros" }),
                crearUsuarioTest({ nombre: "Vendedor Confiable" }),
                crearUsuarioTest({ nombre: "Vendedor Fuera Rango" }),
            ]);
            await Promise.all([
                prisma.usuario.update({
                    where: { id_usuario: vendedorConfiable.id_usuario },
                    data: { calificacion: 4.8 },
                }),
                prisma.usuario.update({
                    where: { id_usuario: vendedorFueraDeRango.id_usuario },
                    data: { calificacion: 2 },
                }),
            ]);
            const [algebra, historia] = await Promise.all([
                prisma.etiqueta.create({ data: { nombre: "Álgebra", descripcion: "Matemática" } }),
                prisma.etiqueta.create({ data: { nombre: "Historia", descripcion: "Humanidades" } }),
            ]);
            const [coincidente, caro, bajaCalificacion, tutoria] = await Promise.all([
                crearPublicacionTest({
                    id_usuario: vendedorConfiable.id_usuario,
                    titulo: "Guía práctica de álgebra lineal",
                    precio: "60.00",
                    estado: catalogos.estados.activo,
                    tipo_publicacion: catalogos.tipos.material,
                }),
                crearPublicacionTest({
                    id_usuario: vendedorConfiable.id_usuario,
                    titulo: "Libro premium de historia universal",
                    precio: "150.00",
                    estado: catalogos.estados.activo,
                    tipo_publicacion: catalogos.tipos.material,
                }),
                crearPublicacionTest({
                    id_usuario: vendedorFueraDeRango.id_usuario,
                    titulo: "Cuaderno económico de álgebra",
                    precio: "70.00",
                    estado: catalogos.estados.activo,
                    tipo_publicacion: catalogos.tipos.material,
                }),
                crearPublicacionTest({
                    id_usuario: vendedorConfiable.id_usuario,
                    titulo: "Tutoría personalizada de álgebra",
                    precio: "65.00",
                    estado: catalogos.estados.activo,
                    tipo_publicacion: catalogos.tipos.tutoria,
                }),
            ]);
            await prisma.publicacionEtiqueta.createMany({
                data: [
                    { id_publicacion: coincidente.id_publicacion, id_etiqueta: algebra.id_etiqueta },
                    { id_publicacion: caro.id_publicacion, id_etiqueta: historia.id_etiqueta },
                    { id_publicacion: bajaCalificacion.id_publicacion, id_etiqueta: algebra.id_etiqueta },
                    { id_publicacion: tutoria.id_publicacion, id_etiqueta: algebra.id_etiqueta },
                ],
            });

            const exploracion = await request(app)
                .get("/api/v1/publicacion")
                .query({ tipo: "material", limit: 10 })
                .set("Authorization", `Bearer ${visitante.token}`)
                .expect(200);

            expect(exploracion.body.data.publicaciones).toHaveLength(3);
            expect(exploracion.body.data.publicaciones).not.toEqual(expect.arrayContaining([
                expect.objectContaining({ id_publicacion: tutoria.id_publicacion }),
            ]));

            const filtradas = await request(app)
                .post("/api/v1/publicacion/buscar")
                .set("Authorization", `Bearer ${visitante.token}`)
                .send({
                    tipo: "material",
                    estado: "activo",
                    precio_min: 50,
                    precio_max: 80,
                    calificacion_min: 4,
                    calificacion_max: 5,
                    etiquetas: [algebra.id_etiqueta],
                    sort: "precio",
                    order: "asc",
                    page: 1,
                    limit: 10,
                })
                .expect(200);

            expect(filtradas.body.data).toEqual(expect.objectContaining({ total: 1, page: 1, limit: 10 }));
            expect(filtradas.body.data.publicaciones).toEqual([
                expect.objectContaining({
                    id_publicacion: coincidente.id_publicacion,
                    precio: "60",
                    usuario: expect.objectContaining({ calificacion: "4.8" }),
                }),
            ]);
        });

        it("IT-25: separa el feedback recibido como vendedor del recibido como tutor", async () => {
            const [receptor, comprador, estudiante] = await Promise.all([
                crearUsuarioTest({ nombre: "Vendedor y Tutor" }),
                crearUsuarioTest({ nombre: "Comprador Feedback" }),
                crearUsuarioTest({ nombre: "Estudiante Feedback" }),
            ]);
            await request(app)
                .post("/api/v1/resenas")
                .set("Authorization", `Bearer ${comprador.token}`)
                .send({
                    id_receptor: receptor.id_usuario,
                    tipo_resena: "vendedor",
                    calificacion: 4,
                    contenido: "El producto llegó completo y en buen estado.",
                })
                .expect(201);
            await request(app)
                .post("/api/v1/resenas")
                .set("Authorization", `Bearer ${estudiante.token}`)
                .send({
                    id_receptor: receptor.id_usuario,
                    tipo_resena: "tutor",
                    calificacion: 5,
                    contenido: "Explicó los ejercicios con mucha claridad y paciencia.",
                })
                .expect(201);

            const [comoVendedor, comoTutor] = await Promise.all([
                request(app)
                    .get(`/api/v1/resenas/usuario/${receptor.id_usuario}`)
                    .query({ tipo: "vendedor" })
                    .expect(200),
                request(app)
                    .get(`/api/v1/resenas/usuario/${receptor.id_usuario}`)
                    .query({ tipo: "tutor" })
                    .expect(200),
            ]);

            expect(comoVendedor.body.data).toEqual([
                expect.objectContaining({
                    calificacion: 4,
                    tipoResena: { tipo_resena: "vendedor" },
                    emisor: expect.objectContaining({ id_usuario: comprador.id_usuario }),
                }),
            ]);
            expect(comoTutor.body.data).toEqual([
                expect.objectContaining({
                    calificacion: 5,
                    tipoResena: { tipo_resena: "tutor" },
                    emisor: expect.objectContaining({ id_usuario: estudiante.id_usuario }),
                }),
            ]);
        });

        it("IT-09: cambia solo entre estados permitidos y conserva el estado ante intentos inválidos", async () => {
            const [propietario, ajeno] = await Promise.all([
                crearUsuarioTest({ nombre: "Propietario Estados" }),
                crearUsuarioTest({ nombre: "Usuario Ajeno Estados" }),
            ]);
            const publicacion = await crearPublicacionTest({
                id_usuario: propietario.id_usuario,
                estado: catalogos.estados.activo,
                tipo_publicacion: catalogos.tipos.material,
            });

            await request(app)
                .patch(`/api/v1/publicacion/${publicacion.id_publicacion}/estado`)
                .set("Authorization", `Bearer ${propietario.token}`)
                .send({ estado_id: catalogos.estados.vendido })
                .expect(400);

            const cambio = await request(app)
                .patch(`/api/v1/publicacion/${publicacion.id_publicacion}/estado`)
                .set("Authorization", `Bearer ${propietario.token}`)
                .send({ estado_id: catalogos.estados.inactivo })
                .expect(200);
            expect(cambio.body.data).toEqual(expect.objectContaining({
                estado: catalogos.estados.inactivo,
                estado_nombre: "inactivo",
            }));

            await request(app)
                .patch(`/api/v1/publicacion/${publicacion.id_publicacion}/estado`)
                .set("Authorization", `Bearer ${propietario.token}`)
                .send({ estado_id: catalogos.estados.inactivo })
                .expect(400);
            await request(app)
                .patch(`/api/v1/publicacion/${publicacion.id_publicacion}/estado`)
                .set("Authorization", `Bearer ${ajeno.token}`)
                .send({ estado_id: catalogos.estados.activo })
                .expect(403);

            expect(await prisma.publicacion.findUnique({
                where: { id_publicacion: publicacion.id_publicacion },
            })).toEqual(expect.objectContaining({ estado: catalogos.estados.inactivo }));
        });

        it("IT-24: recalcula la calificación y el total de reseñas al calificar como vendedor y tutor", async () => {
            const [receptor, comprador, estudiante] = await Promise.all([
                crearUsuarioTest({ nombre: "Receptor Reputación" }),
                crearUsuarioTest({ nombre: "Comprador Reputación" }),
                crearUsuarioTest({ nombre: "Estudiante Reputación" }),
            ]);
            await request(app)
                .post("/api/v1/resenas")
                .set("Authorization", `Bearer ${comprador.token}`)
                .send({
                    id_receptor: receptor.id_usuario,
                    tipo_resena: "vendedor",
                    calificacion: 5,
                    contenido: "Excelente comunicación durante toda la compra.",
                })
                .expect(201);
            await request(app)
                .post("/api/v1/resenas")
                .set("Authorization", `Bearer ${estudiante.token}`)
                .send({
                    id_receptor: receptor.id_usuario,
                    tipo_resena: "tutor",
                    calificacion: 3,
                    contenido: "La tutoría fue útil, aunque faltó cubrir un tema.",
                })
                .expect(201);

            const perfil = await request(app)
                .get(`/api/v1/user/${receptor.id_usuario}/perfil-publico`)
                .expect(200);
            const receptorDb = await prisma.usuario.findUnique({
                where: { id_usuario: receptor.id_usuario },
            });

            expect(perfil.body.data).toEqual(expect.objectContaining({
                calificacion: 4,
                total_resenas: 2,
            }));
            expect(receptorDb?.calificacion?.toNumber()).toBe(4);
            expect(receptorDb?.total_resenas).toBe(2);
        });

        it("IT-08: elimina una publicación propia y deja de exponerla en detalle y listados", async () => {
            const propietario = await crearUsuarioTest({ nombre: "Propietario Eliminación" });
            const publicacion = await crearPublicacionTest({
                id_usuario: propietario.id_usuario,
                estado: catalogos.estados.activo,
                tipo_publicacion: catalogos.tipos.material,
            });

            await request(app)
                .get(`/api/v1/publicacion/${publicacion.id_publicacion}`)
                .set("Authorization", `Bearer ${propietario.token}`)
                .expect(200);
            await request(app)
                .delete(`/api/v1/publicacion/${publicacion.id_publicacion}`)
                .set("Authorization", `Bearer ${propietario.token}`)
                .expect(200);
            await request(app)
                .get(`/api/v1/publicacion/${publicacion.id_publicacion}`)
                .set("Authorization", `Bearer ${propietario.token}`)
                .expect(404);

            const listado = await request(app)
                .get(`/api/v1/publicacion/user/${propietario.id_usuario}`)
                .query({ tipo: "material" })
                .set("Authorization", `Bearer ${propietario.token}`)
                .expect(200);
            expect(listado.body.data).toEqual([]);
            expect(await prisma.publicacion.findUnique({
                where: { id_publicacion: publicacion.id_publicacion },
            })).toBeNull();
        });
    },
);
