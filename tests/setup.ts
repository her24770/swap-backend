import { vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET ??= "test-secret";
process.env.DATABASE_URL ??= "postgresql://swap_test:swap_test@localhost:55432/swap_unit_test?schema=public";
process.env.REDIS_URL ??= "redis://localhost:56379/15";

// Las pruebas unitarias y contractuales no necesitan cargar el binario nativo.
// La imagen Docker de integración sí instala bcrypt y puede sobrescribir este mock
// dentro de una suite específica cuando quiera probar hashing real.
vi.mock("bcrypt", () => ({
    default: { hash: vi.fn(), compare: vi.fn() },
    hash: vi.fn(),
    compare: vi.fn(),
}));
