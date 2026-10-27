# Configuración de `trust proxy`

Express tiene una única fuente de configuración en
`src/autenticacion/proxyConfiable.ts`, controlada por `TRUST_PROXY`.

## Desarrollo o conexión directa

```env
TRUST_PROXY=
```

Express ignora `X-Forwarded-For` y utiliza la dirección de la conexión TCP.

## Producción

Para la topología Cloudflare → nginx propio → API:

```env
TRUST_PROXY=cloudflare
```

La función confía en el primer salto porque nginx comparte el host con la API
y el puerto de la API no está expuesto públicamente. Los saltos adicionales
solo se consideran confiables si su dirección pertenece a los rangos oficiales
de Cloudflare. De esta forma, `req.ip` conserva la IP real del cliente sin
aceptar libremente una cabecera `X-Forwarded-For` falsificada.

`TRUST_PROXY_HOPS` fue eliminado: confiar en una cantidad fija de saltos puede
permitir suplantar la IP cuando el origen también acepta tráfico que no pasa
por Cloudflare.

Después de desplegar, el dueño del servidor debe verificar en un log HTTP de
prueba que el campo `ip` coincide con la IP pública del cliente.
