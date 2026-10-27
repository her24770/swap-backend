import { describe, expect, it } from "vitest";
import {
    schemaParamIdNotificacion,
    schemaCambiarEstadoNotificacion,
} from "../../src/modelo/schemaNotificacion.js";

describe("schemaParamIdNotificacion", () => {
    it("acepta un id numérico válido como string o number", () => {
        expect(schemaParamIdNotificacion.safeParse({ id: "1" }).success).toBe(true);
        expect(schemaParamIdNotificacion.safeParse({ id: "42" }).success).toBe(true);
        expect(schemaParamIdNotificacion.safeParse({ id: 10 }).success).toBe(true);

        const parsed = schemaParamIdNotificacion.parse({ id: "15" });
        expect(parsed.id).toBe(15);
    });

    it("rechaza strings no numéricos como 'abc'", () => {
        const resultado = schemaParamIdNotificacion.safeParse({ id: "abc" });
        expect(resultado.success).toBe(false);
        if (!resultado.success) {
            expect(resultado.error.issues[0].message).toContain("El ID de la notificación debe ser un número");
        }
    });

    it("rechaza números negativos, cero o decimales", () => {
        expect(schemaParamIdNotificacion.safeParse({ id: "0" }).success).toBe(false);
        expect(schemaParamIdNotificacion.safeParse({ id: "-5" }).success).toBe(false);
        expect(schemaParamIdNotificacion.safeParse({ id: "1.5" }).success).toBe(false);
        expect(schemaParamIdNotificacion.safeParse({ id: 0 }).success).toBe(false);
        expect(schemaParamIdNotificacion.safeParse({ id: -1 }).success).toBe(false);
    });

    it("rechaza cuando no se proporciona id", () => {
        expect(schemaParamIdNotificacion.safeParse({}).success).toBe(false);
    });
});

describe("schemaCambiarEstadoNotificacion", () => {
    it("acepta 'leido' y 'enviado'", () => {
        expect(schemaCambiarEstadoNotificacion.safeParse({ estado: "leido" }).success).toBe(true);
        expect(schemaCambiarEstadoNotificacion.safeParse({ estado: "enviado" }).success).toBe(true);
    });

    it("rechaza estados desconocidos", () => {
        const resultado = schemaCambiarEstadoNotificacion.safeParse({ estado: "invalido" });
        expect(resultado.success).toBe(false);
        if (!resultado.success) {
            expect(resultado.error.issues[0].message).toContain("Estado inválido");
        }
    });

    it("rechaza cuando no se envía estado o viene vacío", () => {
        expect(schemaCambiarEstadoNotificacion.safeParse({}).success).toBe(false);
        expect(schemaCambiarEstadoNotificacion.safeParse({ estado: "" }).success).toBe(false);
    });
});
