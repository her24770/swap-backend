# Límites de operaciones costosas

Además del límite global por IP, las siguientes operaciones consumen una cuota
por `id_usuario`. Los contadores viven en Redis y funcionan entre varias
instancias de la API.

| Bucket | Rutas | Límite |
|---|---|---:|
| `publicacion_moderada` | Crear o editar una publicación | 10 cada 15 minutos |
| `subida_imagen_moderada` | Subir una imagen o cambiar foto de perfil | 20 cada 15 minutos |
| `subida_certificacion` | Subir una certificación | 3 cada 60 minutos |
| `creacion_reporte` | Crear un reporte, con o sin evidencias | 10 cada 60 minutos |

El middleware se ejecuta después de autenticar al usuario y antes de procesar
archivos o invocar OpenAI, Rekognition y almacenamiento externo. Al superar el
límite responde `429` con `Retry-After`; si Redis no está disponible responde
`503` y no continúa hacia el proveedor.

Los límites de creación y edición de publicaciones comparten bucket porque
ambas acciones moderan texto y, cuando existen archivos, también imágenes.
