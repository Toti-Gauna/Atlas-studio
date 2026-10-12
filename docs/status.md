# Estado — Atlas Studio Premium V3

**Estado global:** Construcción · P02 (frontend) en cierre · **requiere revisión de Ignacio**. Nada está aprobado.
Última actualización: 2026-10-12.

## Fases
| Fase | Estado | Notas |
|---|---|---|
| P01 Producto, arte, arquitectura | Hecho (salvo vertical slice con DB) | Contratos, dominio, registry verificado, corpus, docs. El slice login → project → run → artefacto persistente en PostgreSQL se hace en P03 por decisión del usuario (avisar antes de BE/DB para preparar Render + Neon). |
| P02 Frontend Studio | En curso | Todas las pantallas sobre transporte FIXTURE (DEMO, en navegador). Publicación en GitHub Pages. |
| P03 Backend, DB, agentes | Pendiente — **esperando preparación de Render + Neon con el usuario** | Express 5, PostgreSQL + migraciones, sesiones, worker, ledger/reservas atómicas. |
| P04 Integración y proveedores | Pendiente | Retirar FIXTURE, HTTP transport, adaptadores Anthropic/Gemini, export servidor. |
| P05 QA | Pendiente | 10 escenarios núcleo + 14 V3, DB/Playwright, permisos, concurrencia financiera. |
| P06 Polish y entrega | Pendiente | Responsive/accesibilidad/performance, runbook (Hostinger + Render + Neon), capturas, guion de video. |

## Matriz real / simulado / conectado / pendiente
| Capacidad | Estado |
|---|---|
| Retrieval extractivo, citas con versión/página, abstención, inyección ignorada | **Implementado local** (dominio, testeado) |
| Estadísticas CSV, gap report, deck desde brief | **Implementado local** |
| Export MD/CSV/JSON/PDF/PPTX | **Implementado local** (en el preview corre en el navegador; en P04 desde el servidor con el mismo paquete) |
| Costos, normalización Anthropic, reservas, desconocido ≠ 0 | **Implementado local** (lógica); ledger del preview = **DEMO fixture** sintético |
| Persistencia, sesiones, worker, almacenamiento de archivos | **Pendiente** (P03) |
| Claude (Anthropic) | **Pendiente** de credenciales y presupuesto autorizados |
| Gemini | **Pendiente**; IDs y precios sin verificar (docs inaccesibles desde el entorno) |
| Visión / OCR / extracción de PDF | **Pendiente**; el preview lo informa y no lo simula |
| Despliegue Render / Neon / Hostinger | **Pendiente**, sin autorización ni cuentas configuradas |

## Comandos ejecutados (resultados reales)
- `pnpm --filter @atlas/domain test` → 30/30 ✓
- `pnpm --filter @atlas/demo-seed test` → 16/16 ✓
- `pnpm --filter @atlas/renderers test` → 6/6 ✓
- `pnpm --filter @atlas/web test` → 8/8 ✓ (transporte FIXTURE)
- `next build` (static export) ✓ · smoke en Chromium sin errores de consola

## Checkpoint para retomar
Rama `main`. Próximo paso exacto: integrar pantallas de los agentes A–E, `pnpm build:pages`, smoke en Chromium (360/768/1440), push a `main` y a `gh-pages`, informar URL, y **avisar antes de empezar P03** (Render + Neon + deploy Hostinger).
