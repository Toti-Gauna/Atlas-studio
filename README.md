# Atlas Studio — Eclipse Premium V3 (demo)

Enterprise AI workspace with verifiable sources, configurable agents, editable deliverables and per-model cost control.
**Eclipse Demo · fictional data** (company "Corvid Freight"). Status: **in construction — requires Ignacio's review**. See `docs/status.md`.

## What runs today
| Area | State |
|---|---|
| Shared contracts, domain logic (pricing, privacy, CSV, retrieval, routing, permissions, agents) | Implemented locally, unit-tested |
| Export renderers (Markdown, CSV, JSON, PDF, PPTX) | Implemented locally, tested (PPTX is a valid OOXML package) |
| Frontend Studio (Next.js static export) | P02 preview on an in-browser **FIXTURE** transport (DEMO data, resets on reload) |
| API + PostgreSQL + worker | Pending (P03) |
| Anthropic / Gemini providers | Pending credentials and authorized budget; Gemini IDs/prices unverified |

## Workspace
```
apps/web            Next.js 16 static export (frontend)
packages/contracts  zod schemas + formal route catalogue
packages/domain     deterministic domain logic shared by web and API
packages/renderers  structured MD/CSV/JSON/PDF/PPTX exporters
packages/demo-seed  synthetic corpus and fixtures (DEMO)
docs/               scope, architecture, design system, agents, registry, pricing, privacy, status
```

## Commands
```bash
pnpm install
pnpm dev                 # http://localhost:3000 (fixture preview)
pnpm test                # all unit/integration tests
pnpm lint && pnpm typecheck
pnpm build               # static export → apps/web/out
pnpm build:pages         # GitHub Pages build (basePath /Atlas-studio)
node e2e/smoke.mjs http://localhost:4310 ./shots   # browser smoke test against a served export
```
Requires Node ≥ 22 and pnpm 10.

## Environment
See `.env.example`. Only `NEXT_PUBLIC_*` values reach the browser and none of them are secrets.
