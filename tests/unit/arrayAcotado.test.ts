import { describe, expect, it } from "vitest";
import { z } from "zod";
import { arrayAcotado } from "../../src/modelo/arrayAcotado";
import { schemaRegistro } from "../../src/modelo/schemaAuth";
import { schemaSincronizarEtiquetas } from "../../src/modelo/schemaEtiqueta";

describe("arrayAcotado (GHSA-mrhx-c7xc-m3w5)", () => {
    it("rechaza un array demasiado grande sin validar sus elementos", () => {
        let validados = 0;
        const item = z.number().refine((valor) => {
            validados++;
            return valor > 0;
        }, "inválido");

        const resultado = arrayAcotado(item, 50, "demasiados").safeParse(Array(100_000).fill(-1));

        expect(resultado.success).toBe(false);
        expect(validados).toBe(0);
        expect(resultado.error?.issues).toHaveLength(1);
        expect(resultado.error?.issues[0].message).toBe("demasiados");
    });

    it("dentro del límite valida cada elemento con su ruta", () => {
        const resultado = arrayAcotado(z.number().positive("inválido"), 5, "demasiados").safeParse([1, -1]);

        expect(resultado.success).toBe(false);
        expect(resultado.error?.issues.map((issue) => [issue.path, issue.message])).toEqual([[[1], "inválido"]]);
    });

    it("aplica las reglas extra al array ya validado", () => {
        const resultado = schemaSincronizarEtiquetas.safeParse({ ids: [] });

        expect(resultado.error?.issues[0].message).toBe("Debe proporcionar al menos una etiqueta.");
        expect(schemaSincronizarEtiquetas.parse({ ids: [1, 2] })).toEqual({ ids: [1, 2] });
    });

    it("el registro rechaza un array enorme de etiquetas con un solo error", () => {
        const resultado = schemaRegistro.safeParse({
            nombre: "Ana López",
            carnet: 24770,
            email_institucional: "ana@uvg.edu.gt",
            password: "Segura123",
            etiquetas: Array(100_000).fill("x"),
            codigo_verificacion: "123456",
        });

        expect(resultado.success).toBe(false);
        expect(resultado.error?.issues.map((issue) => issue.message)).toEqual([
            "No puedes seleccionar más de 10 categorías.",
        ]);
    });
});
