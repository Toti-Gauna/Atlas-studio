# Agent Studio (R08)

Definición: `packages/domain/src/agents.ts` (`AGENT_PROFILES`, `TOOL_CATALOG`). Contrato: `packages/contracts/src/agents.ts`.

## Herramientas permitidas (allowlist fija del servidor)
| Tool | Efecto | Determinista |
|---|---|---|
| retrieve_sources | read | sí |
| checklist_compare | compute | sí |
| csv_profile / csv_stats / csv_aggregate / chart_spec | compute | sí |
| outline_presentation | compute | no (plantilla en modo local) |
| draft_artifact / render_export | internal_write | sí |
| redact_preview | compute | sí |
| propose_service_request / propose_memory | requires_confirmation | sí |
| handoff_to_human | internal_write (idempotente) | sí |

`assertToolAllowed(allowed, requested)` rechaza herramientas desconocidas o fuera de la versión del agente. Ninguna instrucción de usuario, agente o documento puede ampliar herramientas ni fuentes: el servidor valida la configuración (tools conocidas, modelo del registry, documentos del mismo workspace).

## Perfiles iniciales
| Perfil | Herramientas | Límite clave |
|---|---|---|
| Compliance Advisor | retrieve_sources, checklist_compare, draft_artifact, render_export, handoff_to_human | Sin dictamen legal ni certificación; pide alcance y jurisdicción |
| Presentation Creator | retrieve_sources, outline_presentation, draft_artifact, render_export | Brief → outline → slides; exporta con renderer estructurado |
| Data Analyst | csv_profile, csv_stats, csv_aggregate, chart_spec, draft_artifact, render_export | Sin shell ni SQL libre; cada número sale de una tool |
| Sales Strategist | retrieve_sources, draft_artifact, render_export | Solo borradores; no contacta ni promete resultados |
| Technical Architect | retrieve_sources, draft_artifact, render_export | Código como texto; no ejecuta ni despliega |
| Research & Writing Editor | retrieve_sources, draft_artifact, render_export, handoff_to_human, propose_service_request | No inventa fuentes; sin navegación web |

Cada versión guarda: descripción, instrucciones, objetivo, formato de salida, estilo (direct/analytical/creative/didactic), profundidad, política de preguntas previas, preguntas del brief, alcance de fuentes, modelo, temperatura (si aplica), tools y límites (pasos, segundos, tokens de entrada/salida, costo máximo en nano-USD).

## Orquestación
Objetivo → plan (`POST /agents/:id/plan`, sin llamar modelos) → privacidad → reserva de presupuesto → tools permitidas → resultado → revisión. Confirmación obligatoria si hay tools `requires_confirmation`, fallback de modelo o costo adicional. Cada run congela la versión del agente (R11).

## Modo local
Con el adaptador local, el comportamiento cambia realmente por perfil: Data Analyst ejecuta perfil/agregación del CSV, Compliance compara contra el checklist y produce un gap report, Presentation genera un deck desde el brief, el resto responde extractivamente con citas. Se etiqueta "Local · extractive, no generative model".
