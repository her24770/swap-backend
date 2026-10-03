import { describe, expect, it } from "vitest";
import { calcularTiempoSuspendido, interpretarEstadoCuenta } from "../../src/servicios/servicioEstadoCuenta";

describe("calcularTiempoSuspendido", () => {
  it("devuelve -1 para 'bloquear'", () => {
    expect(calcularTiempoSuspendido("bloquear")).toBe(-1);
  });

  it("devuelve 0 para 'reactivar'", () => {
    expect(calcularTiempoSuspendido("reactivar")).toBe(0);
  });

  it("calcula un timestamp futuro para 'suspender' con dias", () => {
    const ahora = Math.floor(Date.now() / 1000);
    const resultado = calcularTiempoSuspendido("suspender", 7);
    expect(resultado).toBeGreaterThan(ahora + 6 * 24 * 60 * 60);
    expect(resultado).toBeLessThanOrEqual(ahora + 7 * 24 * 60 * 60 + 5);
  });

  it("lanza error si 'suspender' no trae dias", () => {
    expect(() => calcularTiempoSuspendido("suspender")).toThrow();
  });

  it("lanza error si 'suspender' trae dias negativos o cero", () => {
    expect(() => calcularTiempoSuspendido("suspender", 0)).toThrow();
    expect(() => calcularTiempoSuspendido("suspender", -3)).toThrow();
  });
});

describe("interpretarEstadoCuenta", () => {
  it("interpreta 0 como cuenta activa", () => {
    expect(interpretarEstadoCuenta(0)).toEqual({
      bloqueada: false,
      suspendidaHasta: null,
      expirada: false,
    });
  });

  it("interpreta -1 como cuenta bloqueada", () => {
    expect(interpretarEstadoCuenta(-1)).toEqual({
      bloqueada: true,
      suspendidaHasta: null,
      expirada: false,
    });
  });

  it("interpreta un timestamp futuro como suspendida vigente", () => {
    const futuro = Math.floor(Date.now() / 1000) + 3600;
    const resultado = interpretarEstadoCuenta(futuro);
    expect(resultado.bloqueada).toBe(false);
    expect(resultado.expirada).toBe(false);
    expect(resultado.suspendidaHasta).toEqual(new Date(futuro * 1000));
  });

  it("interpreta un timestamp pasado como suspension expirada", () => {
    const pasado = Math.floor(Date.now() / 1000) - 3600;
    const resultado = interpretarEstadoCuenta(pasado);
    expect(resultado.bloqueada).toBe(false);
    expect(resultado.suspendidaHasta).toBeNull();
    expect(resultado.expirada).toBe(true);
  });
});
