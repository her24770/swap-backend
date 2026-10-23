# Catálogo de logs y eventos de auditoría

La API escribe una línea JSON por evento. Los campos HTTP comunes son `level`,
`timestamp`, `event`, `requestId`, `userId`, `userRole`, `ip`, `method`,
`route`, `statusCode`, `result` y `durationMs`. `requestId` también se devuelve
en `X-Request-ID` para correlacionar una respuesta con sus logs.

Nunca se registra el cuerpo completo de una petición. El logger redacta además
campos llamados `password`, `newPassword`, `token`, `authorization`, `cookie`,
`code`, `codigo_verificacion`, variantes de token/contraseña y secretos. Los
errores se reducen a nombre y código; no se serializan mensajes ni stacks que
puedan contener datos del proveedor.

## Eventos auditados

| Evento | Acción | Resultado |
|---|---|---|
| `auth.login` | Inicio de sesión de usuario | `success`, `failure` o `blocked` |
| `auth.moderator_login` | Inicio de sesión de moderador | `success`, `failure` o `blocked` |
| `auth.password_recovery_requested` | Solicitud de código de recuperación | `success`, `failure` o `blocked` |
| `auth.password_recovery_code_checked` | Verificación del código | `success`, `failure` o `blocked` |
| `auth.password_reset` | Restablecimiento de contraseña | `success`, `failure` o `blocked` |
| `role.moderator_created` | Alta de moderador/rol | `success`, `failure` o `blocked` |
| `role.moderator_changed` | Cambio de rol o credenciales de moderador | `success`, `failure` o `blocked` |
| `role.moderator_deleted` | Eliminación de moderador/rol | `success`, `failure` o `blocked` |
| `agreement.post` | Creación de acuerdo | `success`, `failure` o `blocked` |
| `agreement.put` | Edición o reemplazo de acuerdo | `success`, `failure` o `blocked` |
| `agreement.patch` | Cambio de estado de acuerdo | `success`, `failure` o `blocked` |
| `agreement.delete` | Eliminación de acuerdo, si se habilita | `success`, `failure` o `blocked` |
| `moderation.post/put/patch/delete` | Acción mutante bajo moderación o reportes | `success`, `failure` o `blocked` |

## Eventos operativos de seguridad

| Evento | Uso |
|---|---|
| `http.request_completed` | Tráfico, latencia y respuestas 4xx/5xx |
| `http.unhandled_error` | Excepción no controlada |
| `security.rate_limit.blocked` | Solicitud rechazada con HTTP 429 |
| `security.rate_limiter_unavailable` | Redis no permitió evaluar la cuota |
| `moderation.provider_failed` | Fallo del proveedor de moderación de texto o imagen |

Los logs deben enviarse por `stdout` al recolector del servidor. El acceso y la
retención deben restringirse porque IP y `userId` son datos de auditoría.
