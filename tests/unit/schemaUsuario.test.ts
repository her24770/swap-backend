import { describe, expect, it } from "vitest";
import {
  schemaActualizarPerfil,
  schemaAgregarContactos,
  schemaFiltrosTutor,
} from "../../src/modelo/schemaUsuario";


describe("schemaActualizarPerfil", () => {
  it("acepta una actualización con nombre válido", () => {
    const result = schemaActualizarPerfil.safeParse({
      nombre: "Juan Pérez",
    });

    expect(result.success).toBe(true);
  });

  it("acepta una URL de foto del dominio R2 configurado", () => {
    const anterior = process.env.CLOUDFLARE_R2_PUBLIC_URL;
    process.env.CLOUDFLARE_R2_PUBLIC_URL = "https://pub-test.r2.dev";

    try {
      const result = schemaActualizarPerfil.safeParse({
        url_foto_perfil: "https://pub-test.r2.dev/perfil/foto.jpg",
      });

      expect(result.success).toBe(true);
    } finally {
      if (anterior === undefined) delete process.env.CLOUDFLARE_R2_PUBLIC_URL;
      else process.env.CLOUDFLARE_R2_PUBLIC_URL = anterior;
    }
  });

  it("rechaza una URL de foto de un dominio externo", () => {
    const anterior = process.env.CLOUDFLARE_R2_PUBLIC_URL;
    process.env.CLOUDFLARE_R2_PUBLIC_URL = "https://pub-test.r2.dev";

    try {
      const result = schemaActualizarPerfil.safeParse({
        url_foto_perfil: "https://example.com/foto.jpg",
      });

      expect(result.success).toBe(false);
    } finally {
      if (anterior === undefined) delete process.env.CLOUDFLARE_R2_PUBLIC_URL;
      else process.env.CLOUDFLARE_R2_PUBLIC_URL = anterior;
    }
  });

  it("acepta descripción nullable", () => {
    const result = schemaActualizarPerfil.safeParse({
      descripcion: null,
    });

    expect(result.success).toBe(true);
  });

  it("rechaza una actualización vacía", () => {
    const result = schemaActualizarPerfil.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rechaza nombres demasiado cortos", () => {
    const result = schemaActualizarPerfil.safeParse({
      nombre: "A",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza nombres demasiado largos", () => {
    const result = schemaActualizarPerfil.safeParse({
      nombre: "A".repeat(101),
    });

    expect(result.success).toBe(false);
  });

  it("rechaza nombres con números", () => {
    const result = schemaActualizarPerfil.safeParse({
      nombre: "Juan123",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza URL de foto inválida", () => {
    const result = schemaActualizarPerfil.safeParse({
      url_foto_perfil: "imagen-no-valida",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza descripción demasiado larga", () => {
    const result = schemaActualizarPerfil.safeParse({
      descripcion: "A".repeat(501),
    });

    expect(result.success).toBe(false);
  });
});


describe("schemaAgregarContactos", () => {
  it("acepta un contacto individual válido", () => {
    const result = schemaAgregarContactos.safeParse({
      contactos: {
        tipo_contacto: 1,
        valor: "usuario@gmail.com",
      },
    });

    expect(result.success).toBe(true);
  });

  it("acepta múltiples contactos válidos", () => {
    const result = schemaAgregarContactos.safeParse({
      contactos: [
        {
          tipo_contacto: 1,
          valor: "usuario@gmail.com",
        },
        {
          tipo_contacto: 2,
          valor: "+50255555555",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rechaza cuando no se envían contactos", () => {
    const result = schemaAgregarContactos.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rechaza array de contactos vacío", () => {
    const result = schemaAgregarContactos.safeParse({
      contactos: [],
    });

    expect(result.success).toBe(false);
  });

  it("rechaza tipo de contacto inválido", () => {
    const result = schemaAgregarContactos.safeParse({
      contactos: {
        tipo_contacto: -1,
        valor: "test",
      },
    });

    expect(result.success).toBe(false);
  });

  it("rechaza tipo de contacto no numérico", () => {
    const result = schemaAgregarContactos.safeParse({
      contactos: {
        tipo_contacto: "correo",
        valor: "test",
      },
    });

    expect(result.success).toBe(false);
  });

  it("rechaza valor vacío del contacto", () => {
    const result = schemaAgregarContactos.safeParse({
      contactos: {
        tipo_contacto: 1,
        valor: "",
      },
    });

    expect(result.success).toBe(false);
  });

  it("rechaza valor demasiado largo", () => {
    const result = schemaAgregarContactos.safeParse({
      contactos: {
        tipo_contacto: 1,
        valor: "A".repeat(256),
      },
    });

    expect(result.success).toBe(false);
  });
});


describe("schemaFiltrosTutor", () => {
  it("acepta filtros válidos", () => {
    const result = schemaFiltrosTutor.safeParse({
      precio_min: 10,
      precio_max: 50,
      calificacion_min: 3,
      calificacion_max: 5,
      etiquetas: [1, 2],
      dias: ["lunes", "viernes"],
      hora_inicio: "08:30",
      hora_final: "18:00",
    });

    expect(result.success).toBe(true);
  });

  it("acepta filtros vacíos", () => {
    const result = schemaFiltrosTutor.safeParse({});

    expect(result.success).toBe(true);
  });

  it("rechaza límites mayores a 100", () => {
    expect(schemaFiltrosTutor.safeParse({ limit: 100 }).success).toBe(true);
    expect(schemaFiltrosTutor.safeParse({ limit: 101 }).success).toBe(false);
  });

  it("rechaza precio mínimo negativo", () => {
    const result = schemaFiltrosTutor.safeParse({
      precio_min: -1,
    });

    expect(result.success).toBe(false);
  });

  it("rechaza precio máximo negativo", () => {
    const result = schemaFiltrosTutor.safeParse({
      precio_max: -10,
    });

    expect(result.success).toBe(false);
  });

  it("rechaza calificación menor a 0", () => {
    const result = schemaFiltrosTutor.safeParse({
      calificacion_min: -1,
    });

    expect(result.success).toBe(false);
  });

  it("rechaza calificación mayor a 5", () => {
    const result = schemaFiltrosTutor.safeParse({
      calificacion_max: 6,
    });

    expect(result.success).toBe(false);
  });

  it("rechaza etiquetas con IDs inválidos", () => {
    const result = schemaFiltrosTutor.safeParse({
      etiquetas: [0, -1],
    });

    expect(result.success).toBe(false);
  });

  it("rechaza días inválidos", () => {
    const result = schemaFiltrosTutor.safeParse({
      dias: ["lunes", "otro-dia"],
    });

    expect(result.success).toBe(false);
  });

  it("acepta horas con formato correcto", () => {
    const result = schemaFiltrosTutor.safeParse({
      hora_inicio: "23:59",
      hora_final: "00:00",
    });

    expect(result.success).toBe(true);
  });

  it("rechaza horas con formato incorrecto", () => {
    const result = schemaFiltrosTutor.safeParse({
      hora_inicio: "25:00",
    });

    expect(result.success).toBe(false);
  });
});
