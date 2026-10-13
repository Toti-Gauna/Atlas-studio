# Auditoría UX/UI y plan de 4 fases — Atlas Studio (preview P02)

**Fecha:** 2026-10-12/13 · **Estado:** **Fases 1–4 implementadas, requieren revisión de Ignacio** (Fase 1 en `main`; Fases 2–4 en la rama `ux/phases-2-4`).

**Decisiones de Ignacio:** arrancar con la Fase 1; la interfaz **queda en inglés** (las etiquetas en español de este documento son descriptivas). Nombres finales en la UI: Home, Chat, Projects, Sources, Deliverables, Inbox (Reviews · Support · Sensitive data), Agents, Workflows, Admin › Usage & costs, Privacy, Activity, Quality, Settings; Guided tours en la barra de demo.

## 1. Diagnóstico en una frase

Atlas tiene un buen motor de producto (respuesta con evidencia, abstención honesta, entregables versionados, control de costos) presentado **desde la arquitectura del sistema y no desde la tarea del usuario**. Por eso al entrar uno se siente perdido: 15 destinos con el mismo peso, ocho avisos de "demo" en la primera pantalla, vocabulario de ingeniería y ningún "empezá acá".

## 2. Método y evidencia

- **97 capturas reales** del build publicado (Chromium): 22 rutas × 360/768/1440 + 31 estados de interacción (`e2e/audit-flows.mjs`): login, chat con respuesta, abstención, modelo bloqueado, comparación, panel de evidencia, entregable y edición, paleta ⌘K, preview states, error/vacío, rol Viewer, modo oscuro, móvil 375.
- **3 auditorías independientes** sobre capturas + código con los mismos criterios (orientación/IA, flujos, jerarquía, microcopy, consistencia, señales de "AI slop", presentación de la confianza, accesibilidad/responsive, heurísticas de Nielsen) y severidad S1 (bloquea) → S4 (detalle). Informes completos en [`docs/ux-audit/`](ux-audit/):
  - [Entrada, shell e IA](ux-audit/report-1-entrada.md) — IDs `E01–E30`
  - [Ciclo núcleo: chat → evidencia → entregable → revisión](ux-audit/report-2-nucleo.md) — IDs `N01–N34`
  - [Construir y operar: agentes, workflows, uso, privacidad, soporte, ajustes](ux-audit/report-3-control.md) — IDs `C01–C30`
- **Métricas de código** (`apps/web/src`).

| | S1 | S2 | S3 | S4 | Total |
|---|---|---|---|---|---|
| Hallazgos | 6 | 47 | 37 | 4 | **94** (algunos se repiten entre áreas, p. ej. E19 = N08) |

| Métrica de código | Hoy |
|---|---|
| Ítems en el sidebar (Admin) | 15 + 4 recientes = 19 enlaces |
| `<Badge>` / `<DemoTag>` / `<Callout>` | 121 / 28 / 52 |
| Usos del estilo `eyebrow` (mono, mayúsculas) | 38–44 |
| Estilos inline (`style={{…}}`) | 169 |
| Colores hex sueltos en CSS modules | 31 |
| "no provider charge" / "DEMO fixture" / "never …" repetidos | 9 / 6 / 14 |

## 3. Los primeros 60 segundos (hoy)

1. Landing clara ("Answers you can trace. Deliverables you can ship."). ✅
2. "Start demo workspace" → **otra** tarjeta "Start demo workspace" sobre un shell a medio pintar (E02, E03).
3. Segundo clic → aterrizás como **Admin**: 19 enlaces, 8 señales de demo ("DEMO DEMO" incluido), "Good evening, Demo." gigante, CTA deshabilitado, los mismos 4 proyectos 3 veces (E04, E08, E10, E13).
4. Nada dice qué hacer primero; los tours guiados están en la posición 9 del menú (E07).
5. Para ver la primera respuesta citada hay que escribir, "Continue in chat" y **volver a enviar** (E09).
6. En móvil el menú se abre **vacío** (E01, confirmado: `.sidebar{display:none}` también se aplica dentro del sheet).

**Objetivo:** landing → 1 clic → Home con sesión creada y "Empezá acá" → 1 clic → respuesta citada con evidencia. Valor en < 20 s.

## 4. Siete causas raíz (lo que genera la sensación de "AI slop")

