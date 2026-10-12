# Sistema de diseño — "calma editorial, precisión tecnológica"

## Paleta (tokens en `apps/web/src/styles/tokens.css`)
| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--ink` / `--pearl` | #0B1220 / #F5F7FA | — | Marca; mensajes del usuario, banner demo, superficie de lectura |
| `--teal` | #19B6A4 | #19B6A4 | Relleno de acción primaria (texto ink ≈7.4:1), foco, chips de evidencia |
| `--teal-ink` | #0B6F65 | #3FD0BD | Texto/íconos teal sobre superficies (≈5.6:1 sobre blanco) |
| `--violet` / `--violet-ink` | #8278D8 / #5248AD | #AAA3EE | Solo agentes y entregables (glyphs, borde de artefacto) |
| `--bg`, `--surface`, `--surface-2/3`, `--line`, `--line-strong` | neutros fríos | neutros ink | Fondo, paneles, hairlines |
| `--ok/--warn/--danger/--info` + `-soft` | | | Estados |

El área de lectura de documentos y entregables se mantiene clara (pearl) también en modo oscuro.

## Tipografía (autoalojada vía @fontsource, licencia OFL)
- Display: **Manrope Variable** (títulos, números grandes).
- Cuerpo: **Source Sans 3 Variable** (humanista).
- Datos: **JetBrains Mono Variable** — solo IDs, versiones, páginas, hashes, eyebrows.
Escala: 11/12/13/14/15/16/18/22/28/36/48/64 px.

## Espaciado, radios, elevación
Espacios 4/8/12/16/24/32/48/64. Radios 6/10/14/20. Hairline primero; sombras solo en capas flotantes (modal, sheet, toast, hero).

## Layout
- Studio: sidebar 260 px (rail 64 px colapsable) · conversación flexible · panel derecho 380 px (evidencia/traza) o canvas `min(560px, 46vw)`.
- < 1280 px: sidebar en rail y panel derecho como sheet (dos vistas). < 768 px: pantalla única, navegación y panel en drawers.
- Marketing: retícula de 12 columnas implícita, hero dividido copy/escena.

## Componentes (`apps/web/src/components/ui`)
Button (primary teal/ink/secondary/ghost/danger), IconButton, LinkButton, TextField, TextArea, Select, Switch, Segmented, Badge, DemoTag, ModeBadge (Local/Connected/Pending), Kbd, Card, PageHeader, SectionHead, Stat, Table, Tabs/TabPanel (teclado), Avatar, AgentGlyph, ArtifactIcon, CitationChip (lenguaje único de evidencia), Callout, Meter (gastado + reservado), DescList, Modal y Sheet (sobre `<dialog>` nativo: foco, Esc, fondo inerte), Toast (aria-live), estados `QueryState`/`LoadingBlock`/`EmptyState`/`ErrorState` (mapea FORBIDDEN, NETWORK, PROVIDER_DISCONNECTED).

## Estados obligatorios por pantalla
loading (skeleton estático, sin shimmer ni progreso inventado) · empty (con CTA) · error (con reintento y requestId) · forbidden (rol) · offline · proveedor desconectado. En el preview se fuerzan desde **Preview states** (banner superior).

## Motion (GSAP 3.15 + @gsap/react, `lib/motion.ts`)
| Escena | Duración | Implementación |
|---|---|---|
| Hero pregunta → fuente → entregable | ≈850 ms, una vez | `features/landing/HeroScene.tsx` (timeline + stroke-dashoffset) |
| Selección de agente | 200 ms | `features/chat/AgentPicker.tsx` |
| Drawer / canvas / modal | 240 ms | `RightPanel`, `Sheet`, `Modal` |
| Cards de recomendaciones | 280 ms + stagger 50 ms | `features/chat/Recommendations.tsx` |
| Paso de workflow | 220 ms al cambiar `currentStepKey` del servidor | `features/workflows` |
Reglas: `useGSAP` con `scope` (cleanup automático), guard `useReducedMotion()` (render instantáneo), sin loops, sin scroll secuestrado, nada animado que oculte controles. CSS global también anula transiciones con `prefers-reduced-motion`.

## Copy
Inglés, centralizado en `apps/web/src/copy/*.ts`. Marca blanca en `config/brand.ts`; moneda y zona IANA vienen del workspace (`lib/format.ts`).
