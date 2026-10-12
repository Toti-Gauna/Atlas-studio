# Atlas Studio Premium V3 — Alcance y trazabilidad

Fuente: ficha Notion "D04 — Atlas Studio — Agentes, artefactos y FinOps — Premium v3" y "00 — Estándar Eclipse Premium" (leídas íntegras el 2026-10-12). Repo: `Toti-Gauna/Atlas-studio` (la ficha lo nombra `eclipse-demo-ai-desk`).

Estado de cada fila: **L** implementado local (lógica real, verificada con tests), **F** visible en el preview de frontend sobre transporte FIXTURE en el navegador (se reemplaza por la API en P04), **P** pendiente.

## Matriz requisito → pantalla → entidad → endpoint → prueba

| Req | Pantalla(s) | Entidades | Endpoints (contrato) | Pruebas actuales | Estado |
|---|---|---|---|---|---|
| Núcleo: ingesta y versionado | Sources, Document | Document, DocumentVersion, Chunk, IngestionJob | `POST /documents`, `GET /documents/:id/status`, `POST /documents/:id/reindex`, `DELETE /documents/:id` | `demo-seed/test/corpus.test.ts` (chunking), fixture tests | L (dominio) · F · P (worker/DB) |
| Núcleo: retrieval + citas + abstención | Chat, Evidence panel | RetrievalTrace, Citation, Message | `POST /conversations/:id/messages`, `GET /search/documents` | `domain/test/rules.test.ts`, 12 casos de evaluación | L · F |
| Núcleo: handoff, tickets, respuesta humana | Chat, Help desk, Ticket | Ticket, TicketReply | `POST /conversations/:id/handoff`, `POST /tickets/:id/replies`, `PATCH /tickets/:id/status|assignment` | `web/test/fixture.test.ts` (handoff idempotente) | F · P |
| Núcleo: acción confirmada | Chat (Service request) | ToolProposal, ToolExecution, ServiceRequest | `POST /conversations/:id/tool-proposals`, `POST /tool-proposals/:id/confirm` | fixture (one-shot) | F · P |
| Núcleo: evaluación | Evaluations | EvaluationSuite/Case/Run, CaseResult | `POST /evaluations/runs`, `GET /evaluations/runs/:id/results` | fixture (12/12 casos) | L · F |
| R01 Interfaz premium + motion | Landing, todo el Studio | — | — | smoke en Chromium (`e2e/smoke.mjs`) | F |
| R02 Recomendaciones | Home, Chat, Project | Suggestion | `GET /recommendations`, `POST /recommendations/:id/dismiss` | `rules.test.ts` (sin contexto → nada; motivo y base) | L · F |
| R03 Canvas de entregables | Canvas, Deliverables, Artifact | Artifact, ArtifactVersion, ArtifactSource | `POST /artifacts/:id/versions`, `GET …/export?format=` | `renderers/test` (PPTX OOXML válido, PDF, MD, CSV) | L · F |
| R04 Proyectos y memoria | Projects, Project | Project, MemoryItem, MemoryConsent | `/projects`, `/memories` | fixture (scoping) | F · P |
| R05 Ramas y comparación | Chat | ConversationBranch, Comparison | `POST /branches`, `POST /comparisons` | fixture | F |
| R06 Análisis de archivos | Sources/Document (perfil CSV), Chat (Data Analyst) | Document (csv/image) | `GET /documents/:id/csv-profile` | `rules.test.ts` (CSV), corpus | L · F · P (PDF parsing, visión) |
| R07 Workflows | Workflows, Workflow | WorkflowDefinition/Version/Run, checkpoints | `/workflows/*`, `/workflow-runs/*` | fixture (reanuda sin duplicar artefacto) | L · F · P (worker durable) |
| R08 Agent Studio | Agent Studio, Agent editor | AgentDefinition, AgentVersion, Tool allowlist | `/agents`, `/agents/:id/plan`, `/tools` | `rules.test.ts` (allowlist) | L · F |
| R09 FinOps | Usage & costs | ProviderUsage/CostLedger, Budget, BudgetReservation | `/usage`, `/usage/ledger`, `/usage/export.csv`, `/budgets` | `pricing.test.ts` (sin doble conteo, desconocido ≠ 0, tiers, reservas) | L · F · P (reserva atómica SQL) |
| R10 Privacidad | Privacy | PrivacyPolicy, RedactionReview, ExternalTransferConsent | `/privacy/*` | `rules.test.ts` (Luhn, IBAN, CUIT, redacción) | L · F |
| R11 Trazabilidad | Run history, Run trace | Run, RunStep, RunAttempt, RunSnapshot | `/runs`, `/runs/:id` | fixture | F |
| R12 Colaboración y revisión | Artifact, Reviews | ArtifactShare, ReviewRequest, ReviewComment | `/artifact-shares`, `/reviews`, `/artifacts/:id/comments` | dominio (`canOnArtifact`) | L · F |
| R13 Routing | Composer, Settings → Routing/Models | ModelRegistry, ModelPriceVersion, RoutingPolicy | `/models`, `/providers`, `/routing-policy` | `rules.test.ts` (sin downgrade silencioso, modelo fijado) | L · F · P (proveedores reales) |
| R14 Showcase | Showcase | ShowcaseScenario | `/demo/scenarios` | — | F |

El catálogo completo de rutas, roles y requisito asociado está en `packages/contracts/src/api.ts` (`routes`).

## Fuera de alcance (según ficha)
Voz/telefonía, agentes que compran o contactan personas, certificaciones, precisión absoluta, LLM real sin integración y evaluación verificadas, enlaces públicos a archivos privados.

## Notas comerciales
USD 3.000–6.000 era referencia del núcleo v2; Studio v3 requiere recotización. Este repositorio no fija precio.
