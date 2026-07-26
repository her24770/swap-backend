type OpenApiSchema = Record<string, unknown>;
type OpenApiParameter = Record<string, unknown>;

interface OperationOptions {
    description?: string;
    parameters?: OpenApiParameter[];
    body?: Record<string, unknown>;
    responseSchema?: OpenApiSchema;
    status?: number;
    secured?: boolean;
    rawResponse?: boolean;
}

const ref = (name: string): OpenApiSchema => ({
    $ref: `#/components/schemas/${name}`,
});

const arrayOf = (schema: OpenApiSchema): OpenApiSchema => ({
    type: "array",
    items: schema,
});

const pathId = (name: string, description: string): OpenApiParameter => ({
    name,
    in: "path",
    required: true,
    description,
    schema: { type: "integer", minimum: 1 },
});

const query = (
    name: string,
    description: string,
    schema: OpenApiSchema = { type: "string" },
    required = false,
): OpenApiParameter => ({
    name,
    in: "query",
    required,
    description,
    schema,
});

const jsonBody = (schema: OpenApiSchema, required = true): Record<string, unknown> => ({
    required,
    content: {
        "application/json": { schema },
    },
});

const multipartBody = (
    properties: Record<string, OpenApiSchema>,
    required: string[],
): Record<string, unknown> => ({
    required: true,
    content: {
        "multipart/form-data": {
            schema: {
                type: "object",
                properties,
                required,
            },
        },
    },
});

const successResponse = (schema: OpenApiSchema): Record<string, unknown> => ({
    description: "Operación exitosa.",
    content: {
        "application/json": {
            schema: {
                allOf: [
                    ref("SuccessResponse"),
                    {
                        type: "object",
                        properties: { data: schema },
                    },
                ],
            },
        },
    },
});

const errorResponse = (description: string, validation = false): Record<string, unknown> => ({
    description,
    content: {
        "application/json": {
            schema: ref(validation ? "ValidationErrorResponse" : "ErrorResponse"),
        },
    },
});

const operation = (
    tag: string,
    operationId: string,
    summary: string,
    options: OperationOptions = {},
): Record<string, unknown> => {
    const secured = options.secured ?? true;
    const status = options.status ?? 200;

    return {
        tags: [tag],
        operationId,
        summary,
        ...(options.description ? { description: options.description } : {}),
        ...(options.parameters ? { parameters: options.parameters } : {}),
        ...(options.body ? { requestBody: options.body } : {}),
        security: secured ? [{ cookieAuth: [] }, { bearerAuth: [] }] : [],
        responses: {
            [status]: options.rawResponse
                ? {
                    description: "Operación exitosa.",
                    content: {
                        "application/json": {
                            schema: options.responseSchema ?? {},
                        },
                    },
                }
                : successResponse(options.responseSchema ?? {}),
            "400": errorResponse("Solicitud inválida o datos que no superan la validación.", true),
            ...(secured ? {
                "401": errorResponse("No autenticado o token inválido."),
                "403": errorResponse("El usuario no tiene permiso para realizar la operación."),
            } : {}),
            "404": errorResponse("El recurso solicitado no existe."),
            "409": errorResponse("La operación entra en conflicto con el estado actual."),
            "429": errorResponse("Se excedió el límite de solicitudes."),
            "500": errorResponse("Error interno del servidor."),
        },
    };
};

const id = { type: "integer", minimum: 1 };
const dateTime = { type: "string", format: "date-time" };
const publicationType = { type: "string", enum: ["material", "tutoria", "negocio"] };
const publicationState = {
    type: "string",
    enum: ["disponible", "vendido", "reservado", "activo", "inactivo"],
};
const agreementState = {
    type: "string",
    enum: ["activo", "pendiente", "completado", "cancelado"],
};
const imageFile = {
    type: "string",
    format: "binary",
    description: "Imagen JPG, PNG o WEBP de hasta 5 MB.",
};
const pdfFile = {
    type: "string",
    format: "binary",
    contentMediaType: "application/pdf",
    description: "Documento PDF de hasta 10 MB.",
};