| # | Causa | Ejemplos | Hallazgos |
|---|---|---|---|
| R1 | **Navegación plana sin capas de audiencia** | 15 destinos iguales; 9 son de construcción/administración; Showcase en "Build"; Help desk junto a FinOps; Settings con 6 pestañas para cualquier rol | E04–E07, E18, C14, C18, C24 |
| R2 | **Telemetría e IDs internos como contenido** | `coverage 1 / threshold 0.6`, `chunk 0`, BM25, idempotency key, `seed:profile`, `wfr_seed_csv`, hashes, `req_demo_…`, "branch", FIXTURE | N03, N05, N09, N19, C07, C16, C17, C19 |
| R3 | **La confianza repetida hasta volverse ruido** | Mismo aviso 4× en Uso, 4× en Showcase, regla de versionado 5×, "nothing runs until you send" 4× por pantalla, DEMO en cada fila | E13, N13, N26, C03, C15, C22 |
| R4 | **Plantilla genérica en cada pantalla** | eyebrow mono + H1 + descripción de 2–4 líneas que justifica la política + DemoTag; grillas uniformes de 3 tarjetas con 5–7 badges | E26, E28, N14, C13, C29 |
| R5 | **Sin acción primaria por pantalla** | No existe "respuesta → informe"; en un documento lo más visible es "Delete"; 5 exportaciones del mismo peso; pedir revisión en 6 clics | N01, N21, N28, N29, C09 |
| R6 | **Un objeto, varios nombres** | Deliverables/Artifacts, Run/Runs/Run history/Attempts, Help desk/Inbox, Sources/Library, Chats/Conversations, Admin/Owner | E05, N24, C18, C21 |
| R7 | **Componentes duplicados y responsive de escritorio** | 3 estilos de "volver", 2 Plan preview, 4 mapas de estados, bug `.table th`, tablas que se cortan a 360, tabs sin indicador de scroll, 4 columnas en el chat | C10, C25, C28, C30, N20, E19 |

## 5. Los seis bloqueantes (S1)

| ID | Problema | Arreglo |
|---|---|---|
| E01 | Menú móvil vacío | El sheet no hereda `display:none`; test e2e a 375 px |
| E04 | 15 destinos al mismo nivel, Admin por defecto | Nueva IA (sección 7) |
| E07 | No hay "empezá acá"; tours escondidos | Bloque de inicio en Home + "Tour guiado" en el banner |
| N01 | No se puede convertir una respuesta en entregable | Acción primaria "Crear informe ▾" en cada respuesta citada |
| C01 | Uso no responde "¿cómo voy contra el presupuesto?" | Presupuesto primero; ledger abajo/colapsado |
| C07 | Monitor de workflow expone claves internas | IDs a "Detalles técnicos"; runs con fecha y persona |

## 6. Qué conservar (no tocar el corazón)

- Panel de evidencia: página exacta, frase resaltada, aviso de versión citada ≠ publicada. **El mejor momento de la app.**
- Abstención + "Ask a person" → ticket con "Handoff context".
- Modelo bloqueado que conserva el borrador; nada de fallback silencioso.
- Versionado real de entregables (aprobación ligada a versión, conflicto, fuentes por versión) y de agentes (diff).
- Plan preview antes de ejecutar; checkpoints reanudables; costo "desconocido ≠ 0".
- Cola de privacidad (la pantalla con mejor foco), landing con hero y sección "What is real".
- Base técnica: copy centralizado en `copy/*.ts`, ⌘K accesible, estados centralizados, `aria-live`, reduced motion, paleta teal/violeta disciplinada, Home simplificado del rol Customer (modelo a seguir).

## 7. Arquitectura de información objetivo

```
Banner (única señal demo):  Demo · Corvid Freight (ficticio) · Ver como: Admin ▾ · Tour guiado · Qué es real
Sidebar
  Inicio
  Chat                 (también botón primario "New chat" arriba)
  Proyectos            (Resumen · Fuentes · Conversaciones · Entregables · Memoria — pestaña en la URL)
  Fuentes
  Entregables
  Bandeja  (badge)     (Revisiones · Soporte · Datos sensibles — según rol)
  ── Construir
  Agentes
  Workflows
  ── Administración    (plegada; oculta sin permisos)
  Uso y costos · Privacidad y consentimiento · Actividad (= Run history) · Calidad (= Evaluations) · Ajustes
Fuera del menú: Showcase → "Tour guiado" (banner + Inicio) · Preview states → ?preview=1
```

