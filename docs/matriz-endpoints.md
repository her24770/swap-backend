# Matriz trazable de endpoints

> Archivo generado por `npm run endpoints:inventory`. No editar manualmente.

- Rutas Express inventariadas: **94**
- Rutas documentadas en OpenAPI: **94/94**
- Rutas con al menos una invocación HTTP localizada: **82/94**

La columna de prueba HTTP solo acredita que existe una invocación; los escenarios mínimos pendientes por endpoint son: caso exitoso, 401 sin sesión, 403 con rol/propietario incorrecto, 400 de validación y errores de dominio 404/409 cuando apliquen.

| ID | Método | Ruta Express | Acceso según middleware | OpenAPI | Prueba HTTP localizada |
| --- | --- | --- | --- | --- | --- |
| EP-001 | POST | `/acuerdo/:id` | usuario | `createAgreement` | `mensajeria-coordinacion.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-002 | PUT | `/acuerdo/:id` | usuario | `updateAgreementState` | `autorizacion-endpoints.test.ts` |
| EP-003 | PUT | `/acuerdo/:id/editar` | usuario | `updateAgreement` | `autorizacion-endpoints.test.ts` |
| EP-004 | GET | `/acuerdo/conversacion/:id` | autenticado | `getConversationAgreements` | `mensajeria-coordinacion.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-005 | GET | `/acuerdo/user/:id` | autenticado | `getUserAgreements` | `autorizacion-endpoints.test.ts` |
| EP-006 | GET | `/anuncio` | autenticado | `listAds` | `autorizacion-endpoints.test.ts` |
| EP-007 | POST | `/anuncio` | usuario | `createAd` | `autorizacion-endpoints.test.ts` |
| EP-008 | DELETE | `/anuncio/:id_anuncio` | usuario | `deleteAd` | `autorizacion-endpoints.test.ts` |
| EP-009 | PUT | `/anuncio/:id_anuncio` | usuario | `updateAd` | `autorizacion-endpoints.test.ts` |
| EP-010 | GET | `/anuncio/user/:id_usuario` | autenticado | `getUserAds` | `autorizacion-endpoints.test.ts` |
| EP-011 | POST | `/auth/forgot-password` | público | `forgotPassword` | pendiente |
| EP-012 | POST | `/auth/login` | público | `login` | pendiente |
| EP-013 | POST | `/auth/logout` | público | `logout` | pendiente |
| EP-014 | GET | `/auth/me` | usuario | `getCurrentSession` | `autorizacion-endpoints.test.ts` |
| EP-015 | POST | `/auth/register` | público | `register` | pendiente |
| EP-016 | POST | `/auth/reset-password` | público | `resetPassword` | pendiente |
| EP-017 | POST | `/auth/send-register-code` | público | `sendRegisterCode` | pendiente |
| EP-018 | POST | `/auth/verify-reset-code` | público | `verifyResetCode` | pendiente |
| EP-019 | GET | `/busqueda` | autenticado | `semanticSearch` | `autorizacion-endpoints.test.ts` |
| EP-020 | POST | `/certificacion` | usuario | `createCertification` | `autorizacion-endpoints.test.ts` |
| EP-021 | DELETE | `/certificacion/:id` | usuario | `deleteCertification` | `autorizacion-endpoints.test.ts` |
| EP-022 | GET | `/certificacion/:id` | autenticado | `getCertification` | `autorizacion-endpoints.test.ts` |
| EP-023 | GET | `/certificacion/user/:id_usuario` | autenticado | `getUserCertifications` | `autorizacion-endpoints.test.ts` |
| EP-024 | POST | `/conversacion` | usuario | `startConversation` | `mensajeria-coordinacion.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-025 | PUT | `/conversacion/:id/estado` | usuario | `updateConversationState` | `autorizacion-endpoints.test.ts` |
| EP-026 | GET | `/conversacion/:id/mensajes` | usuario | `getConversationMessages` | `mensajeria-coordinacion.test.ts`, `autorizacion-endpoints.test.ts` |
| EP-027 | GET | `/conversacion/conversaciones` | usuario | `listMyConversations` | `autorizacion-endpoints.test.ts` |
| EP-028 | GET | `/estado` | público | `listStates` | `infraestructura-real.test.ts` |
| EP-029 | GET | `/etiqueta` | público | `listTags` | pendiente |
| EP-030 | GET | `/etiqueta/publicacion/:id` | autenticado | `getPublicationTags` | `autorizacion-endpoints.test.ts` |
| EP-031 | GET | `/etiqueta/user/:id` | autenticado | `getUserTags` | `autorizacion-endpoints.test.ts` |
| EP-032 | POST | `/etiqueta/user/:id` | usuario | `syncUserTags` | `autorizacion-endpoints.test.ts` |
| EP-033 | GET | `/guardados` | usuario | `listSavedPublications` | `autorizacion-endpoints.test.ts` |
| EP-034 | DELETE | `/guardados/:publicacionId` | usuario | `removeSavedPublication` | `autorizacion-endpoints.test.ts` |
| EP-035 | POST | `/guardados/:publicacionId` | usuario | `savePublication` | `autorizacion-endpoints.test.ts` |
| EP-036 | GET | `/health` | público | `getHealth` | `health.test.ts` |
| EP-037 | GET | `/horarios/:usuarioId` | público | `getUserSchedule` | pendiente |
| EP-038 | PUT | `/horarios/:usuarioId` | usuario | `replaceUserSchedule` | `autorizacion-endpoints.test.ts` |
| EP-039 | PUT | `/imagen/perfil/:id` | usuario | `updateProfilePicture` | `autorizacion-endpoints.test.ts` |
| EP-040 | POST | `/imagen/upload` | autenticado | `uploadImage` | `autorizacion-endpoints.test.ts` |
| EP-041 | DELETE | `/likes/:publicacionId` | usuario | `unlikePublication` | `autorizacion-endpoints.test.ts` |
| EP-042 | POST | `/likes/:publicacionId` | usuario | `likePublication` | `autorizacion-endpoints.test.ts` |
| EP-043 | GET | `/moderador` | superadmin | `listModerators` | `autorizacion-endpoints.test.ts` |
| EP-044 | POST | `/moderador` | superadmin | `createModerator` | `autorizacion-endpoints.test.ts` |
| EP-045 | DELETE | `/moderador/:id` | superadmin | `deleteModerator` | `autorizacion-endpoints.test.ts` |
| EP-046 | PATCH | `/moderador/:id` | superadmin | `updateModerator` | `autorizacion-endpoints.test.ts` |
| EP-047 | PATCH | `/moderador/:id/estado` | superadmin | `updateModeratorStatus` | `autorizacion-endpoints.test.ts` |
| EP-048 | POST | `/moderador/login` | público | `moderatorLogin` | pendiente |
| EP-049 | GET | `/moderador/me` | moderador | `getModeratorSession` | `autorizacion-endpoints.test.ts` |
| EP-050 | GET | `/moderador/palabras` | moderador | `listRestrictedWords` | `autorizacion-endpoints.test.ts` |
| EP-051 | POST | `/moderador/palabras` | moderador | `createRestrictedWord` | `autorizacion-endpoints.test.ts` |
| EP-052 | DELETE | `/moderador/palabras/:id` | moderador | `deleteRestrictedWord` | `autorizacion-endpoints.test.ts` |
| EP-053 | PATCH | `/moderador/palabras/:id` | moderador | `updateRestrictedWord` | `autorizacion-endpoints.test.ts` |
| EP-054 | GET | `/moderador/publicaciones` | moderador | `listPublicationsForModeration` | `autorizacion-endpoints.test.ts` |
| EP-055 | DELETE | `/moderador/publicaciones/:id` | moderador | `deletePublicationByModerator` | `autorizacion-endpoints.test.ts` |
| EP-056 | PATCH | `/moderador/publicaciones/:id/bajar` | moderador | `deactivatePublicationByModerator` | `autorizacion-endpoints.test.ts` |
| EP-057 | PATCH | `/moderador/publicaciones/:id/reactivar` | moderador | `reactivatePublicationByModerator` | `autorizacion-endpoints.test.ts` |
| EP-058 | GET | `/moderador/usuarios` | moderador | `listUsersForModeration` | `autorizacion-endpoints.test.ts` |
| EP-059 | POST | `/moderador/usuarios/:id/advertencia` | moderador | `warnUser` | `autorizacion-endpoints.test.ts` |
| EP-060 | PATCH | `/moderador/usuarios/:id/estado` | moderador | `updateUserModerationStatus` | `autorizacion-endpoints.test.ts` |
| EP-061 | GET | `/notificacion` | usuario | `listNotifications` | `autorizacion-endpoints.test.ts` |
| EP-062 | PATCH | `/notificacion/:id/estado` | usuario | `updateNotificationState` | `autorizacion-endpoints.test.ts` |
| EP-063 | GET | `/publicacion` | autenticado | `listPublications` | `autorizacion-endpoints.test.ts` |
| EP-064 | POST | `/publicacion` | usuario | `createPublication` | `autorizacion-endpoints.test.ts` |
| EP-065 | DELETE | `/publicacion/:id` | usuario | `deletePublication` | `autorizacion-endpoints.test.ts` |
| EP-066 | GET | `/publicacion/:id` | autenticado | `getPublication` | `autorizacion-endpoints.test.ts` |
| EP-067 | PUT | `/publicacion/:id` | usuario | `updatePublication` | `autorizacion-endpoints.test.ts` |
| EP-068 | PATCH | `/publicacion/:id/destacar` | usuario | `pinPublication` | `autorizacion-endpoints.test.ts` |
| EP-069 | PATCH | `/publicacion/:id/estado` | usuario | `updatePublicationState` | `autorizacion-endpoints.test.ts` |
| EP-070 | POST | `/publicacion/buscar` | autenticado | `searchPublications` | `autorizacion-endpoints.test.ts` |
| EP-071 | GET | `/publicacion/destacadas/user/:id` | autenticado | `getPinnedUserPublications` | `autorizacion-endpoints.test.ts` |
| EP-072 | GET | `/publicacion/user/:id` | autenticado | `getUserPublications` | `autorizacion-endpoints.test.ts` |
| EP-073 | POST | `/recomendacion/evento` | usuario | `registerRecommendationEvent` | `autorizacion-endpoints.test.ts` |
| EP-074 | DELETE | `/recomendacion/favoritas` | usuario | `removeFavoriteTags` | `autorizacion-endpoints.test.ts` |
| EP-075 | POST | `/recomendacion/favoritas` | usuario | `addFavoriteTags` | `autorizacion-endpoints.test.ts` |
| EP-076 | GET | `/recomendacion/globales/:tipo?` | autenticado | `getGlobalRecommendationsByType`, `getGlobalRecommendations` | `autorizacion-endpoints.test.ts` |
| EP-077 | GET | `/recomendacion/mias` | usuario | `getExactRecommendations` | `autorizacion-endpoints.test.ts` |
| EP-078 | GET | `/recomendacion/personalizadas` | usuario | `getPersonalizedRecommendations` | `autorizacion-endpoints.test.ts` |
| EP-079 | GET | `/recomendacion/similares/:id` | autenticado | `getSimilarPublications` | `autorizacion-endpoints.test.ts` |
| EP-080 | GET | `/recomendacion/tutores` | autenticado | `getTutorRecommendations` | `autorizacion-endpoints.test.ts` |
| EP-081 | POST | `/reportes` | usuario | `createReport` | `autorizacion-endpoints.test.ts` |
| EP-082 | GET | `/reportes/:id` | moderador | `getReport` | `autorizacion-endpoints.test.ts` |
| EP-083 | PUT | `/reportes/:id` | moderador | `updateReportStatus` | `autorizacion-endpoints.test.ts` |
| EP-084 | POST | `/reportes/buscar` | moderador | `searchReports` | `autorizacion-endpoints.test.ts` |
| EP-085 | POST | `/resenas` | usuario | `createReview` | `autorizacion-endpoints.test.ts` |
| EP-086 | DELETE | `/resenas/:id_resena` | usuario | `deleteReview` | `autorizacion-endpoints.test.ts` |
| EP-087 | PUT | `/resenas/:id_resena` | usuario | `updateReview` | `autorizacion-endpoints.test.ts` |
| EP-088 | GET | `/resenas/usuario/:id_usuario` | público | `getUserReviews` | pendiente |
| EP-089 | GET | `/user/:id` | autenticado | `getUser` | `autorizacion-endpoints.test.ts` |
| EP-090 | PATCH | `/user/:id` | usuario | `updateUser` | `autorizacion-endpoints.test.ts` |
| EP-091 | GET | `/user/:id/contactos` | autenticado | `getUserContacts` | `autorizacion-endpoints.test.ts` |
| EP-092 | PUT | `/user/:id/contactos` | usuario | `replaceUserContacts` | `autorizacion-endpoints.test.ts` |
| EP-093 | GET | `/user/:id/perfil-publico` | público | `getPublicProfile` | pendiente |
| EP-094 | POST | `/user/tutores/buscar` | autenticado | `searchTutors` | `autorizacion-endpoints.test.ts` |