const schemas: Record<string, OpenApiSchema> = {
    SuccessResponse: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
            success: { type: "boolean", const: true },
            message: { type: "string" },
            data: {},
        },
    },
    ErrorResponse: {
        type: "object",
        required: ["success", "message"],
        properties: {
            success: { type: "boolean", const: false },
            message: { type: "string" },
        },
    },
    ValidationErrorResponse: {
        type: "object",
        required: ["success", "message"],
        properties: {
            success: { type: "boolean", const: false },
            message: { type: "string" },
            errores: {
                type: "array",
                items: {
                    type: "object",
                    required: ["campo", "mensaje"],
                    properties: {
                        campo: { type: "string" },
                        mensaje: { type: "string" },
                    },
                },
            },
        },
    },
    Usuario: {
        type: "object",
        properties: {
            id_usuario: id,
            nombre: { type: "string", maxLength: 100 },
            carnet: { type: "integer" },
            email_institucional: { type: "string", format: "email" },
            url_foto_perfil: { type: "string", format: "uri" },
            descripcion: { type: ["string", "null"], maxLength: 500 },
            calificacion: { type: ["number", "null"], minimum: 0, maximum: 5 },
            total_resenas: { type: "integer", minimum: 0 },
        },
    },
    Etiqueta: {
        type: "object",
        properties: {
            id_etiqueta: id,
            nombre: { type: "string" },
            descripcion: { type: "string" },
            id_etiqueta_padre: { type: ["integer", "null"] },
        },
    },
    Estado: {
        type: "object",
        properties: {
            id_estado: id,
            estado: { type: "string" },
        },
    },
    Publicacion: {
        type: "object",
        properties: {
            id_publicacion: id,
            titulo: { type: "string" },
            descripcion: { type: "string" },
            precio: { type: ["number", "string"], minimum: 0 },
            estado: { oneOf: [id, ref("Estado")] },
            tipo_publicacion: { oneOf: [id, publicationType] },
            me_gusta: { type: "integer", minimum: 0 },
            fecha_publicacion: dateTime,
            id_usuario: id,
            is_pinned: { type: "boolean" },
            imagenes: {
                type: "array",
                items: {
                    oneOf: [
                        { type: "string", format: "uri" },
                        {
                            type: "object",
                            properties: {
                                id_imagen: id,
                                url_imagen: { type: "string", format: "uri" },
                            },
                        },
                    ],
                },
            },
            etiquetas: arrayOf(ref("Etiqueta")),
            usuario: ref("Usuario"),
            score: { type: "number" },
            is_like: { type: "boolean" },
            is_save: { type: "boolean" },
        },
    },
    Acuerdo: {
        type: "object",
        properties: {
            id_acuerdo: id,
            id_usuario: id,
            id_publicacion: id,
            fecha_entrega: dateTime,
            lugar_entrega: { type: "string" },
            observaciones: { type: "string" },
            id_conversacion: id,
            estado: { oneOf: [id, ref("Estado")] },
            publicacion: ref("Publicacion"),
            usuario: ref("Usuario"),
        },
    },
    Contacto: {
        type: "object",
        properties: {
            id_contacto: id,
            tipo_contacto: id,
            valor: { type: "string" },
        },
    },
    Horario: {
        type: "object",
        properties: {
            id_tiempo: id,
            dia: {
                type: "string",
                enum: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"],
            },
            hora_inicio: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
            hora_fin: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
        },
    },
    Anuncio: {
        type: "object",
        properties: {
            id_anuncio: id,
            titulo: { type: "string" },
            imagen_url: { type: "string", format: "uri" },
            descripcion: { type: "string" },
            id_usuario: id,
            fecha_anuncio: dateTime,
        },
    },
    Certificacion: {
        type: "object",
        properties: {
            id_certificacion: id,
            id_usuario: id,
            nombre: { type: "string" },
            ruta_pdf: { type: "string", format: "uri" },
            lugar_emision: { type: "string" },
            id_etiqueta: id,
            etiqueta: ref("Etiqueta"),
        },
    },
    Resena: {
        type: "object",
        properties: {
            id_resena: id,
            contenido: { type: "string" },
            calificacion: { type: "integer", minimum: 1, maximum: 5 },
            me_gusta: { type: "integer", minimum: 0 },
            id_emisor: id,
            id_receptor: id,
            id_tipo_resena: id,
            fecha_resena: dateTime,
            emisor: ref("Usuario"),
        },
    },
    Notificacion: {
        type: "object",
        properties: {
            id_notificacion: id,
            mensaje: { type: "string" },
            id_usuario: id,
            id_estado: id,
            fecha: dateTime,
            estado: ref("Estado"),
        },
    },
};

const email = { type: "string", format: "email" };
const password = {
    type: "string",
    format: "password",
    minLength: 8,
    pattern: "^(?=.*[A-Z])(?=.*[0-9]).+$",
};
const paginationProperties = {
    page: { type: "integer", minimum: 1, default: 1 },
    limit: { type: "integer", minimum: 1, default: 10 },
    sort: { type: "string", enum: ["fecha", "calificacion", "precio", "me_gusta"], default: "fecha" },
    order: { type: "string", enum: ["asc", "desc"], default: "desc" },
    tipo: publicationType,
};
const filterProperties = {
    ...paginationProperties,
    precio_min: { type: "number", minimum: 0, default: 0 },
    precio_max: { type: "number", minimum: 0, default: 999.99 },
    calificacion_min: { type: "number", minimum: 0, maximum: 5, default: 0 },
    calificacion_max: { type: "number", minimum: 0, maximum: 5, default: 5 },
    etiquetas: arrayOf(id),
};
const reviewCreateSchema: OpenApiSchema = {
    type: "object",
    required: ["id_receptor", "tipo_resena", "calificacion", "contenido"],
    properties: {
        id_receptor: id,
        tipo_resena: { type: "string", minLength: 3, maxLength: 25 },
        calificacion: { type: "integer", minimum: 1, maximum: 5 },
        contenido: { type: "string", minLength: 10, maxLength: 500 },
    },
};

