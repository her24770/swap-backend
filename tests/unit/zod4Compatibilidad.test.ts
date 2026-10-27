import { describe, expect, it, vi } from "vitest";
import { schemaLogin } from "../../src/modelo/schemaAuth";
import { schemaCrearPublicacion, schemaFiltrosPublicacion } from "../../src/modelo/schemaPublicacion";
import { schemaFiltrosTutor } from "../../src/modelo/schemaUsuario";
import { errorValidacionResponse } from "../../src/servicios/Response";

describe("compatibilidad de respuestas con Zod 4", () => {
    it("conserva los mensajes de campos requeridos", () => {
        const resultado = schemaLogin.safeParse({});

        expect(resultado.success).toBe(false);
        expect(resultado.error?.issues.map(({ path, message }) => [path, message])).toEqual([
            [["email_institucional"], "El correo institucional es obligatorio."],
            [["password"], "La contraseña es obligatoria."],
        ]);
    });

    it("conserva los mensajes de formato y tipo", () => {
        const login = schemaLogin.safeParse({
            email_institucional: "correo-invalido",
            password: "secreta",
        });
        const publicacion = schemaCrearPublicacion.safeParse({
            titulo: "Título válido",
            descripcion: "Descripción suficientemente larga",
            precio: "no-es-numero",
            tipo_publicacion: "desconocido",
        });

        expect(login.error?.issues[0].message).toBe("El correo no tiene un formato válido.");
        expect(publicacion.error?.issues.map(({ message }) => message)).toEqual([
            "El precio debe ser un número.",
            "El tipo debe ser 'material', 'tutoria' o 'negocio'.",
        ]);
    });

    it("mantiene el contrato HTTP de los errores de validación", () => {
        const json = vi.fn();
        const status = vi.fn(() => ({ json }));
        const resultado = schemaLogin.safeParse({});

        expect(resultado.success).toBe(false);
        if (resultado.success) return;

        errorValidacionResponse({ status } as never, resultado.error.issues);

        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalledWith({
            success: false,
            message: "Error de validación",
            errores: [
                { campo: "email_institucional", mensaje: "El correo institucional es obligatorio." },
                { campo: "password", mensaje: "La contraseña es obligatoria." },
            ],
        });
    });

    it("no activa filtros opcionales omitidos y conserva los defaults de paginación", () => {
        expect(schemaFiltrosPublicacion.parse({})).toEqual({
            page: 1,
            limit: 10,
            sort: "fecha",
            order: "desc",
        });
        expect(schemaFiltrosTutor.parse({ etiquetas: [1] })).toEqual({
            page: 1,
            limit: 10,
            sort: "fecha",
            order: "desc",
            etiquetas: [1],
        });
    });
});
