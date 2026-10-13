# Estado — Atlas Studio Premium V3

**Estado global:** Construcción · P02 (frontend) publicado como preview · P03 en espera · **requiere revisión de Ignacio**. Nada está aprobado.
Última actualización: 2026-10-12.

## Fases
| Fase | Estado | Notas |
|---|---|---|
| P01 Producto, arte, arquitectura | Hecho (salvo vertical slice con DB) | Contratos, dominio, registry verificado, corpus, docs. El slice login → project → run → artefacto persistente en PostgreSQL se hace en P03 por decisión del usuario (avisar antes de BE/DB para preparar Render + Neon). |
| P02 Frontend Studio | Hecho (preview) | 22 rutas sobre transporte FIXTURE (DEMO, en navegador), verificadas en Chromium a 360/768/1440 sin errores de consola ni scroll horizontal. Publicado en GitHub Pages. |
| UX F1 Orientación | Hecho (en `main`) — **requiere revisión de Ignacio** | Una sola puerta, nueva navegación con Inbox y Admin plegado, barra de demo única, Home "Start here" con envío directo. `docs/ux-audit.md` §10. |
| UX F2–F4 Sistema, ciclo de valor, control | Hecho en rama `ux/phases-2-4` (PR) — **requiere revisión de Ignacio** | Componentes y voz unificados, respuesta → entregable en 3 clics, pantallas de admin por pregunta, accesibilidad axe sin violaciones serias. `docs/ux-audit.md` §11. |
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
- `pnpm --filter @atlas/domain test` → 32/32 ✓
- `pnpm --filter @atlas/demo-seed test` → 16/16 ✓
- `pnpm --filter @atlas/renderers test` → 6/6 ✓
- `pnpm --filter @atlas/web test` → 13/13 ✓ (transporte FIXTURE + respuesta → entregable)
- `pnpm -r lint` ✓ · `pnpm -r typecheck` ✓
- `pnpm build:pages` (static export, 25 páginas) ✓
- `node e2e/routes.mjs` → 24 rutas × 3 anchos (72 vistas): 0 errores de consola, 0 overflow horizontal
- `node e2e/smoke.mjs` → 9/9 checks de orientación (landing → respuesta citada en 2 clics, menú móvil, rol Viewer) ✓
- `node e2e/loop.mjs` → pregunta → deck → export PPTX → revisión pedida → aparece en Inbox ✓
- `node e2e/a11y.mjs` → 20 rutas × claro/oscuro: 0 violaciones serias o críticas (axe-core 4.10.2) ✓
- `node scripts/check-copy.mjs` → 0 términos de ingeniería en textos visibles ✓

## Limitaciones conocidas del preview
- Datos en memoria del navegador: se reinician al recargar o al abrir una URL directa (el workspace demo se recrea solo, con el último rol elegido).
- Retrieval local léxico: preguntas con sinónimos que no aparecen en el corpus pueden abstenerse (comportamiento honesto, no un error).
- Subida de PDF no extrae texto en el preview (lo hará el worker en P03); imágenes: visión pendiente de proveedor.

## Checkpoint para retomar
Rama `main`. P02 publicado. **Próximo paso: P03 — esperando al usuario para preparar Render (API/worker) y Neon (PostgreSQL aislado), y definir el deploy del frontend en Hostinger.**
