# Arquitectura Integral del Servicio de Moderación y Política Fail-Closed

## 1. Visión General y Marco de Seguridad

El backend de **SWAP** implementa un pipeline multicapa de moderación de contenido para proteger a la comunidad universitaria frente a contenido explícito, fraudes, suplantación y materiales no permitidos.

Siguiendo las directrices de **OWASP Top 10:2025 (A10: Moderación que falla en modo abierto)**, la plataforma aplica el principio de **Fail-Closed**: ante la caída o indisponibilidad de proveedores externos de IA, el contenido nunca se aprueba automáticamente; se retiene para inspección humana por moderadores autorizados.

---

## 2. Moderación de Texto (Publicaciones y Mensajes)

La moderación textual combina un filtro local determinista de coste cero con un modelo de lenguaje de clasificación semántica:

```
Texto del Usuario 
      │
      ▼
┌────────────────────────┐
│  Filtro Local de BD    │──[Coincidencia]──> Rechazo Inmediato (422)
│ (Palabra_Restringida)  │
└────────────────────────┘
      │ [Limpio]
      ▼
┌────────────────────────┐
│ OpenAI Moderation API  │──[Violación >= Umbral]──> Rechazo Inmediato (422)
│  (/v1/moderations)     │
└────────────────────────┘
      │ [Fallo de API / Timeout]
      ▼
 Enrutamiento Fail-Closed a Estado 'Pendiente' (Revisión Manual)
```

1. **Pre-filtro en PostgreSQL (`Palabra_Restringida`):**
   - Evalúa palabras o expresiones no permitidas en base de datos de forma instantánea y sin consumo de cuota externa.
   - Implementado en `src/servicios/servicioModeracionTexto.ts`.
2. **OpenAI Moderation API:**
   - Analiza categorías de odio, acoso, autolesión, contenido sexual y violencia.
   - Configurable mediante la variable de entorno `MODERATION_UMBRAL` (predeterminado `0.5`).

---

## 3. Moderación de Imágenes

La moderación visual analiza los archivos binarios subidos por los usuarios antes y durante su almacenamiento en Cloudflare R2:

1. **AWS Rekognition (`DetectModerationLabels`):**
   - Analiza buffers de imagen extrayendo etiquetas de confianza (`Confidence`).
   - Implementado en `src/servicios/servicioModeracionImagen.ts`.
2. **Umbrales por Categoría Sensible:**
   - `Explicit Nudity`: 50%
   - `Non-Explicit Nudity`: 80%
   - `Violence`: 70%
   - `Drugs`: 90%
   - `Hate Symbols`: 70%
   - `Visually Disturbing`: 60%
3. **Resiliencia y Reintentos:**
   - Manejo automático de límites de concurrencia (`ProvisionedThroughputExceededException`) con backoff y reintento único.
4. **Moderación Asíncrona en Background (`servicioModerarImagenesBackground.ts`):**
   - Tras la subida, se confirma la integridad de las imágenes. Si alguna imagen infringe las normas, se elimina automáticamente de R2 y de la base de datos, notificando al usuario.

---

## 4. Moderación de Certificaciones Académicas (PDFs)

Las certificaciones universitarias subidas para validar tutorías o insignias requieren validación estructural y visual profunda:

1. **Inspección AST del Documento (`pdf-lib`):**
   - Verificación de magic bytes `%PDF-`.
   - Detección y rechazo de JavaScript incrustado (`/JS`, `/JavaScript`), acciones automáticas al abrir (`/OpenAction`, `/AA`), enlaces externos interactivos (`/URI`, `/Launch`) y archivos adjuntos (`/EmbeddedFiles`).
   - Rechazo de documentos cifrados o protegidos por contraseña.
2. **Extracción y Moderación Cruzada:**
   - Extracción de texto estructurado y validación con `analizarTexto`.
   - Renderizado de páginas a imágenes con `pdf-to-img` y evaluación visual con `analizarImagen`.
3. **Pool de Concurrencia en Memoria (`PoolModeracionCertificaciones`):**
   - Limita a 3 tareas simultáneas para proteger CPU y límites de tasa (TPS) de AWS Rekognition y OpenAI.
   - Deduplicación en memoria para evitar procesamientos duplicados concurrentes.

---

## 5. Política Fail-Closed ante Caída de Proveedores (SWAP-603)

### El Problema (Fail-Open vs. Fail-Closed)
* **Fail-Open (Inseguro):** Si OpenAI o AWS caen o dan timeout, dejar pasar la publicación permite que atacantes saturen el servicio para colar contenido ilegal o malicioso.
* **Fail-Closed (Seguro — Implementado):** Ante la caída de un proveedor, el contenido **se retiene**.

### Comportamiento del Sistema

1. **Captura del Error:**
   - En `middlewareModeracion.ts`, los bloques `catch` capturan la excepción del proveedor.
   - En lugar de devolver un error 503 impidiendo la acción, se asigna `req.moderacionPendiente = true` y se registra el evento operativo.
2. **Registro del Evento de Observabilidad:**
   ```typescript
   escribirLog("warn", "moderation.provider_failed", {
       requestId: req.requestId,
       providerType: "text" | "image",
       route: req.originalUrl,
       error,
   });
   ```
   Este evento alimenta automáticamente el evaluador de alertas en Redis (`docs/alertas-seguridad.md`).
3. **Persistencia en Estado `pendiente`:**
   - El servicio `crearPublicacion` o `editarPublicacion` guarda el registro con `estado: 'pendiente'`.
4. **Aislamiento Público:**
   - Los endpoints públicos (`GET /api/v1/publicacion`) filtran exclusivamente publicaciones en estado `activo`. La publicación queda invisible a compradores y usuarios generales.
5. **Respuesta Informativa al Usuario:**
   - Código HTTP `201 Created` (o `200 OK` en edición).
   - Mensaje claro: *"Tu contenido está en revisión manual antes de publicarse debido a una verificación de seguridad."*
6. **Bandeja de Moderación:**
   - El moderador consulta `GET /api/v1/moderador/publicaciones?estado=pendiente`.
   - Si el contenido es legítimo, el moderador lo aprueba con `PATCH /api/v1/moderador/publicaciones/:id/reactivar`, pasando el estado a `activo` y notificando al autor.
   - Si no es legítimo, se descarta o elimina con `bajarPublicacionModeracion` o `eliminarPublicacionModeracion`.
