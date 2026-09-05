# Matriz trazable de endpoints

> Archivo generado por `npm run endpoints:inventory`. No editar manualmente.

- Rutas Express inventariadas: **100**
- Rutas documentadas en OpenAPI: **100/100**
- Rutas con al menos una invocación HTTP localizada: **88/100**

La columna de prueba HTTP solo acredita que existe una invocación; los escenarios mínimos pendientes por endpoint son: caso exitoso, 401 sin sesión, 403 con rol/propietario incorrecto, 400 de validación y errores de dominio 404/409 cuando apliquen.

| ID | Método | Ruta Express | Acceso según middleware | OpenAPI | Prueba HTTP localizada |
| --- | --- | --- | --- | --- | --- |
| EP-001 | POST | `/acuerdo/:id` | usuario | `createAgreement` | `mensajeria-coordinacion.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-002 | PUT | `/acuerdo/:id` | usuario | `updateAgreementStateLegacy` | `autorizacion-endpoints.test.ts` |
| EP-003 | PUT | `/acuerdo/:id/detalle` | usuario | `replaceAgreementDetails` | `autorizacion-endpoints.test.ts` |
| EP-004 | PUT | `/acuerdo/:id/editar` | usuario | `updateAgreementLegacy` | `autorizacion-endpoints.test.ts` |
| EP-005 | PATCH | `/acuerdo/:id/estado` | usuario | `updateAgreementState` | `autorizacion-endpoints.test.ts` |
| EP-006 | GET | `/acuerdo/conversacion/:id` | autenticado | `getConversationAgreements` | `mensajeria-coordinacion.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-007 | GET | `/acuerdo/user/:id` | autenticado | `getUserAgreements` | `autorizacion-endpoints.test.ts` |
| EP-008 | GET | `/anuncio` | autenticado | `listAds` | `autorizacion-endpoints.test.ts` |
| EP-009 | POST | `/anuncio` | usuario | `createAd` | `autorizacion-endpoints.test.ts` |
| EP-010 | DELETE | `/anuncio/:id_anuncio` | usuario | `deleteAd` | `autorizacion-endpoints.test.ts` |
| EP-011 | PATCH | `/anuncio/:id_anuncio` | usuario | `updateAd` | `autorizacion-endpoints.test.ts` |
| EP-012 | PUT | `/anuncio/:id_anuncio` | usuario | `updateAdLegacy` | `autorizacion-endpoints.test.ts` |
| EP-013 | GET | `/anuncio/user/:id_usuario` | autenticado | `getUserAds` | `autorizacion-endpoints.test.ts` |
| EP-014 | POST | `/auth/forgot-password` | público | `forgotPassword` | pendiente |
| EP-015 | POST | `/auth/login` | público | `login` | pendiente |
| EP-016 | POST | `/auth/logout` | público | `logout` | pendiente |
| EP-017 | GET | `/auth/me` | usuario | `getCurrentSession` | `autorizacion-endpoints.test.ts` |
| EP-018 | POST | `/auth/register` | público | `register` | pendiente |
| EP-019 | POST | `/auth/reset-password` | público | `resetPassword` | pendiente |
| EP-020 | POST | `/auth/send-register-code` | público | `sendRegisterCode` | pendiente |
| EP-021 | POST | `/auth/verify-reset-code` | público | `verifyResetCode` | pendiente |
| EP-022 | GET | `/busqueda` | autenticado | `semanticSearch` | `autorizacion-endpoints.test.ts` |
| EP-023 | POST | `/certificacion` | usuario | `createCertification` | `autorizacion-endpoints.test.ts` |
| EP-024 | DELETE | `/certificacion/:id` | usuario | `deleteCertification` | `autorizacion-endpoints.test.ts` |
| EP-025 | GET | `/certificacion/:id` | autenticado | `getCertification` | `autorizacion-endpoints.test.ts` |
| EP-026 | GET | `/certificacion/user/:id_usuario` | autenticado | `getUserCertifications` | `autorizacion-endpoints.test.ts` |
| EP-027 | POST | `/conversacion` | usuario | `startConversation` | `mensajeria-coordinacion.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-028 | PATCH | `/conversacion/:id/estado` | usuario | `updateConversationState` | `autorizacion-endpoints.test.ts` |
| EP-029 | PUT | `/conversacion/:id/estado` | usuario | `updateConversationStateLegacy` | `autorizacion-endpoints.test.ts` |
| EP-030 | GET | `/conversacion/:id/mensajes` | usuario | `getConversationMessages` | `mensajeria-coordinacion.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-031 | GET | `/conversacion/conversaciones` | usuario | `listMyConversations` | `autorizacion-endpoints.test.ts` |
| EP-032 | GET | `/estado` | público | `listStates` | `infraestructura-real.test.ts` |
| EP-033 | GET | `/etiqueta` | público | `listTags` | pendiente |
| EP-034 | GET | `/etiqueta/publicacion/:id` | autenticado | `getPublicationTags` | `autorizacion-endpoints.test.ts` |
| EP-035 | GET | `/etiqueta/user/:id` | autenticado | `getUserTags` | `autorizacion-endpoints.test.ts` |
| EP-036 | POST | `/etiqueta/user/:id` | usuario | `syncUserTags` | `autorizacion-endpoints.test.ts` |
| EP-037 | GET | `/guardados` | usuario | `listSavedPublications` | `autorizacion-endpoints.test.ts` |
| EP-038 | DELETE | `/guardados/:publicacionId` | usuario | `removeSavedPublication` | `autorizacion-endpoints.test.ts` |
| EP-039 | POST | `/guardados/:publicacionId` | usuario | `savePublication` | `autorizacion-endpoints.test.ts` |
| EP-040 | GET | `/health` | público | `getHealth` | `contrato-rest.test.ts`, `health.test.ts` |
| EP-041 | GET | `/horarios/:usuarioId` | público | `getUserSchedule` | pendiente |
| EP-042 | PUT | `/horarios/:usuarioId` | usuario | `replaceUserSchedule` | `autorizacion-endpoints.test.ts` |
| EP-043 | PUT | `/imagen/perfil/:id` | usuario | `updateProfilePicture` | `autorizacion-endpoints.test.ts` |
| EP-044 | POST | `/imagen/upload` | autenticado | `uploadImage` | `autorizacion-endpoints.test.ts` |
| EP-045 | DELETE | `/likes/:publicacionId` | usuario | `unlikePublication` | `autorizacion-endpoints.test.ts` |
| EP-046 | POST | `/likes/:publicacionId` | usuario | `likePublication` | `autorizacion-endpoints.test.ts` |
| EP-047 | GET | `/moderador` | superadmin | `listModerators` | `autorizacion-endpoints.test.ts` |
| EP-048 | POST | `/moderador` | superadmin | `createModerator` | `autorizacion-endpoints.test.ts` |
| EP-049 | DELETE | `/moderador/:id` | superadmin | `deleteModerator` | `autorizacion-endpoints.test.ts` |
| EP-050 | PATCH | `/moderador/:id` | superadmin | `updateModerator` | `autorizacion-endpoints.test.ts` |
| EP-051 | PATCH | `/moderador/:id/estado` | superadmin | `updateModeratorStatus` | `autorizacion-endpoints.test.ts` |
| EP-052 | POST | `/moderador/login` | público | `moderatorLogin` | pendiente |
| EP-053 | GET | `/moderador/me` | moderador | `getModeratorSession` | `autorizacion-endpoints.test.ts` |
| EP-054 | GET | `/moderador/palabras` | moderador | `listRestrictedWords` | `autorizacion-endpoints.test.ts` |
| EP-055 | POST | `/moderador/palabras` | moderador | `createRestrictedWord` | `autorizacion-endpoints.test.ts` |
| EP-056 | DELETE | `/moderador/palabras/:id` | moderador | `deleteRestrictedWord` | `autorizacion-endpoints.test.ts` |
| EP-057 | PATCH | `/moderador/palabras/:id` | moderador | `updateRestrictedWord` | `autorizacion-endpoints.test.ts` |
| EP-058 | GET | `/moderador/publicaciones` | moderador | `listPublicationsForModeration` | `autorizacion-endpoints.test.ts` |
| EP-059 | DELETE | `/moderador/publicaciones/:id` | moderador | `deletePublicationByModerator` | `autorizacion-endpoints.test.ts` |
| EP-060 | PATCH | `/moderador/publicaciones/:id/bajar` | moderador | `deactivatePublicationByModerator` | `autorizacion-endpoints.test.ts` |
| EP-061 | PATCH | `/moderador/publicaciones/:id/reactivar` | moderador | `reactivatePublicationByModerator` | `autorizacion-endpoints.test.ts` |
| EP-062 | GET | `/moderador/usuarios` | moderador | `listUsersForModeration` | `autorizacion-endpoints.test.ts` |
| EP-063 | POST | `/moderador/usuarios/:id/advertencia` | moderador | `warnUser` | `autorizacion-endpoints.test.ts` |
| EP-064 | PATCH | `/moderador/usuarios/:id/estado` | moderador | `updateUserModerationStatus` | `autorizacion-endpoints.test.ts` |
| EP-065 | GET | `/notificacion` | usuario | `listNotifications` | `autorizacion-endpoints.test.ts` |
| EP-066 | PATCH | `/notificacion/:id/estado` | usuario | `updateNotificationState` | `autorizacion-endpoints.test.ts` |
| EP-067 | GET | `/publicacion` | autenticado | `listPublications` | `autorizacion-endpoints.test.ts` |
| EP-068 | POST | `/publicacion` | usuario | `createPublication` | `autorizacion-endpoints.test.ts` |
| EP-069 | DELETE | `/publicacion/:id` | usuario | `deletePublication` | `autorizacion-endpoints.test.ts` |
| EP-070 | GET | `/publicacion/:id` | autenticado | `getPublication` | `autorizacion-endpoints.test.ts` |
| EP-071 | PATCH | `/publicacion/:id` | usuario | `updatePublication` | `autorizacion-endpoints.test.ts` |
| EP-072 | PUT | `/publicacion/:id` | usuario | `updatePublicationLegacy` | `contrato-rest.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-073 | PATCH | `/publicacion/:id/destacar` | usuario | `pinPublication` | `autorizacion-endpoints.test.ts` |
| EP-074 | PATCH | `/publicacion/:id/estado` | usuario | `updatePublicationState` | `autorizacion-endpoints.test.ts` |
| EP-075 | POST | `/publicacion/buscar` | autenticado | `searchPublications` | `autorizacion-endpoints.test.ts` |
| EP-076 | GET | `/publicacion/destacadas/user/:id` | autenticado | `getPinnedUserPublications` | `autorizacion-endpoints.test.ts` |
| EP-077 | GET | `/publicacion/user/:id` | autenticado | `getUserPublications` | `autorizacion-endpoints.test.ts` |
| EP-078 | POST | `/recomendacion/evento` | usuario | `registerRecommendationEvent` | `autorizacion-endpoints.test.ts` |
| EP-079 | DELETE | `/recomendacion/favoritas` | usuario | `removeFavoriteTags` | `autorizacion-endpoints.test.ts` |
| EP-080 | POST | `/recomendacion/favoritas` | usuario | `addFavoriteTags` | `autorizacion-endpoints.test.ts` |
| EP-081 | GET | `/recomendacion/globales/:tipo?` | autenticado | `getGlobalRecommendationsByType`, `getGlobalRecommendations` | `autorizacion-endpoints.test.ts` |
| EP-082 | GET | `/recomendacion/mias` | usuario | `getExactRecommendations` | `autorizacion-endpoints.test.ts` |
| EP-083 | GET | `/recomendacion/personalizadas` | usuario | `getPersonalizedRecommendations` | `autorizacion-endpoints.test.ts` |
| EP-084 | GET | `/recomendacion/similares/:id` | autenticado | `getSimilarPublications` | `autorizacion-endpoints.test.ts` |
| EP-085 | GET | `/recomendacion/tutores` | autenticado | `getTutorRecommendations` | `autorizacion-endpoints.test.ts` |
| EP-086 | POST | `/reportes` | usuario | `createReport` | `autorizacion-endpoints.test.ts` |
| EP-087 | GET | `/reportes/:id` | moderador | `getReport` | `autorizacion-endpoints.test.ts` |
| EP-088 | PUT | `/reportes/:id` | moderador | `updateReportStatusLegacy` | `autorizacion-endpoints.test.ts` |
| EP-089 | PATCH | `/reportes/:id/estado` | moderador | `updateReportStatus` | `autorizacion-endpoints.test.ts` |
| EP-090 | POST | `/reportes/buscar` | moderador | `searchReports` | `autorizacion-endpoints.test.ts` |
| EP-091 | POST | `/resenas` | usuario | `createReview` | `autorizacion-endpoints.test.ts` |
| EP-092 | DELETE | `/resenas/:id_resena` | usuario | `deleteReview` | `autorizacion-endpoints.test.ts` |
| EP-093 | PUT | `/resenas/:id_resena` | usuario | `updateReview` | `autorizacion-endpoints.test.ts` |
| EP-094 | GET | `/resenas/usuario/:id_usuario` | público | `getUserReviews` | pendiente |
| EP-095 | GET | `/user/:id` | autenticado | `getUser` | `autorizacion-endpoints.test.ts` |
| EP-096 | PATCH | `/user/:id` | usuario | `updateUser` | `autorizacion-endpoints.test.ts` |
| EP-097 | GET | `/user/:id/contactos` | autenticado | `getUserContacts` | `autorizacion-endpoints.test.ts` |
| EP-098 | PUT | `/user/:id/contactos` | usuario | `replaceUserContacts` | `autorizacion-endpoints.test.ts` |
| EP-099 | GET | `/user/:id/perfil-publico` | público | `getPublicProfile` | pendiente |
| EP-100 | POST | `/user/tutores/buscar` | autenticado | `searchTutors` | `autorizacion-endpoints.test.ts` |