- 15 → **6 primarios + 2 de construcción**; administración plegada.
- **Un nombre por objeto**, idéntico en menú, H1, breadcrumb, botón volver y ⌘K (glosario en Fase 1).
- Cada rol ve solo lo que puede hacer (hoy el Viewer ve un compositor que no puede usar, E12; Customer ve Settings de admin, C24).

## 8. Plan de 4 fases

Cada fase termina con: lint/typecheck/tests verdes, `e2e/routes.mjs` (22 rutas × 3 anchos: 0 errores, 0 overflow), recaptura con `e2e/audit-flows.mjs` y comparación antes/después, deploy a Pages y **revisión de Ignacio** antes de pasar a la siguiente.

### Fase 1 — Orientación: entrada, navegación y capa demo
*Que nadie se pierda en el primer minuto.*

- **Bloqueantes técnicos:** menú móvil (E01); bug `.table th` → solo `thead th` (C25); sidebar en rail entre 768–1279 sin forma de expandir (E18).
- **Una sola puerta:** el CTA de la landing crea la sesión y entra; rol y sesión sobreviven a la recarga (sessionStorage); fuera la puerta duplicada y el shell a medias (E02, E03, E24, E25).
- **Nueva IA** (sección 7) en `nav.ts`, Bandeja unificada con badge, Administración plegada, Settings con gating real por rol (E04–E06, C24).
- **Glosario y renombrado** en nav, H1, back links, ⌘K: Entregables, Fuentes, Actividad, Soporte, etc. (E05, N24, C18, C21).
- **Capa demo consolidada en el banner:** "Ver como: rol ▾" con explicación de cada rol, "Tour guiado", "Qué es real"; fuera FIXTURE, "ECLIPSE DEMO", "DEMO DEMO", los 28 DemoTag de página y el botón Local duplicado; Preview states tras `?preview=1` (E13–E17, E27, C27).
- **Home "Empezá acá":** H1 de tarea, compositor con selector de proyecto compacto, **envío directo** (sin segundo envío), 3 tours + 3 preguntas de ejemplo de un clic, Home por rol, sin proyectos triplicados (E07–E12).

**Criterios de éxito:** landing → respuesta citada en ≤ 2 clics · menú visible ≤ 8 ítems para Admin · 1 señal demo por pantalla · 0 diferencias de nombre entre menú/H1/back · test e2e del menú móvil.

### Fase 2 — Sistema y voz: componentes y recorte editorial
*Que toda la app parezca hecha por una sola persona, y hable como el usuario.*

- **Componentes:** `PageHeader` sin eyebrow decorativo, con `back`/breadcrumb y una línea de descripción (E28, C28, C29); `StatusBadge` con diccionario único de estados (C30); un único `PlanPreview` (C10); `TechDetails` (acordeón "Detalles técnicos") para IDs, hashes, coverage, tokens (R2); patrón **lista apilada < 768 px** para tablas; tabs/segmented con fade de scroll o select en móvil (N17, N20, C26).
- **Reglas de badges:** solo excepciones (no "Ready", "Memory on", "Owner"), máximo 3 por cabecera; DEMO nunca por fila (N14, N16, N21, N27).
- **Recorte editorial de los 14 archivos `copy/*.ts`:** un aviso por contexto; descripciones de 1 línea orientadas a la tarea; fuera jerga (coverage/threshold, chunk, BM25, idempotency, branch, API worker, pending backend, Claude Max/ChatGPT); errores con título específico y salida accionable; plurales con `Intl.PluralRules` (N03, N05, N13, N23, N26, N33, C03, C04, C22, E21, E22).
- **Tokens:** eliminar los 31 hex sueltos y ~80 % de los 169 estilos inline; contraste en oscuro (burbuja de usuario, `--line`) (N32); paleta de proyectos sin reutilizar warn/violeta (N15); skeletons por tipo (E23); targets ≥ 32 px (E30).
- **Idioma:** la interfaz queda en inglés (decisión de Ignacio); el recorte editorial se hace sobre el copy en inglés.

**Criterios:** 0 términos de la lista negra en copy visible (chequeo por grep en CI) · eyebrows de página 0 · DemoTag ≤ 1 por pantalla · Callouts −60 % · estilos inline < 40 · contraste AA en ambos temas.

