import request from "supertest";
import { describe, it } from "vitest";
import app from "../../src/app";

describe("Endpoint health", () => {
    it("debe devolver un estado 200", async () => {
        await request(app).get("/api/health").expect(200);
    });
});