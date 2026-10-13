import { describe, expect, it } from "vitest";
import { catalogarEventoAuditoria } from "../../src/observabilidad/auditoria";

function peticion(method: string, originalUrl: string) {
    return { method, originalUrl } as any;
}

describe("catálogo de auditoría", () => {
    it.each([
        ["POST", "/api/v1/auth/login", "auth.login"],
        ["POST", "/api/auth/reset-password", "auth.password_reset"],
        ["PATCH", "/api/v1/acuerdo/4/estado", "agreement.patch"],
        ["PATCH", "/api/moderador/usuarios/8/estado", "moderation.patch"],
        ["PATCH", "/api/v1/moderador/7", "role.moderator_changed"],
    ])("clasifica %s %s", (method, route, event) => {
        expect(catalogarEventoAuditoria(peticion(method, route))).toBe(event);
    });

    it("ignora lecturas no críticas", () => {
        expect(catalogarEventoAuditoria(peticion("GET", "/api/v1/estado"))).toBeUndefined();
    });
});