### Fase 3 — El ciclo de valor: preguntar → evidencia → entregable → revisión
*Que la promesa del producto se recorra sin adivinar.*

- **Chat:** acción primaria "Crear informe ▾ (informe/tabla/deck)" en cada respuesta citada, precargada con pregunta y citas (N01); modo visible como chips "Responder · Redactar entregable"; agente/modelo en un "Configuración" plegado (N02); `[S1]` clicable en el texto (N10); acciones secundarias en "⋯" ("Editar pregunta", "Regenerar", "Copiar con citas") (N05); historial que se colapsa al abrir la evidencia (N08/E19); estado vacío con 3 preguntas de ejemplo (N12); composer móvil compacto (N34).
- **Demo que no falla:** modelos pendientes deshabilitados con motivo antes de enviar (N06); Compare con dos modelos disponibles y la pregunta correcta (N07); timestamps coherentes (N11).
- **Fuentes y documento:** CTA "Preguntar sobre este documento"; Reindex/Delete a "⋯"; CSV abre en perfil/tabla; buscador con etiqueta visible (N19, N21, N22).
- **Entregables:** "Crear entregable" en la lista; barra superior con "Exportar PPTX" (formato nativo) + "Otros formatos", "Pedir revisión" en un paso (popover) y "Compartir"; lateral con pestañas Comentarios/Historial; editor con lista de diapositivas + preview y "Guardar como v2" sticky (N25, N27–N30).
- **Bandeja/Revisiones** como lista de tareas con "Revisar" (N31); proyectos con resumen útil (objetivo, últimas conversaciones, entregables en curso) (N16, N18).

**Criterios:** pregunta → informe → revisión pedida en ≤ 4 clics sin volver a preguntar (hoy ≥ 5 + reenvío, y 6 solo para pedir revisión) · exportar PPTX en 1 clic desde el entregable · smoke e2e del ciclo completo.

### Fase 4 — Superficies de control y pulido final
*Que las pantallas de administración respondan su pregunta en el primer viewport, y cerrar calidad.*

- **Uso y costos:** franja de presupuesto primero (gasto/límite/estado), 2–3 KPIs de negocio, gráfico; ledger y tokens en "Detalle técnico"; filtros con alcance claro; filtros en sheet en móvil (C01–C06).
- **Soporte:** por defecto "abiertos + esperando", resumen "2 sin responder · 1 sin asignar", pestañas Tickets/Solicitudes (C20, C21).
- **Agentes:** built-ins como ficha de lectura con "Usar en chat" / "Duplicar"; editor Básico/Avanzado (temperatura, tokens, límites solo admin) (C11–C13).
- **Workflows:** "Revisar y ejecutar" con solo los inputs de la receta; runs nombrados por fecha y persona; motivo de pausa y "Reanudar"; "Te necesita" destacado (C07–C09).
- **Actividad, Calidad, Privacidad, Ajustes:** resultado primero en Calidad (C19); objetivos realistas en Actividad y paginación (C16, C17); "Datos sensibles por revisar" con Redactar + deshacer (C23); modelos como tarjetas (C26).
- **Landing:** captura/video real del flujo pregunta → cita → entregable en lugar de una de las grillas; descargos concentrados en "What is real" (E26).
- **Pulido:** ⌘K con acciones primero y búsqueda de documentos/entregables (E29); scroll del documento en vez de contenedor interno (E30); revisión de motion; auditoría de accesibilidad (teclado, foco, lector) y repetición completa de esta auditoría para medir el antes/después.

**Criterios:** cada pantalla de datos responde su pregunta en el primer viewport a 1440 y 360 · 0 IDs internos fuera de "Detalles técnicos" · repetición de la auditoría sin S1 ni S2 abiertos.

## 9. Por qué este orden

1. **F1 primero** porque la orientación condiciona todo lo demás: sin IA y entrada claras, mejorar pantallas sueltas no cambia la sensación de estar perdido.
2. **F2 antes que las pantallas** porque la mayoría de los hallazgos son instancias de las mismas 7 causas raíz; arreglarlos en componentes y copy limpia las 22 rutas a la vez y evita rehacer trabajo en F3/F4.
3. **F3** es lo que el comprador evalúa en la demo; **F4** son superficies de control que pesan en la decisión de compra pero se visitan menos.
4. El plan **no cambia el dominio ni los contratos**: todo es `apps/web` (menú, componentes, copy, vistas), así que no bloquea ni se bloquea con P03 (Render + Neon).

