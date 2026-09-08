# Matriz trazable de endpoints

> Archivo generado por `npm run endpoints:inventory`. No editar manualmente.

- Rutas Express inventariadas: **100**
- Endpoints con política esperada explícita: **100/100**
- Endpoints conformes en rol y middleware de propietario: **100/100**
- Rutas documentadas en OpenAPI: **100/100**
- Rutas con al menos una invocación HTTP localizada: **97/100**

La política esperada es manual e independiente de los routers. `Propiedad esperada` indica si el alcance se obtiene de la sesión, se compara con un parámetro, se valida contra el recurso o exige ser participante. La conformidad automática contrasta rol y presencia de `verificarPropietario` cuando corresponde; las validaciones de recurso/participante se cubren en pruebas de dominio.

| ID | Método | Ruta Express | Rol esperado | Rol implementado | Propiedad esperada | Conforme | OpenAPI | Prueba HTTP localizada |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EP-001 | GET | `/acuerdo` | usuario | usuario | sesión propia | ✅ | `getUserAgreements` | `historial-guardados.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-002 | POST | `/acuerdo/:id` | usuario | usuario | sesión propia | ✅ | `createAgreement` | `mensajeria-coordinacion-real.test.ts`, `mensajeria-coordinacion.test.ts`, `moderacion-seguridad-real.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-003 | PUT | `/acuerdo/:id` | usuario | usuario | participante del recurso | ✅ | `updateAgreementStateLegacy` | `autorizacion-endpoints.test.ts` |
| EP-004 | PUT | `/acuerdo/:id/detalle` | usuario | usuario | participante del recurso | ✅ | `replaceAgreementDetails` | `autorizacion-endpoints.test.ts` |
| EP-005 | PUT | `/acuerdo/:id/editar` | usuario | usuario | participante del recurso | ✅ | `updateAgreementLegacy` | `autorizacion-endpoints.test.ts` |
| EP-006 | PATCH | `/acuerdo/:id/estado` | usuario | usuario | participante del recurso | ✅ | `updateAgreementState` | `autorizacion-endpoints.test.ts` |
| EP-007 | GET | `/acuerdo/conversacion/:id` | usuario | usuario | participante del recurso | ✅ | `getConversationAgreements` | `mensajeria-coordinacion-real.test.ts`, `mensajeria-coordinacion.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-008 | GET | `/anuncio` | autenticado | autenticado | no aplica | ✅ | `listAds` | `autorizacion-endpoints.test.ts` |
| EP-009 | POST | `/anuncio` | usuario | usuario | sesión propia | ✅ | `createAd` | `autorizacion-endpoints.test.ts` |
| EP-010 | DELETE | `/anuncio/:id_anuncio` | usuario | usuario | propietario del recurso | ✅ | `deleteAd` | `autorizacion-endpoints.test.ts` |
| EP-011 | PATCH | `/anuncio/:id_anuncio` | usuario | usuario | propietario del recurso | ✅ | `updateAd` | `autorizacion-endpoints.test.ts` |
| EP-012 | PUT | `/anuncio/:id_anuncio` | usuario | usuario | propietario del recurso | ✅ | `updateAdLegacy` | `autorizacion-endpoints.test.ts` |
| EP-013 | GET | `/anuncio/user/:id_usuario` | autenticado | autenticado | no aplica | ✅ | `getUserAds` | `autorizacion-endpoints.test.ts` |
| EP-014 | POST | `/auth/forgot-password` | público | público | no aplica | ✅ | `forgotPassword` | `autenticacion-perfiles.test.ts`, `auth-sesion.test.ts` |
| EP-015 | POST | `/auth/login` | público | público | no aplica | ✅ | `login` | `autenticacion-perfiles.test.ts`, `auth-sesion.test.ts` |
| EP-016 | POST | `/auth/logout` | público | público | no aplica | ✅ | `logout` | `auth-sesion.test.ts` |
| EP-017 | GET | `/auth/me` | usuario | usuario | sesión propia | ✅ | `getCurrentSession` | `autenticacion-perfiles.test.ts`, `auth-sesion.test.ts`, `moderacion-seguridad-real.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-018 | POST | `/auth/register` | público | público | no aplica | ✅ | `register` | `autenticacion-perfiles.test.ts`, `auth-codigos.test.ts` |
| EP-019 | POST | `/auth/reset-password` | público | público | no aplica | ✅ | `resetPassword` | `autenticacion-perfiles.test.ts`, `auth-sesion.test.ts` |
| EP-020 | POST | `/auth/send-register-code` | público | público | no aplica | ✅ | `sendRegisterCode` | `autenticacion-perfiles.test.ts`, `auth-sesion.test.ts` |
| EP-021 | POST | `/auth/verify-reset-code` | público | público | no aplica | ✅ | `verifyResetCode` | `autenticacion-perfiles.test.ts`, `auth-sesion.test.ts` |
| EP-022 | GET | `/busqueda` | autenticado | autenticado | no aplica | ✅ | `semanticSearch` | `autorizacion-endpoints.test.ts` |
| EP-023 | POST | `/certificacion` | usuario | usuario | sesión propia | ✅ | `createCertification` | `moderacion-seguridad-real.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-024 | DELETE | `/certificacion/:id` | usuario | usuario | propietario del recurso | ✅ | `deleteCertification` | `autorizacion-endpoints.test.ts` |
| EP-025 | GET | `/certificacion/:id` | autenticado | autenticado | no aplica | ✅ | `getCertification` | `autorizacion-endpoints.test.ts` |
| EP-026 | GET | `/certificacion/user/:id_usuario` | autenticado | autenticado | no aplica | ✅ | `getUserCertifications` | `autorizacion-endpoints.test.ts` |
| EP-027 | POST | `/conversacion` | usuario | usuario | sesión propia | ✅ | `startConversation` | `mensajeria-coordinacion-real.test.ts`, `mensajeria-coordinacion.test.ts`, `moderacion-seguridad-real.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-028 | PATCH | `/conversacion/:id/estado` | usuario | usuario | participante del recurso | ✅ | `updateConversationState` | `mensajeria-coordinacion-real.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-029 | PUT | `/conversacion/:id/estado` | usuario | usuario | participante del recurso | ✅ | `updateConversationStateLegacy` | `autorizacion-endpoints.test.ts` |
| EP-030 | GET | `/conversacion/:id/mensajes` | usuario | usuario | participante del recurso | ✅ | `getConversationMessages` | `mensajeria-coordinacion-real.test.ts`, `mensajeria-coordinacion.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-031 | GET | `/conversacion/conversaciones` | usuario | usuario | sesión propia | ✅ | `listConversations` | `mensajeria-coordinacion-real.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-032 | GET | `/estado` | público | público | no aplica | ✅ | `listStates` | `infraestructura-real.test.ts` |
| EP-033 | GET | `/etiqueta` | público | público | no aplica | ✅ | `listTags` | pendiente |
| EP-034 | GET | `/etiqueta/publicacion/:id` | autenticado | autenticado | no aplica | ✅ | `getPublicationTags` | `autorizacion-endpoints.test.ts` |
| EP-035 | GET | `/etiqueta/user/:id` | autenticado | autenticado | no aplica | ✅ | `getUserTags` | `autorizacion-endpoints.test.ts` |
| EP-036 | POST | `/etiqueta/user/:id` | usuario | usuario | propietario por parámetro | ✅ | `syncUserTags` | `autenticacion-perfiles.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-037 | GET | `/guardados` | usuario | usuario | sesión propia | ✅ | `listSavedPublications` | `historial-guardados.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-038 | DELETE | `/guardados/:publicacionId` | usuario | usuario | sesión propia | ✅ | `removeSavedPublication` | `autorizacion-endpoints.test.ts` |
| EP-039 | POST | `/guardados/:publicacionId` | usuario | usuario | sesión propia | ✅ | `savePublication` | `historial-guardados.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-040 | GET | `/health` | público | público | no aplica | ✅ | `getHealth` | `contrato-rest.test.ts`, `health.test.ts` |
| EP-041 | GET | `/horarios/:usuarioId` | público | público | no aplica | ✅ | `getUserSchedule` | `autenticacion-perfiles.test.ts` |
| EP-042 | PUT | `/horarios/:usuarioId` | usuario | usuario | propietario por parámetro | ✅ | `replaceUserSchedule` | `autenticacion-perfiles.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-043 | PUT | `/imagen/perfil/:id` | usuario | usuario | propietario por parámetro | ✅ | `updateProfilePicture` | `autorizacion-endpoints.test.ts` |
| EP-044 | POST | `/imagen/upload` | autenticado | autenticado | sesión propia | ✅ | `uploadImage` | `autorizacion-endpoints.test.ts` |
| EP-045 | DELETE | `/likes/:publicacionId` | usuario | usuario | sesión propia | ✅ | `unlikePublication` | `autorizacion-endpoints.test.ts` |
| EP-046 | POST | `/likes/:publicacionId` | usuario | usuario | sesión propia | ✅ | `likePublication` | `autorizacion-endpoints.test.ts` |
| EP-047 | GET | `/moderador` | superadmin | superadmin | no aplica | ✅ | `listModerators` | `autorizacion-endpoints.test.ts` |
| EP-048 | POST | `/moderador` | superadmin | superadmin | no aplica | ✅ | `createModerator` | `autorizacion-endpoints.test.ts` |
| EP-049 | DELETE | `/moderador/:id` | superadmin | superadmin | no aplica | ✅ | `deleteModerator` | `autenticacion-perfiles.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-050 | PATCH | `/moderador/:id` | superadmin | superadmin | no aplica | ✅ | `updateModerator` | `autenticacion-perfiles.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-051 | PATCH | `/moderador/:id/estado` | superadmin | superadmin | no aplica | ✅ | `updateModeratorStatus` | `autorizacion-endpoints.test.ts` |
| EP-052 | POST | `/moderador/login` | público | público | no aplica | ✅ | `loginModerator` | pendiente |
| EP-053 | GET | `/moderador/me` | moderador | moderador | sesión propia | ✅ | `getCurrentModerator` | `autenticacion-perfiles.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-054 | GET | `/moderador/palabras` | moderador | moderador | no aplica | ✅ | `listRestrictedWords` | `autorizacion-endpoints.test.ts` |
| EP-055 | POST | `/moderador/palabras` | moderador | moderador | no aplica | ✅ | `createRestrictedWord` | `moderacion-seguridad-real.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-056 | DELETE | `/moderador/palabras/:id` | moderador | moderador | no aplica | ✅ | `deleteRestrictedWord` | `moderacion-seguridad-real.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-057 | PATCH | `/moderador/palabras/:id` | moderador | moderador | no aplica | ✅ | `updateRestrictedWord` | `autorizacion-endpoints.test.ts` |
| EP-058 | GET | `/moderador/publicaciones` | moderador | moderador | no aplica | ✅ | `listPublicationsForModeration` | `autorizacion-endpoints.test.ts` |
| EP-059 | DELETE | `/moderador/publicaciones/:id` | moderador | moderador | no aplica | ✅ | `deletePublicationModeration` | `autorizacion-endpoints.test.ts` |
| EP-060 | PATCH | `/moderador/publicaciones/:id/bajar` | moderador | moderador | no aplica | ✅ | `takeDownPublication` | `moderacion-seguridad-real.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-061 | PATCH | `/moderador/publicaciones/:id/reactivar` | moderador | moderador | no aplica | ✅ | `reactivatePublication` | `moderacion-seguridad-real.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-062 | GET | `/moderador/usuarios` | moderador | moderador | no aplica | ✅ | `listUsersForModeration` | `autorizacion-endpoints.test.ts` |
| EP-063 | POST | `/moderador/usuarios/:id/advertencia` | moderador | moderador | no aplica | ✅ | `warnUser` | `moderacion-seguridad-real.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-064 | PATCH | `/moderador/usuarios/:id/estado` | moderador | moderador | no aplica | ✅ | `updateUserStatus` | `autenticacion-perfiles.test.ts`, `moderacion-seguridad-real.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-065 | GET | `/notificacion` | usuario | usuario | sesión propia | ✅ | `listNotifications` | `moderacion-seguridad-real.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-066 | PATCH | `/notificacion/:id/estado` | usuario | usuario | propietario del recurso | ✅ | `updateNotificationState` | `autorizacion-endpoints.test.ts` |
| EP-067 | GET | `/publicacion` | autenticado | autenticado | no aplica | ✅ | `listPublications` | `autorizacion-endpoints.test.ts` |
| EP-068 | POST | `/publicacion` | usuario | usuario | sesión propia | ✅ | `createPublication` | `moderacion-seguridad-real.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-069 | DELETE | `/publicacion/:id` | usuario | usuario | propietario del recurso | ✅ | `deletePublication` | `autorizacion-endpoints.test.ts` |
| EP-070 | GET | `/publicacion/:id` | autenticado | autenticado | no aplica | ✅ | `getPublication` | `autorizacion-endpoints.test.ts` |
| EP-071 | PATCH | `/publicacion/:id` | usuario | usuario | propietario del recurso | ✅ | `updatePublication` | `autorizacion-endpoints.test.ts` |
| EP-072 | PUT | `/publicacion/:id` | usuario | usuario | propietario del recurso | ✅ | `updatePublicationLegacy` | `contrato-rest.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-073 | PATCH | `/publicacion/:id/destacar` | usuario | usuario | propietario del recurso | ✅ | `pinPublication` | `autorizacion-endpoints.test.ts` |
| EP-074 | PATCH | `/publicacion/:id/estado` | usuario | usuario | propietario del recurso | ✅ | `updatePublicationState` | `moderacion-seguridad-real.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-075 | POST | `/publicacion/buscar` | autenticado | autenticado | no aplica | ✅ | `searchPublications` | `autorizacion-endpoints.test.ts` |
| EP-076 | GET | `/publicacion/destacadas/user/:id` | autenticado | autenticado | no aplica | ✅ | `getPinnedUserPublications` | `autorizacion-endpoints.test.ts` |
| EP-077 | GET | `/publicacion/user/:id` | autenticado | autenticado | no aplica | ✅ | `getUserPublications` | `autorizacion-endpoints.test.ts` |
| EP-078 | POST | `/recomendacion/evento` | usuario | usuario | sesión propia | ✅ | `registerRecommendationEvent` | `autorizacion-endpoints.test.ts` |
| EP-079 | DELETE | `/recomendacion/favoritas` | usuario | usuario | sesión propia | ✅ | `removeFavoriteTags` | `autorizacion-endpoints.test.ts` |
| EP-080 | POST | `/recomendacion/favoritas` | usuario | usuario | sesión propia | ✅ | `addFavoriteTags` | `autorizacion-endpoints.test.ts` |
| EP-081 | GET | `/recomendacion/globales/:tipo?` | autenticado | autenticado | no aplica | ✅ | `getGlobalRecommendationsByType`, `getGlobalRecommendations` | `autorizacion-endpoints.test.ts` |
| EP-082 | GET | `/recomendacion/mias` | usuario | usuario | sesión propia | ✅ | `getExactRecommendations` | `autorizacion-endpoints.test.ts` |
| EP-083 | GET | `/recomendacion/personalizadas` | usuario | usuario | sesión propia | ✅ | `getPersonalizedRecommendations` | `autorizacion-endpoints.test.ts` |
| EP-084 | GET | `/recomendacion/similares/:id` | autenticado | autenticado | no aplica | ✅ | `getSimilarPublications` | `autorizacion-endpoints.test.ts` |
| EP-085 | GET | `/recomendacion/tutores` | autenticado | autenticado | no aplica | ✅ | `getTutorRecommendations` | `autorizacion-endpoints.test.ts` |
| EP-086 | POST | `/reportes` | usuario | usuario | sesión propia | ✅ | `createReport` | `moderacion-seguridad-real.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-087 | GET | `/reportes/:id` | moderador | moderador | no aplica | ✅ | `getReportById` | `moderacion-seguridad-real.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-088 | PUT | `/reportes/:id` | moderador | moderador | no aplica | ✅ | `updateReportStatusLegacy` | `autorizacion-endpoints.test.ts` |
| EP-089 | PATCH | `/reportes/:id/estado` | moderador | moderador | no aplica | ✅ | `updateReportStatus` | `moderacion-seguridad-real.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-090 | POST | `/reportes/buscar` | moderador | moderador | no aplica | ✅ | `searchReports` | `moderacion-seguridad-real.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-091 | POST | `/resenas` | usuario | usuario | sesión propia | ✅ | `createReview` | `autorizacion-endpoints.test.ts` |
| EP-092 | DELETE | `/resenas/:id_resena` | usuario | usuario | propietario del recurso | ✅ | `deleteReview` | `autorizacion-endpoints.test.ts` |
| EP-093 | PUT | `/resenas/:id_resena` | usuario | usuario | propietario del recurso | ✅ | `updateReview` | `autorizacion-endpoints.test.ts` |
| EP-094 | GET | `/resenas/usuario/:id_usuario` | público | público | no aplica | ✅ | `getUserReviews` | pendiente |
| EP-095 | GET | `/user/:id` | autenticado | autenticado | no aplica | ✅ | `getUser` | `autorizacion-endpoints.test.ts` |
| EP-096 | PATCH | `/user/:id` | usuario | usuario | propietario por parámetro | ✅ | `updateUser` | `autenticacion-perfiles.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-097 | GET | `/user/:id/contactos` | autenticado | autenticado | no aplica | ✅ | `getUserContacts` | `autorizacion-endpoints.test.ts` |
| EP-098 | PUT | `/user/:id/contactos` | usuario | usuario | propietario por parámetro | ✅ | `replaceUserContacts` | `autenticacion-perfiles.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-099 | GET | `/user/:id/perfil-publico` | autenticado | autenticado | no aplica | ✅ | `getPublicProfile` | `autenticacion-perfiles.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-100 | POST | `/user/tutores/buscar` | autenticado | autenticado | no aplica | ✅ | `searchTutors` | `autorizacion-endpoints.test.ts` |