const paths: Record<string, Record<string, unknown>> = {
    "/health": {
        get: operation("Sistema", "getHealth", "Comprobar el estado de la API", {
            secured: false,
            rawResponse: true,
            responseSchema: {
                type: "object",
                required: ["status"],
                properties: { status: { type: "string", const: "ok" } },
            },
        }),
    },
    "/auth/send-register-code": {
        post: operation("Autenticación", "sendRegisterCode", "Enviar código de verificación de registro", {
            secured: false,
            body: jsonBody({
                type: "object",
                required: ["email_institucional", "carnet"],
                properties: {
                    email_institucional: { ...email, pattern: "@uvg\\.edu\\.gt$" },
                    carnet: { type: "integer", minimum: 10000, maximum: 99999999 },
                },
            }),
            responseSchema: arrayOf({}),
        }),
    },
    "/auth/register": {
        post: operation("Autenticación", "register", "Registrar un usuario", {
            secured: false,
            description: "Crea la cuenta y establece la cookie HTTP-only `swap-token`.",
            status: 201,
            body: jsonBody({
                type: "object",
                required: ["nombre", "carnet", "email_institucional", "password", "codigo_verificacion"],
                properties: {
                    nombre: { type: "string", minLength: 2, maxLength: 100 },
                    carnet: { type: "integer", minimum: 10000, maximum: 99999999 },
                    email_institucional: { ...email, pattern: "@uvg\\.edu\\.gt$" },
                    password,
                    descripcion: { type: ["string", "null"], maxLength: 500 },
                    etiquetas: { ...arrayOf(id), minItems: 1, maxItems: 10 },
                    codigo_verificacion: { type: "string", pattern: "^\\d{6}$" },
                },
            }),
            responseSchema: {
                type: "object",
                properties: { rol: { type: "string" }, usuario: ref("Usuario") },
            },
        }),
    },
    "/auth/login": {
        post: operation("Autenticación", "login", "Iniciar sesión", {
            secured: false,
            description: "Valida las credenciales y establece la cookie HTTP-only `swap-token`.",
            body: jsonBody({
                type: "object",
                required: ["email_institucional", "password"],
                properties: { email_institucional: email, password: { type: "string", format: "password" } },
            }),
            responseSchema: {
                type: "object",
                properties: { rol: { type: "string" }, usuario: ref("Usuario") },
            },
        }),
    },
    "/auth/forgot-password": {
        post: operation("Autenticación", "forgotPassword", "Solicitar recuperación de contraseña", {
            secured: false,
            body: jsonBody({
                type: "object",
                required: ["email"],
                properties: { email },
            }),
            responseSchema: arrayOf({}),
        }),
    },
    "/auth/verify-reset-code": {
        post: operation("Autenticación", "verifyResetCode", "Verificar código de recuperación", {
            secured: false,
            body: jsonBody({
                type: "object",
                required: ["email", "code"],
                properties: { email, code: { type: "string", pattern: "^\\d{6}$" } },
            }),
            responseSchema: arrayOf({}),
        }),
    },
    "/auth/reset-password": {
        post: operation("Autenticación", "resetPassword", "Restablecer contraseña", {
            secured: false,
            body: jsonBody({
                type: "object",
                required: ["email", "code", "newPassword"],
                properties: {
                    email,
                    code: { type: "string", pattern: "^\\d{6}$" },
                    newPassword: password,
                },
            }),
            responseSchema: arrayOf({}),
        }),
    },
    "/auth/me": {
        get: operation("Autenticación", "getCurrentSession", "Obtener la sesión actual", {
            responseSchema: {
                type: "object",
                properties: { rol: { type: "string" }, usuario: ref("Usuario") },
            },
        }),
    },
    "/auth/logout": {
        post: operation("Autenticación", "logout", "Cerrar sesión", {
            secured: false,
            description: "Elimina la cookie `swap-token`.",
            responseSchema: arrayOf({}),
        }),
    },
    "/user/{id}/perfil-publico": {
        get: operation("Usuarios", "getPublicProfile", "Obtener el perfil público de un usuario", {
            secured: false,
            parameters: [pathId("id", "ID del usuario.")],
            responseSchema: ref("Usuario"),
        }),
    },
    "/user/{id}": {
        get: operation("Usuarios", "getUser", "Obtener un usuario y sus publicaciones", {
            parameters: [pathId("id", "ID del usuario.")],
            responseSchema: ref("Usuario"),
        }),
        patch: operation("Usuarios", "updateUser", "Actualizar el perfil de un usuario", {
            parameters: [pathId("id", "ID del usuario propietario.")],
            body: jsonBody({
                type: "object",
                minProperties: 1,
                properties: {
                    nombre: { type: "string", minLength: 2, maxLength: 100 },
                    url_foto_perfil: { type: "string", format: "uri" },
                    descripcion: { type: ["string", "null"], maxLength: 500 },
                },
            }),
            responseSchema: ref("Usuario"),
        }),
    },
    "/user/{id}/contactos": {
        get: operation("Usuarios", "getUserContacts", "Obtener los contactos de un usuario", {
            parameters: [pathId("id", "ID del usuario.")],
            responseSchema: arrayOf(ref("Contacto")),
        }),
        put: operation("Usuarios", "replaceUserContacts", "Reemplazar los contactos de un usuario", {
            parameters: [pathId("id", "ID del usuario propietario.")],
            body: jsonBody({
                type: "object",
                required: ["contactos"],
                properties: {
                    contactos: {
                        oneOf: [
                            ref("Contacto"),
                            { ...arrayOf(ref("Contacto")), minItems: 1, maxItems: 4 },
                        ],
                    },
                },
            }),
            responseSchema: arrayOf(ref("Contacto")),
        }),
    },
    "/user/tutores/buscar": {
        post: operation("Usuarios", "searchTutors", "Buscar tutores mediante filtros", {
            body: jsonBody({
                type: "object",
                properties: {
                    ...filterProperties,
                    dias: {
                        type: "array",
                        items: {
                            type: "string",
                            enum: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"],
                        },
                    },
                    hora_inicio: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
                    hora_final: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
                },
            }),
            responseSchema: {
                type: "object",
                properties: {
                    tutores: arrayOf(ref("Usuario")),
                    total: { type: "integer" },
                    page: { type: "integer" },
                    limit: { type: "integer" },
                },
            },
        }),
    },
    "/publicacion": {
        get: operation("Publicaciones", "listPublications", "Listar publicaciones", {
            parameters: [
                query("page", "Página solicitada.", { type: "integer", minimum: 1, default: 1 }),
                query("limit", "Resultados por página (máximo 100).", { type: "integer", minimum: 1, maximum: 100, default: 10 }),
                query("sort", "Campo de ordenamiento.", { type: "string", enum: ["fecha", "me_gusta", "precio"], default: "fecha" }),
                query("order", "Dirección del orden.", { type: "string", enum: ["asc", "desc"], default: "desc" }),
                query("tipo", "Tipo de publicación.", publicationType),
                query("all", "Incluir publicaciones no activas.", { type: "boolean", default: false }),
            ],
            responseSchema: {
                type: "object",
                properties: {
                    publicaciones: arrayOf(ref("Publicacion")),
                    total: { type: "integer" },
                },
            },
        }),
        post: operation("Publicaciones", "createPublication", "Crear una publicación", {
            status: 201,
            description: "Admite hasta cinco imágenes en el campo `imagenes`.",
            body: multipartBody({
                titulo: { type: "string", minLength: 3, maxLength: 100 },
                descripcion: { type: "string", minLength: 10, maxLength: 255 },
                precio: { type: "number", minimum: 0, default: 0 },
                tipo_publicacion: publicationType,
                estado: publicationState,
                destacar: { type: "boolean", default: false },
                imagenes: { type: "array", items: imageFile, maxItems: 5 },
            }, ["titulo", "descripcion", "tipo_publicacion"]),
            responseSchema: {
                type: "object",
                properties: {
                    id_publicacion: id,
                    imagenes: arrayOf({ type: "string", format: "uri" }),
                },
            },
        }),
    },
    "/publicacion/buscar": {
        post: operation("Publicaciones", "searchPublications", "Buscar publicaciones mediante filtros", {
            body: jsonBody({ type: "object", properties: filterProperties }),
            responseSchema: {
                type: "object",
                properties: {
                    publicaciones: arrayOf(ref("Publicacion")),
                    total: { type: "integer" },
                    page: { type: "integer" },
                    limit: { type: "integer" },
                },
            },
        }),
    },
    "/publicacion/user/{id}": {
        get: operation("Publicaciones", "getUserPublications", "Obtener publicaciones de un usuario", {
            parameters: [
                pathId("id", "ID del usuario."),
                query("tipo", "Tipo de publicación.", publicationType, true),
                query("all", "Incluir publicaciones no activas.", { type: "boolean", default: false }),
            ],
            responseSchema: arrayOf(ref("Publicacion")),
        }),
    },
    "/publicacion/{id}": {
        get: operation("Publicaciones", "getPublication", "Obtener una publicación por ID", {
            parameters: [pathId("id", "ID de la publicación.")],
            responseSchema: ref("Publicacion"),
        }),
        put: operation("Publicaciones", "updatePublication", "Editar una publicación", {
            parameters: [pathId("id", "ID de la publicación.")],
            description: "Solo el propietario puede editarla. `etiquetas` e `imagenesEliminar` se envían como arreglos JSON serializados.",
            body: multipartBody({
                titulo: { type: "string", minLength: 3, maxLength: 100 },
                descripcion: { type: "string", minLength: 10, maxLength: 255 },
                precio: { type: "number", minimum: 0, maximum: 999.99 },
                tipo_publicacion: publicationType,
                estado: publicationState,
                etiquetas: { type: "string", examples: ["[1,2,3]"] },
                imagenesEliminar: { type: "string", examples: ["[\"https://example.com/imagen.webp\"]"] },
                imagenes: { type: "array", items: imageFile, maxItems: 5 },
            }, []),
            responseSchema: {
                type: "object",
                properties: {
                    imagenes: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id_imagen: id,
                                url_imagen: { type: "string", format: "uri" },
                                id_publicacion: id,
                            },
                        },
                    },
                    urlsNuevas: arrayOf({ type: "string", format: "uri" }),
                },
            },
        }),
        delete: operation("Publicaciones", "deletePublication", "Eliminar una publicación y sus imágenes", {
            parameters: [pathId("id", "ID de la publicación.")],
            responseSchema: { type: "object" },
        }),
    },
    "/publicacion/{id}/estado": {
        patch: operation("Publicaciones", "updatePublicationState", "Cambiar el estado de una publicación", {
            parameters: [pathId("id", "ID de la publicación.")],
            body: jsonBody({
                type: "object",
                required: ["estado_id"],
                properties: {
                    estado_id: {
                        ...id,
                        description: "ID del estado `activo` o `inactivo`.",
                    },
                },
            }),
            responseSchema: {
                type: "object",
                properties: {
                    id_publicacion: id,
                    titulo: { type: "string" },
                    estado: id,
                    estado_nombre: { type: "string", enum: ["activo", "inactivo"] },
                },
            },
        }),
    },
    "/publicacion/{id}/destacar": {
        patch: operation("Publicaciones", "pinPublication", "Destacar o dejar de destacar una publicación", {
            parameters: [pathId("id", "ID de la publicación.")],
            body: jsonBody({
                type: "object",
                required: ["destacar"],
                properties: { destacar: { type: "boolean" } },
            }),
            responseSchema: ref("Publicacion"),
        }),
    },
    "/publicacion/destacadas/user/{id}": {
        get: operation("Publicaciones", "getPinnedUserPublications", "Obtener publicaciones destacadas de un usuario", {
            parameters: [pathId("id", "ID del usuario.")],
            responseSchema: arrayOf(ref("Publicacion")),
        }),
    },
    "/etiqueta": {
        get: operation("Etiquetas", "listTags", "Listar todas las etiquetas", {
            secured: false,
            responseSchema: arrayOf(ref("Etiqueta")),
        }),
    },
    "/etiqueta/user/{id}": {
        get: operation("Etiquetas", "getUserTags", "Obtener las etiquetas de un usuario", {
            parameters: [
                pathId("id", "ID del usuario."),
                query("padres", "Incluir la etiqueta padre.", { type: "boolean", default: false }),
            ],
            responseSchema: arrayOf(ref("Etiqueta")),
        }),
        post: operation("Etiquetas", "syncUserTags", "Sincronizar las etiquetas de un usuario", {
            parameters: [pathId("id", "ID del usuario propietario.")],
            body: jsonBody({
                type: "object",
                required: ["ids"],
                properties: { ids: { ...arrayOf(id), minItems: 1, maxItems: 20 } },
            }),
            responseSchema: arrayOf(ref("Etiqueta")),
        }),
    },
    "/etiqueta/publicacion/{id}": {
        get: operation("Etiquetas", "getPublicationTags", "Obtener las etiquetas de una publicación", {
            parameters: [
                pathId("id", "ID de la publicación."),
                query("padres", "Incluir la etiqueta padre.", { type: "boolean", default: false }),
            ],
            responseSchema: arrayOf(ref("Etiqueta")),
        }),
    },
    "/acuerdo/user/{id}": {
        get: operation("Acuerdos", "getUserAgreements", "Obtener los acuerdos de un usuario", {
            parameters: [
                pathId("id", "ID del usuario."),
                query("tipo", "Tipo del historial.", { type: "string", enum: ["producto", "material", "negocio", "tutoria"] }),
                query("estado", "Estado del acuerdo.", agreementState),
                query("q", "Texto para filtrar el historial."),
                query("agrupados", "Agrupar por publicación y usuario.", { type: "boolean", default: false }),
                query("page", "Página; debe enviarse junto con `limit`.", { type: "integer", minimum: 1 }),
                query("limit", "Tamaño de página; debe enviarse junto con `page`.", { type: "integer", minimum: 1 }),
            ],
            responseSchema: {
                oneOf: [
                    arrayOf(ref("Acuerdo")),
                    {
                        type: "object",
                        properties: {
                            data: arrayOf(ref("Acuerdo")),
                            total: { type: "integer" },
                            page: { type: "integer" },
                            limit: { type: "integer" },
                        },
                    },
                ],
            },
        }),
    },
    "/acuerdo/conversacion/{id}": {
        get: operation("Acuerdos", "getConversationAgreements", "Obtener acuerdos de una conversación", {
            parameters: [pathId("id", "ID de la conversación.")],
            responseSchema: arrayOf(ref("Acuerdo")),
        }),
    },
    "/acuerdo/{id}": {
        post: operation("Acuerdos", "createAgreement", "Crear una solicitud de acuerdo", {
            parameters: [pathId("id", "ID de la publicación.")],
            status: 201,
            body: jsonBody({
                type: "object",
                required: ["fecha_entrega", "lugar_entrega", "observaciones", "id_conversacion"],
                properties: {
                    fecha_entrega: dateTime,
                    lugar_entrega: { type: "string", minLength: 1 },
                    observaciones: { type: "string", minLength: 1 },
                    id_conversacion: id,
                },
            }),
            responseSchema: ref("Acuerdo"),
        }),
        put: operation("Acuerdos", "updateAgreementState", "Actualizar el estado de un acuerdo", {
            parameters: [pathId("id", "ID del acuerdo.")],
            body: jsonBody({
                type: "object",
                required: ["estado"],
                properties: { estado: agreementState },
            }),
            responseSchema: ref("Acuerdo"),
        }),
    },
    "/acuerdo/{id}/editar": {
        put: operation("Acuerdos", "updateAgreement", "Editar la entrega de un acuerdo", {
            parameters: [pathId("id", "ID del acuerdo.")],
            body: jsonBody({
                type: "object",
                required: ["fecha_entrega", "lugar_entrega", "observaciones"],
                properties: {
                    fecha_entrega: dateTime,
                    lugar_entrega: { type: "string", minLength: 1 },
                    observaciones: { type: "string", minLength: 1 },
                },
            }),
            responseSchema: ref("Acuerdo"),
        }),
    },
    "/conversacion/{id}/estado": {
        put: operation("Conversaciones", "updateConversationState", "Aceptar o bloquear una conversación", {
            parameters: [pathId("id", "ID de la conversación.")],
            body: jsonBody({
                type: "object",
                required: ["estado_id"],
                properties: { estado_id: id },
            }),
            responseSchema: {
                type: "object",
                properties: {
                    id_conversacion: id,
                    estado: id,
                    estado_nombre: { type: "string", enum: ["activo", "inactivo"] },
                },
            },
        }),
    },
    "/imagen/upload": {
        post: operation("Imágenes", "uploadImage", "Subir una imagen", {
            parameters: [query("carpeta", "Carpeta lógica de destino.", { type: "string", default: "general" })],
            status: 201,
            body: multipartBody({ imagen: imageFile }, ["imagen"]),
            responseSchema: { type: "string", format: "uri" },
        }),
    },
    "/imagen/perfil/{id}": {
        put: operation("Imágenes", "updateProfilePicture", "Subir o reemplazar la foto de perfil", {
            parameters: [pathId("id", "ID del usuario propietario.")],
            status: 201,
            body: multipartBody({ imagen: imageFile }, ["imagen"]),
            responseSchema: { type: "string", format: "uri" },
        }),
    },
    "/estado": {
        get: operation("Estados", "listStates", "Listar estados del sistema", {
            secured: false,
            parameters: [
                query("tipo", "Filtrar estados según el recurso.", {
                    type: "string",
                    enum: ["publicacion", "mensaje", "material", "acuerdo"],
                }),
            ],
            responseSchema: arrayOf(ref("Estado")),
        }),
    },
    "/recomendacion/globales/{tipo}": {
        get: operation("Recomendaciones", "getGlobalRecommendationsByType", "Obtener recomendaciones globales por tipo", {
            parameters: [{
                ...pathId("tipo", "Tipo de publicación."),
                schema: publicationType,
            }],
            responseSchema: arrayOf(ref("Publicacion")),
        }),
    },
    "/recomendacion/globales": {
        get: operation("Recomendaciones", "getGlobalRecommendations", "Obtener recomendaciones globales", {
            responseSchema: arrayOf(ref("Publicacion")),
        }),
    },
    "/recomendacion/tutores": {
        get: operation("Recomendaciones", "getTutorRecommendations", "Obtener tutores recomendados", {
            responseSchema: arrayOf(ref("Usuario")),
        }),
    },
    "/recomendacion/personalizadas": {
        get: operation("Recomendaciones", "getPersonalizedRecommendations", "Obtener recomendaciones personalizadas en caché", {
            responseSchema: arrayOf(ref("Publicacion")),
        }),
    },
    "/recomendacion/mias": {
        get: operation("Recomendaciones", "getExactRecommendations", "Calcular recomendaciones personales exactas", {
            responseSchema: arrayOf(ref("Publicacion")),
        }),
    },
    "/recomendacion/similares/{id}": {
        get: operation("Recomendaciones", "getSimilarPublications", "Obtener publicaciones similares", {
            parameters: [pathId("id", "ID de la publicación base.")],
            responseSchema: arrayOf(ref("Publicacion")),
        }),
    },
    "/recomendacion/evento": {
        post: operation("Recomendaciones", "registerRecommendationEvent", "Registrar una interacción con una publicación", {
            body: jsonBody({
                type: "object",
                required: ["id_publicacion", "tipo_evento"],
                properties: {
                    id_publicacion: id,
                    tipo_evento: {
                        type: "string",
                        enum: [
                            "VER_PUBLICACION",
                            "BUSCAR_ETIQUETA",
                            "VER_PERFIL",
                            "CONTACTAR_VENDEDOR",
                            "DEJAR_RESENA",
                            "AGENDAR_TUTORIA",
                            "COMPLETAR_COMPRA",
                            "LIKE_PUBLICACION",
                            "GUARDAR_PUBLICACION",
                        ],
                    },
                },
            }),
            responseSchema: { type: "null" },
        }),
    },
    "/recomendacion/favoritas": {
        post: operation("Recomendaciones", "addFavoriteTags", "Agregar etiquetas favoritas", {
            body: jsonBody({
                type: "object",
                required: ["ids_etiquetas"],
                properties: { ids_etiquetas: { ...arrayOf(id), minItems: 1 } },
            }),
            responseSchema: { type: "null" },
        }),
        delete: operation("Recomendaciones", "removeFavoriteTags", "Eliminar etiquetas favoritas", {
            body: jsonBody({
                type: "object",
                required: ["ids_etiquetas"],
                properties: { ids_etiquetas: { ...arrayOf(id), minItems: 1 } },
            }),
            responseSchema: { type: "null" },
        }),
    },
    "/guardados": {
        get: operation("Guardados", "listSavedPublications", "Obtener las publicaciones guardadas", {
            responseSchema: arrayOf(ref("Publicacion")),
        }),
    },
    "/guardados/{publicacionId}": {
        post: operation("Guardados", "savePublication", "Guardar una publicación", {
            parameters: [pathId("publicacionId", "ID de la publicación.")],
            responseSchema: ref("Publicacion"),
        }),
        delete: operation("Guardados", "removeSavedPublication", "Quitar una publicación de guardados", {
            parameters: [pathId("publicacionId", "ID de la publicación.")],
            responseSchema: ref("Publicacion"),
        }),
    },
    "/likes/{publicacionId}": {
        post: operation("Likes", "likePublication", "Dar like a una publicación", {
            parameters: [pathId("publicacionId", "ID de la publicación.")],
            responseSchema: ref("Publicacion"),
        }),
        delete: operation("Likes", "unlikePublication", "Quitar el like de una publicación", {
            parameters: [pathId("publicacionId", "ID de la publicación.")],
            responseSchema: ref("Publicacion"),
        }),
    },
    "/horarios/{usuarioId}": {
        get: operation("Horarios", "getUserSchedule", "Obtener el horario semanal de un usuario", {
            secured: false,
            parameters: [pathId("usuarioId", "ID del usuario.")],
            responseSchema: arrayOf(ref("Horario")),
        }),
        put: operation("Horarios", "replaceUserSchedule", "Reemplazar el horario semanal de un usuario", {
            parameters: [pathId("usuarioId", "ID del usuario propietario.")],
            body: jsonBody({
                type: "object",
                required: ["bloques"],
                properties: {
                    bloques: {
                        type: "array",
                        maxItems: 168,
                        items: {
                            type: "object",
                            required: ["dia", "hora_inicio", "hora_fin"],
                            properties: {
                                dia: {
                                    type: "string",
                                    enum: ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"],
                                },
                                hora_inicio: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
                                hora_fin: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
                            },
                        },
                    },
                },
            }),
            responseSchema: arrayOf(ref("Horario")),
        }),
    },
    "/anuncio": {
        get: operation("Anuncios", "listAds", "Listar anuncios", {
            parameters: [
                query("limit", "Cantidad máxima de resultados.", { type: "integer", minimum: 1, maximum: 100, default: 10 }),
                query("order", "Orden por fecha.", { type: "string", enum: ["asc", "desc"], default: "desc" }),
            ],
            responseSchema: arrayOf(ref("Anuncio")),
        }),
        post: operation("Anuncios", "createAd", "Crear un anuncio", {
            status: 201,
            body: multipartBody({
                titulo: { type: "string", minLength: 5, maxLength: 100 },
                descripcion: { type: "string", minLength: 10, maxLength: 1000 },
                imagen: imageFile,
            }, ["titulo", "descripcion"]),
            responseSchema: ref("Anuncio"),
        }),
    },
    "/anuncio/user/{id_usuario}": {
        get: operation("Anuncios", "getUserAds", "Obtener los anuncios de un usuario", {
            parameters: [pathId("id_usuario", "ID del usuario.")],
            responseSchema: arrayOf(ref("Anuncio")),
        }),
    },
    "/anuncio/{id_anuncio}": {
        put: operation("Anuncios", "updateAd", "Editar un anuncio", {
            parameters: [pathId("id_anuncio", "ID del anuncio.")],
            body: multipartBody({
                titulo: { type: "string", minLength: 5, maxLength: 100 },
                descripcion: { type: "string", minLength: 10, maxLength: 1000 },
                imagen: imageFile,
            }, []),
            responseSchema: ref("Anuncio"),
        }),
        delete: operation("Anuncios", "deleteAd", "Eliminar un anuncio", {
            parameters: [pathId("id_anuncio", "ID del anuncio.")],
            responseSchema: ref("Anuncio"),
        }),
    },
    "/busqueda": {
        get: operation("Búsqueda", "semanticSearch", "Buscar publicaciones semánticamente", {
            parameters: [
                query("q", "Texto de búsqueda.", { type: "string", minLength: 1 }, true),
                query("tipo", "Tipo de publicación.", publicationType),
            ],
            responseSchema: arrayOf(ref("Publicacion")),
        }),
    },
    "/certificacion": {
        post: operation("Certificaciones", "createCertification", "Crear una certificación", {
            status: 201,
            body: multipartBody({
                nombre: { type: "string", minLength: 3, maxLength: 100 },
                lugar_emision: { type: "string", minLength: 3, maxLength: 100 },
                id_etiqueta: id,
                pdf: pdfFile,
            }, ["nombre", "lugar_emision", "id_etiqueta", "pdf"]),
            responseSchema: ref("Certificacion"),
        }),
    },
    "/certificacion/user/{id_usuario}": {
        get: operation("Certificaciones", "getUserCertifications", "Obtener certificaciones de un usuario", {
            parameters: [pathId("id_usuario", "ID del usuario.")],
            responseSchema: arrayOf(ref("Certificacion")),
        }),
    },
    "/certificacion/{id}": {
        get: operation("Certificaciones", "getCertification", "Obtener una certificación por ID", {
            parameters: [pathId("id", "ID de la certificación.")],
            responseSchema: ref("Certificacion"),
        }),
        delete: operation("Certificaciones", "deleteCertification", "Eliminar una certificación", {
            parameters: [pathId("id", "ID de la certificación.")],
            responseSchema: { type: "object" },
        }),
    },
    "/notificacion": {
        get: operation("Notificaciones", "listNotifications", "Listar notificaciones del usuario autenticado", {
            responseSchema: arrayOf(ref("Notificacion")),
        }),
    },
    "/notificacion/{id}/estado": {
        patch: operation("Notificaciones", "updateNotificationState", "Cambiar el estado de una notificación", {
            parameters: [pathId("id", "ID de la notificación.")],
            body: jsonBody({
                type: "object",
                required: ["estado"],
                properties: { estado: { type: "string", enum: ["leido", "enviado"] } },
            }),
            responseSchema: ref("Notificacion"),
        }),
    },
    "/resenas": {
        post: operation("Reseñas", "createReview", "Crear una reseña", {
            status: 201,
            body: jsonBody(reviewCreateSchema),
            responseSchema: ref("Resena"),
        }),
    },
    "/resenas/{id_resena}": {
        put: operation("Reseñas", "updateReview", "Editar una reseña propia", {
            parameters: [pathId("id_resena", "ID de la reseña.")],
            body: jsonBody({
                type: "object",
                required: ["calificacion", "contenido"],
                properties: {
                    calificacion: { type: "integer", minimum: 1, maximum: 5 },
                    contenido: { type: "string", minLength: 10, maxLength: 500 },
                },
            }),
            responseSchema: ref("Resena"),
        }),
    },
    "/resenas/usuario/{id_usuario}": {
        get: operation("Reseñas", "getUserReviews", "Obtener reseñas de un perfil", {
            secured: false,
            parameters: [
                pathId("id_usuario", "ID del usuario."),
                query("tipo", "Tipo de reseña.", { type: "string" }, true),
            ],
            responseSchema: arrayOf(ref("Resena")),
        }),
    },
};

