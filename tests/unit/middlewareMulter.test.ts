import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import express, { NextFunction, Request, Response } from "express";
import type multer from "multer";
import request from "supertest";
import { esErrorCargaArchivo, TipoArchivoError, contenidoCoincideConMime, uploadImagen, uploadPdf } from "../../src/servicios/middlewareMulter";

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

    it("captura errores del stream y finaliza la carga una sola vez", () => {
        const stream = new PassThrough();
        const callback = vi.fn();
        const storage = (uploadImagen as unknown as { storage: multer.StorageEngine }).storage;

        storage._handleFile({} as unknown as Request, {
            stream,
            mimetype: "image/png",
        } as unknown as Express.Multer.File, callback);

        stream.emit("data", Buffer.from("contenido parcial"));
        const error = new Error("Unexpected end of file");
        stream.emit("error", error);
        stream.emit("end");

        expect(callback).toHaveBeenCalledOnce();
        expect(callback).toHaveBeenCalledWith(error);
        expect(esErrorCargaArchivo(error)).toBe(true);
    });

    it("responde 400 cuando el body multipart queda truncado", async () => {
        const app = express();
        app.get("/health", (_req, res) => res.sendStatus(200));
        app.post("/", uploadImagen.single("imagen"), (_req, res) => res.sendStatus(204));
        app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
            const esErrorCarga = err instanceof TipoArchivoError || esErrorCargaArchivo(err);
            res.status(esErrorCarga ? 400 : 500).json({
                message: esErrorCargaArchivo(err) ? "Error al procesar el archivo." : err.message,
            });
        });

        const respuesta = await request(app)
            .post("/")
            .set("Content-Type", "multipart/form-data; boundary=x")
            .send("--x\r\nContent-Disposition: form-data; name=\"imagen\"; filename=\"x.png\"\r\nContent-Type: image/png\r\n\r\ncontenido parcial");

        expect(respuesta.status).toBe(400);
        expect(respuesta.body.message).toBe("Error al procesar el archivo.");
        expect((await request(app).get("/health")).status).toBe(200);
    });
});
