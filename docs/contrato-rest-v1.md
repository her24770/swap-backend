# Contrato REST v1

## Decisiones del spike SP-02

La URL canónica es `/api/v1`. El prefijo `/api` continúa funcionando como alias
de compatibilidad durante la versión mayor 1. Todas las respuestas incluyen
`X-API-Version: 1`.

### Semántica e idempotencia

| Verbo | Uso acordado | Idempotencia |
| --- | --- | --- |
| `GET` | Consultar sin modificar estado | Sí, seguro e idempotente |
| `POST` | Crear recursos, comandos o búsquedas complejas | No, salvo garantía explícita |
| `PUT` | Reemplazar toda la representación editable | Sí respecto al estado final |
| `PATCH` | Modificar campos o ejecutar transiciones de estado | Solo si la asignación documentada produce el mismo estado final |
| `DELETE` | Eliminar un recurso | Sí respecto al estado final; una repetición puede responder `404` |

No existe todavía soporte general para `Idempotency-Key` en operaciones `POST`.
Los clientes no deben reintentar automáticamente un POST después de un timeout
sin reconciliar antes el estado del recurso.

La excepción documentada es `POST /conversacion`: mientras la solicitud sigue
pendiente, repetir exactamente destinatario y primer mensaje devuelve el recurso
ya confirmado sin crear otro mensaje. Un contenido diferente responde `409`.

### Correcciones de verbos

| Operación canónica | Compatibilidad temporal |
| --- | --- |
| `PATCH /publicacion/:id` | `PUT /publicacion/:id` |
| `PATCH /anuncio/:id_anuncio` | `PUT /anuncio/:id_anuncio` |
| `PATCH /conversacion/:id/estado` | `PUT /conversacion/:id/estado` |
| `PATCH /acuerdo/:id/estado` | `PUT /acuerdo/:id` |
| `PUT /acuerdo/:id/detalle` | `PUT /acuerdo/:id/editar` |
| `PATCH /reportes/:id/estado` | `PUT /reportes/:id` |

Los aliases heredados incluyen `Deprecation: true`, `Warning: 299` y un enlace a
su reemplazo. OpenAPI también los marca como `deprecated`. Los `PUT` de horario,
contactos, fotografía y reseña permanecen porque reciben una representación
completa o reemplazan completamente el subrecurso.

En reportes, el ID de la ruta es ahora autoritativo. El alias permite
`id_reporte` en el body solo por compatibilidad y rechaza un valor diferente al
path; antes podía actualizarse un reporte distinto al indicado por la URL.

## Resultado del spike SP-03

La falla no estaba en la navegación. El backend confirmaba por separado:

1. conversación pendiente;
2. contexto de publicación;
3. primer mensaje;
4. notificación;
5. eventos Socket.IO.

Una excepción en los pasos 2–4 dejaba datos parciales. Un reintento encontraba la
conversación pendiente, ya no la consideraba nueva y rechazaba el mensaje. Una
excepción de socket también podía transformar un commit exitoso en un `500`.

Ahora los pasos 1–4 se ejecutan en una transacción Prisma. Los eventos solo se
emiten después del commit y un fallo de Socket.IO no cambia la respuesta HTTP.
`conversacion:actualizada` se envía a las salas personales del emisor y receptor,
por lo que ambas listas se actualizan. Las conversaciones pendientes vacías
dejadas por versiones anteriores pueden recuperar su primer mensaje mediante un
reintento del emisor original. Un reintento idéntico posterior al commit devuelve
la conversación y el primer mensaje existentes con `200`; no crea un duplicado.
