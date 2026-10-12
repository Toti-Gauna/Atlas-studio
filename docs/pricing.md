# FinOps — ledger, costos y cuotas (R09)

Código: `packages/domain/src/{money,pricing}.ts`. Tests: `packages/domain/test/pricing.test.ts`.

## Unidades
Importes en **nano-USD** (1e-9 USD) como enteros (BigInt / `numeric(30,0)`). Un token a $X/MTok cuesta X·1000 nano-USD: exacto para precios con hasta 3 decimales. Se redondea solo al mostrar (`formatUsd`: hasta 4 decimales bajo USD 1).

## Normalización por proveedor (sin doble conteo)
**Anthropic** (`normalizeAnthropicUsage`): `input_tokens` = remanente sin caché; prompt total = input + cache_creation + cache_read; `cache_creation` desglosa 5m/1h (si falta el desglose se tarifa a 5m y el costo queda **estimated**); `output_tokens` ya incluye thinking (`output_tokens_details.thinking_tokens` solo informativo); `server_tool_use.web_search_requests` a USD 10/1k.
**Gemini** (`normalizeGeminiUsage`): pendiente de verificación; `promptTokenCount` incluye `cachedContentTokenCount`; `thoughtsTokenCount` se suma una sola vez a la salida. Sin precio verificado → **unknown**.

## Estados de costo
| Estado | Significado |
|---|---|
| no_provider_charge | Adaptador local; distinto de desconocido |
| calculated | Usage reportado × precio snapshot, sin supuestos |
| estimated | Hubo un supuesto documentado (p. ej. TTL de caché) |
| unknown | Falta usage o tarifa; **nunca se muestra como 0** ni se suma |
| reconciled | Conciliado con factura del proveedor (P04+, requiere acceso) |

## Reservas y presupuestos
Antes de cada llamada (incluidos comparaciones, recomendaciones generadas, embeddings y pasos de workflow) se reserva `reservationUpperBound(price, maxInput, maxOutput)` (input al mayor entre base y write 5m; tier más caro aplicable). `canReserve` replica la condición SQL atómica. Al terminar se concilia: se libera la reserva y se asienta el costo calculado; cancelar o fallar puede haber consumido (se registra el intento). Dedupe solo por `(provider, providerRequestId)`; reintentos con otro request id se contabilizan aparte.

## Panel
7/30 días; agrupación por modelo/agente/proyecto/usuario/proveedor/día; filtros; detalle por run/intento con breakdown; export CSV con neutralización de fórmulas; presupuestos con gastado + reservado + entradas de costo desconocido. Los datos del preview son **DEMO fixture**: usage sintético con forma de respuesta Anthropic, tarifado con la tabla verificada; no es telemetría real ni factura.

Los costos son de llamadas de Atlas a APIs; no incluyen Claude Max, ChatGPT ni el costo de desarrollar con Claude Code.
