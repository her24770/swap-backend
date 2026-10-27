type IncidenciaConEntrada = {
    code?: string;
    input?: unknown;
};

/**
 * Conserva en Zod 4 la distinción que Zod 3 hacía entre un campo ausente y
 * un valor presente con un tipo incorrecto.
 */
export function errorRequerido(mensajeRequerido: string, mensajeTipoInvalido?: string) {
    return {
        error: (incidencia: IncidenciaConEntrada) =>
            incidencia.input === undefined ? mensajeRequerido : mensajeTipoInvalido,
    };
}

/** Personaliza únicamente los errores de formato y conserva los de tipo. */
export function errorFormato(mensajeFormato: string) {
    return {
        error: (incidencia: IncidenciaConEntrada) =>
            incidencia.code === "invalid_format" ? mensajeFormato : undefined,
    };
}

/** Conserva mensajes distintos para ausencia, tipo incorrecto y formato. */
export function errorRequeridoFormato(mensajeRequerido: string, mensajeFormato: string) {
    return {
        error: (incidencia: IncidenciaConEntrada) => {
            if (incidencia.input === undefined) return mensajeRequerido;
            return incidencia.code === "invalid_format" ? mensajeFormato : undefined;
        },
    };
}