## 10. Fase 1 — resultado (implementada, requiere revisión de Ignacio)

| Criterio | Antes | Después |
|---|---|---|
| Landing → respuesta citada | 4+ clics y doble envío, con una segunda "puerta" | **2 clics** ("Try the demo" → pregunta de ejemplo), verificado por `e2e/smoke.mjs` |
| Destinos visibles en el menú (Admin) | 15 + 4 proyectos recientes | **8** + grupo Admin plegado (5) |
| Menú en móvil | vacío | 8 destinos visibles + Admin |
| Señales de demo en Home | 8 ("DEMO DEMO", FIXTURE, ECLIPSE DEMO…) | **1** barra: `DEMO · Corvid Freight · fictional company and data` |
| `<DemoTag>` en páginas | 28 | 3, solo en costos y ejecuciones sintéticas (Usage, Activity, Run trace) — se mantiene la regla "costos fixture etiquetados DEMO" |
| Nombre menú = H1 | 3 diferencias (Deliverables/Artifacts, Run history/Runs, Privacy/Privacy Center) | 0 (24 rutas verificadas) |
| Eyebrows decorativos en páginas de primer nivel | 11 | 0 (quedan 6 en detalle; pasan a breadcrumb en Fase 2) |

**Qué cambió**
- **Una sola puerta:** entrar a `/app` crea el workspace demo; el rol elegido sobrevive a la recarga (sessionStorage). Login de empresa plegado en el preview.
- **Navegación:** Home, Chat, Projects, Sources, Deliverables, **Inbox** (badge) · Build: Agents, Workflows · **Admin** plegado: Usage & costs, Privacy, Activity, Quality, Settings. Sin proyectos recientes duplicados. En tablet el rail tiene botón para expandir.
- **Inbox unificado** (`/app/inbox/?tab=reviews|support|privacy`): revisiones, tickets y datos sensibles según el rol; `/app/reviews/` redirige. Privacy conserva escáner, consentimientos y política, y enlaza a la cola.
- **Barra de demo única:** Guided tours, What's real (modal con lo real/pendiente), **View as: rol ▾** con descripción de cada rol. Preview states solo con `?preview=1`. Topbar: búsqueda, **New chat**, tema.
- **Home "What do you need to get done?":** compositor con proyecto, **envío directo** al chat; bloque **Start here** (3 preguntas que responden con cita en un clic + 3 tours); sugerencias con "Uses …" en lenguaje natural; Needs attention con Inbox y presupuesto; Home de lectura para Viewer.
- **Settings:** Models, Providers, Routing y Audit solo para Admin; Customer no ve Settings.
- **Bugs:** menú móvil vacío; encabezados de fila de tablas en mayúsculas grises; plurales ("1 deliverable").

**Verificación (resultados reales):** `pnpm -r lint` ✓ · `pnpm -r typecheck` ✓ · tests 30 + 16 + 6 + 8 ✓ · `pnpm build:pages` ✓ · `e2e/smoke.mjs` 9/9 ✓ · `e2e/routes.mjs` 24 rutas × 360/768/1440: 0 errores de consola, 0 overflow.

**Queda para fases siguientes:** datos técnicos en mensajes de chat (coverage/threshold), badge Local por mensaje, eyebrows de detalle, estados de error/vacío (F2); acción "respuesta → entregable" y layout de 4 columnas del chat (F3); búsqueda de documentos en ⌘K y pantallas de Admin (F4). Las URLs internas (`/artifacts`, `/library`, `/runs`, `/evaluations`) no cambiaron para no romper enlaces.

## 11. Fases 2–4 — resultado (implementadas, requieren revisión de Ignacio)

