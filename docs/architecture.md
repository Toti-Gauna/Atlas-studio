# Arquitectura

## Monorepo (pnpm)

```
apps/web           Next.js 16 (App Router) exportado estático. Solo cliente: sin API routes, Server Actions ni SSR runtime.
apps/api           (P03) Express 5 + worker Node, PostgreSQL con migraciones.
packages/contracts Esquemas zod de entidades/requests + catálogo formal de rutas (rol y requisito por ruta).
packages/domain    Lógica pura y determinista compartida: dinero en nano-USD, normalización de usage, costos,
                   reservas, detectores de privacidad, CSV, retrieval local, routing, permisos, perfiles de agentes,
                   recomendaciones y generadores locales (gap report, data report, outline de presentación).
packages/renderers Exportadores estructurados MD/CSV/JSON/PDF (pdf-lib) /PPTX (pptxgenjs). Nunca ejecutan HTML/JS del modelo.
packages/demo-seed Corpus sintético "Corvid Freight" (DEMO): 8 documentos + 1 PDF escaneado fallido, CSV, imagen original,
                   personas, proyectos, workflows, conversaciones y 12 casos de evaluación.
```

Versiones verificadas en npm el 2026-10-12: Next 16.3.8, React 19.3.0, TypeScript 6.0.3 (typescript-eslint soporta < 6.1), GSAP 3.15.0, @gsap/react 2.1.2, TanStack Query 5.104.2, zod 4.6.6, Vitest 5.0.3, Playwright 1.64.0, pdf-lib 1.17.1, pptxgenjs 4.0.1.

## Frontend estático
- Rutas de entidad con query string (`/app/artifact/?id=…`), nunca segmentos dinámicos.
- `NEXT_PUBLIC_BASE_PATH` para GitHub Pages (`/Atlas-studio`); vacío para Hostinger.
- `NEXT_PUBLIC_DATA_MODE`: `fixture` (preview P02) o `api` (P04+, `NEXT_PUBLIC_API_URL`). Ningún secreto en variables públicas.
- Transporte único (`lib/api/transport.ts`): `httpTransport` (cookies HttpOnly + header CSRF) o `fixtureTransport`.
- **FIXTURE (temporal, P02)**: `lib/fixture/*` implementa el contrato en el navegador usando la lógica real de `@atlas/domain`, aplica sesión/rol como lo hará el servidor y etiqueta todo DEMO. Se retira al cerrar P04.

## Backend (P03 — diseño)
- Express 5: middlewares requestId, logger sin payload sensible, rate limit, CORS con origen exacto, cookie de sesión `HttpOnly; Secure; SameSite=None` (front y API en dominios distintos) + token CSRF por sesión.
- Cada handler: `requireSession` → `requireAction(role, action)` (`@atlas/domain/permissions`) → consulta con `workspace_id = session.workspace_id` (nunca del cliente) → validación zod de entrada/salida.
- Worker: tabla `jobs` con lease (`locked_until`), reintentos con backoff, `max_attempts`, claves de idempotencia por efecto (ingesta, pasos de workflow, exportes).
- Storage de archivos: interfaz `BlobStore` (disco local en dev; S3-compatible/R2 en producción). Nunca disco efímero de Render como almacén permanente.
- Proveedores: interfaz `ModelProvider` (local extractivo, Anthropic con `@anthropic-ai/sdk`, Gemini pendiente de verificación). Llamadas reales solo con credenciales y presupuesto autorizados.

## Modelo de datos (PostgreSQL)
Núcleo: workspaces, users, memberships(role), sessions, documents, document_versions, chunks, ingestion_jobs, conversations, branches, messages, citations, retrieval_traces, feedback, tickets, ticket_replies, tool_proposals, tool_executions, service_requests, evaluation_suites/cases/runs/case_results, audit_events.
V3: projects, memory_items, memory_consents, agent_definitions, agent_versions, model_registry, model_price_versions, routing_policies, runs, run_steps, run_attempts, suggestions(dismissals), artifacts, artifact_versions, artifact_sources, artifact_shares, review_requests, review_comments, workflow_definitions, workflow_versions, workflow_runs, workflow_checkpoints, cost_ledger, budgets, budget_reservations, privacy_policies, redaction_reviews, external_transfer_consents, showcase_scenarios.

Restricciones clave:
- Toda tabla de negocio lleva `workspace_id NOT NULL` + índice compuesto; FKs con el mismo workspace.
- `document_versions`: único `(document_id, version)`; índice parcial único `(document_id) WHERE published`.
- `cost_ledger`: único `(provider, provider_request_id)` cuando no es null (dedupe del mismo evento); importes `numeric(30,0)` en nano-USD; `cost_status` enum; costo null ⇔ status unknown.
- `budgets`: reserva atómica `UPDATE … SET reserved = reserved + $1 WHERE id = $2 AND spent + reserved + $1 <= limit` (o sin condición si no es hard stop) dentro de la transacción del intento.
- `artifact_versions`: único `(artifact_id, version)`; aprobación referenciada por `review_requests(artifact_version_id)`.
- `tool_proposals`: estado + `expires_at`; confirmación con `UPDATE … WHERE status='pending' AND expires_at > now()` (one-shot).
- `messages`: único `(conversation_id, client_message_id)` para envíos idempotentes.

## Permisos
Matriz en `packages/domain/src/permissions.ts` (admin, editor, reviewer, operator, viewer, customer) + roles por artefacto (owner/editor/reviewer/viewer). El visitante demo es admin **de su propio workspace aislado**, nunca owner global. El cambio de rol emite una nueva sesión del servidor.

## Despliegue objetivo
Frontend estático (Hostinger; preview en GitHub Pages) · API/worker en Render · PostgreSQL Neon aislado (no compartido con Handy) · storage S3-compatible. Ver `docs/runbook.md` (P06).
