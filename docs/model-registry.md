# Registry de modelos (R13) — versión 1

Código: `packages/domain/src/registry.ts`. Verificado el **2026-10-12** contra:
- https://platform.claude.com/docs/en/about-claude/models/overview (IDs, contexto, salida máxima, capacidades)
- https://platform.claude.com/docs/en/about-claude/pricing (precios por modalidad)
- https://platform.claude.com/docs/en/build-with-claude/extended-thinking (`usage.output_tokens_details.thinking_tokens` es subconjunto de los tokens de salida facturados)

| Clave | modelId exacto | Contexto | Salida máx. | Input $/MTok | Write 5m | Write 1h | Cache read | Output | Disponibilidad |
|---|---|---|---|---|---|---|---|---|---|
| local:atlas-extractive-v1 | atlas-extractive-v1 | — | — | sin cargo de proveedor | | | | | local |
| anthropic:claude-opus-5-5 | claude-opus-5-5 | 1M | 128K | 4 | 5 | 8 | 0.20 | 20 | pendiente (sin credenciales) |
| anthropic:claude-sonnet-5-5 | claude-sonnet-5-5 | 1M | 128K | 2 | 2.50 | 4 | 0.10 | 10 | pendiente |
| anthropic:claude-haiku-5-5 | claude-haiku-5-5 | 1M | 128K | 0.10 (>100K prompt: 0.50) | 0.125 (0.625) | 0.20 (1) | 0.01 (0.05) | 0.50 (2.50) | pendiente |
| anthropic:claude-fable-5-1 | claude-fable-5-1 | 1M | 128K | 10 | 12.50 | 20 | 0.25 | 50 | pendiente; no es default |

Herramienta con cargo conocido: web search USD 10 / 1.000 búsquedas (Atlas no la habilita por defecto).

Nota: la tabla en caché de la skill interna indicaba cache read de Sonnet 5.5 en 0.20; la página oficial dice 0.10 (0.05× base). Prevalece la página oficial.

## Gemini
**Pendiente.** El host oficial (ai.google.dev) no fue accesible desde el entorno de build (proxy 403). No se registran IDs ni precios. La normalización de `usageMetadata` está preparada (`normalizeGeminiUsage`) y marcada "pending verification"; el costo queda "unknown" hasta verificar.

## Reglas
- El modelo con el que se desarrolla en Claude Code no se convierte en ID de API.
- Modelos pendientes aparecen deshabilitados con motivo; elegirlos bloquea el run o pide aprobar una alternativa.
- `allowAutomaticFallback` es siempre `false`: cambiar de proveedor o precio requiere aprobación explícita; un modelo fijado por el usuario nunca se reemplaza.
- Endpoints de proveedores por allowlist en el servidor (sin URLs arbitrarias → sin SSRF).
- Cada cambio de precios crea una nueva `ModelPriceVersion`; los runs guardan el `priceVersionId` usado.