| Criterio | Antes | Después |
|---|---|---|
| Pregunta → entregable | ≥ 5 clics y volver a preguntar | **3 clics** (pregunta de ejemplo → "Create deliverable ▾" → Deck), sin reescribir; `e2e/loop.mjs` |
| Exportar el formato nativo | 5 botones iguales | **1 clic**: "Export PPTX/PDF/CSV" según el tipo + "Other formats" |
| Pedir revisión | 6 clics en 2 pasos | popover de un paso (elegir revisor → Send) |
| Jerga visible (coverage/threshold, BM25, chunk, idempotency, branch, hash, FIXTURE…) | presente en 9 pantallas | **0** — `scripts/check-copy.mjs` corre en CI; el detalle vive en "Technical details" (11 usos) |
| Mapas de estado duplicados | 8 (RUN_TONE, STATUS_TONE, COST_TONE…) | 1 diccionario `StatusBadge` (24 usos) |
| Tablas en móvil | se cortaban | 17 tablas apiladas como tarjetas < 768px |
| Estilos inline / hex sueltos | 169 / 31 | 50 / 7 (marca, meta theme-color, ilustración del hero) |
| `<Badge>` | 121 | 49 |
| Accesibilidad (axe, 20 rutas × claro/oscuro) | sin medir | **0 violaciones serias o críticas**; `e2e/a11y.mjs` |

**Fase 2 — sistema y voz:** `PageHeader` con `back` (un solo estilo de "volver"), `StatusBadge`, `TechDetails`, `Table stack`, `PlanPreview` único para agentes y workflows, menú/popover compartido, tokens categóricos para proyectos, burbuja de usuario y bordes legibles en oscuro, contraste del botón primario deshabilitado, estados de error con título claro y detalle plegado, esqueletos por tipo, recorte editorial de los 14 archivos de copy.

**Fase 3 — ciclo de valor:** "Create deliverable ▾" en cada respuesta citada (informe/tabla/deck construidos solo con la respuesta y sus citas, sin modelo; fuentes con versión y página); modos visibles en el composer y "Settings" plegado; "Backed by N sources" / "Not enough evidence"; `[S1]` clicable; modelos no conectados deshabilitados con motivo; Compare deshabilitado con motivo cuando hay un solo modelo conectado; el historial se pliega con el panel abierto; chat nuevo con 3 preguntas de ejemplo; documento con "Ask about this document" y panel "About this document"; CSV abre en perfil y tabla; proyectos con pestaña en la URL y Overview útil; entregables con barra de acciones, revisión en un paso, comentarios/historial en pestañas, editor con lista de diapositivas, vista previa y guardado fijo; Inbox › Reviews como lista de tareas; decisión de admin rotulada cuando decide por otro revisor.

**Fase 4 — superficies de control y pulido:** Usage empieza por presupuestos (estado por presupuesto), 3 KPIs de negocio y detalle técnico plegado; un solo aviso DEMO; Workflows con "Needs you", ejecuciones nombradas por fecha · persona · objetivo (quién la pausó y cuándo), "Review & run" con el plan en el mismo panel; Agents con fichas de lectura para los integrados ("Use in chat" / "Duplicate") y editor Básico/Avanzado; Activity con objetivos realistas, una nota DEMO y paginación; Quality con el último resultado primero; Support con resumen y filtro "Open and waiting"; Privacy con una frase de detección y decisiones con confirmación; Settings con modelos como tarjetas; landing con captura real del producto (`e2e/capture-landing.mjs`) y sin copy defensivo; ⌘K con acciones primero y búsqueda de fuentes y entregables.

**Verificación (resultados reales):** `pnpm -r lint` ✓ · `pnpm -r typecheck` ✓ · `node scripts/check-copy.mjs` ✓ · tests 32 + 16 + 6 + 13 ✓ · `pnpm build:pages` ✓ · `e2e/smoke.mjs` 9/9 ✓ · `e2e/loop.mjs` 7/7 ✓ · `e2e/routes.mjs` 24 rutas × 360/768/1440 sin errores ni overflow ✓ · `e2e/a11y.mjs` 0 violaciones serias/críticas ✓.

**No hecho / parcial (con motivo):**
- *E30 scroll del documento:* se mantiene el scroll en el contenedor principal; cambiarlo afecta el layout del chat y los paneles laterales con riesgo alto para un beneficio menor (barra del navegador en móvil). Queda como mejora futura.
- *Deshacer al redactar (C23):* no existe endpoint de deshacer; el aviso explica que el original queda en el historial de versiones.
- *Compare models:* el demo tiene un solo modelo conectado (Atlas Local); la acción aparece deshabilitada con el motivo en lugar de fallar.
- *Preferencias personales en Settings › Profile (N18):* renombradas ("Your preferences in every project") pero siguen en la pestaña Memory del proyecto.
- *URLs internas* (`/artifacts`, `/library`, `/runs`, `/evaluations`) sin cambios para no romper enlaces.
