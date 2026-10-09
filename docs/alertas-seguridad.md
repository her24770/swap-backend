# Alertas de seguridad

El canal elegido es **webhook**. Configure `SECURITY_ALERT_WEBHOOK_URL` en el
servidor; si no está definido, el evaluador no se inicia. La URL es un secreto
y nunca debe confirmarse en el repositorio ni imprimirse en logs.

Las reglas usan contadores y enfriamiento distribuidos en Redis:

| Alerta | Evento fuente | Umbral predeterminado |
|---|---|---|
| `failed_login_spike` | `auth.login` / `auth.moderator_login` fallido | 5 por IP en 5 min |
| `rate_limit_blocks` | `security.rate_limit.blocked` | 3 por IP en 5 min |
| `moderation_provider_failures` | `moderation.provider_failed` | 1 en 5 min |
| `http_5xx_spike` | `http.request_completed` con estado 5xx | 5 globales en 5 min |

Cada alerta tiene 15 minutos de enfriamiento para evitar una tormenta de
notificaciones. Los umbrales y ventanas se pueden sobrescribir con las
variables documentadas en `.env.example`.

## Validación

Las pruebas unitarias simulan los cuatro tipos de evento, la decisión atómica
de Redis y la recepción HTTP del webhook. En el servidor, el dueño debe:

1. Configurar la URL HTTPS del receptor.
2. Desplegar/reiniciar la API.
3. Simular cada evento en un entorno controlado hasta alcanzar el umbral.
4. Guardar evidencia de al menos tres notificaciones recibidas.
5. Confirmar que la carga no contiene contraseñas, cookies, tokens ni códigos.

Los límites y agrupaciones por IP dependen de `req.ip`. El dueño del servidor
debe configurar `TRUST_PROXY_HOPS` con el número exacto de proxies inversos
confiables; no debe habilitar confianza general en `X-Forwarded-For`.

La validación local de extremo a extremo se ejecuta con:

```bash
npx tsx scripts/simularAlertasSeguridad.ts
```

El script solo acepta el entorno de integración, levanta un webhook HTTP
temporal y exige recibir las cuatro alertas antes de finalizar correctamente.
