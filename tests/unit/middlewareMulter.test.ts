import { describe, expect, it } from "vitest";
import { contenidoCoincideConMime, uploadImagen, uploadPdf } from "../../src/servicios/middlewareMulter";

describe("middlewareMulter", () => {
    it.each([
        ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff])],
        ["image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        ["image/webp", Buffer.from("RIFF0000WEBP")],
        ["application/pdf", Buffer.from("%PDF-")],
    ])("acepta contenido cuya firma coincide con %s", (mimetype, contenido) => {
        expect(contenidoCoincideConMime(contenido, mimetype)).toBe(true);
    });

    it.each(["image/jpeg", "image/png", "image/webp", "application/pdf"])("rechaza contenido falso declarado como %s", mimetype => {
        expect(contenidoCoincideConMime(Buffer.from("contenido falso"), mimetype)).toBe(false);
    });

    it("rechaza una firma válida cuando no coincide con el MIME declarado", () => {
        expect(contenidoCoincideConMime(Buffer.from([0xff, 0xd8, 0xff]), "image/png")).toBe(false);
    });

    it("limita la cantidad de archivos antes de almacenarlos en memoria", () => {
        expect((uploadImagen as unknown as { limits: { files: number } }).limits.files).toBe(5);
        expect((uploadPdf as unknown as { limits: { files: number } }).limits.files).toBe(1);
    });
});