const tags = [
    ["Sistema", "Disponibilidad y diagnóstico del servicio."],
    ["Autenticación", "Registro, sesión y recuperación de contraseña."],
    ["Usuarios", "Perfiles, contactos y búsqueda de tutores."],
    ["Publicaciones", "Materiales, tutorías y negocios publicados."],
    ["Etiquetas", "Catálogo e intereses académicos."],
    ["Acuerdos", "Solicitudes e historial de acuerdos entre usuarios."],
    ["Conversaciones", "Estado de solicitudes de conversación."],
    ["Imágenes", "Carga de imágenes y fotografías de perfil."],
    ["Estados", "Catálogo de estados del dominio."],
    ["Recomendaciones", "Recomendaciones e interacciones del usuario."],
    ["Guardados", "Publicaciones guardadas."],
    ["Likes", "Reacciones a publicaciones."],
    ["Horarios", "Disponibilidad semanal de tutores."],
    ["Anuncios", "Anuncios de los usuarios."],
    ["Búsqueda", "Búsqueda semántica de publicaciones."],
    ["Certificaciones", "Certificaciones y documentos PDF."],
    ["Notificaciones", "Notificaciones del usuario."],
    ["Reseñas", "Calificaciones y reputación de perfiles."],
].map(([name, description]) => ({ name, description }));

export const openApiDocument = {
    openapi: "3.2.0",
    jsonSchemaDialect: "https://spec.openapis.org/oas/3.1/dialect/base",
    info: {
        title: "Swap Backend API",
        version: "1.0.0",
        summary: "API REST de la plataforma Swap.",
        description: [
            "API para tutorías, intercambio de material académico y servicios entre estudiantes.",
            "",
            "La autenticación acepta la cookie HTTP-only `swap-token` o el encabezado `Authorization: Bearer <JWT>`.",
            "Desde **Authorize** se puede ingresar un JWT para ejecutar operaciones protegidas.",
        ].join("\n"),
    },
    servers: [
        {
            url: "/api",
            description: "Servidor actual",
        },
    ],
    tags,
    paths,
    components: {
        securitySchemes: {
            cookieAuth: {
                type: "apiKey",
                in: "cookie",
                name: "swap-token",
                description: "Cookie HTTP-only establecida por registro o inicio de sesión.",
            },
            bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
                description: "JWT sin el prefijo `Bearer` en el cuadro de autorización.",
            },
        },
        schemas,
    },
} as const;
