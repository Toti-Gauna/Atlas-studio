/** FIXTURE (P02 preview only): platform, session, registry and routing handlers. */
import type { ProviderStatus, RoutingPolicy, Session, WorkspaceRole } from "@atlas/contracts";
import { DEMO_SWITCHABLE_ROLES, PENDING_PROVIDERS, TOOL_CATALOG } from "@atlas/domain";
import { iso, newId, type Db } from "../db";
import { body, on, requireAction, FixtureError, type Ctx } from "../router";
import { registryNow } from "../scope";
import { previewState } from "../preview";

export function sessionOf(db: Db): Session {
  const s = db.session!;
  const user = db.users.find((u) => u.id === s.userId)!;
  return { user, workspace: db.workspace, role: s.role, switchableRoles: DEMO_SWITCHABLE_ROLES, csrfToken: s.csrf, expiresAt: db.workspace.expiresAt ?? iso(Date.now() + 86_400_000) };
}

export function providerStatuses(): ProviderStatus[] {
  const local = previewState.get().localAdapterOnline;
  return [
    { provider: "local", displayName: "Atlas Local (extractive)", mode: local ? "local" : "pending", reason: local ? "Runs inside Atlas: retrieval, templates and deterministic tools. Not a generative model." : "Local adapter offline (preview control).", credentialsConfigured: true, budgetAuthorized: true, lastCheckedAt: iso(Date.now()) },
    { provider: "anthropic", displayName: "Anthropic", mode: "pending", reason: "No server credentials or authorized budget configured. Adapter is prepared; live calls stay disabled.", credentialsConfigured: false, budgetAuthorized: false, lastCheckedAt: null },
    ...PENDING_PROVIDERS.map((p) => ({ provider: p.provider, displayName: p.displayName, mode: "pending" as const, reason: p.reason, credentialsConfigured: false, budgetAuthorized: false, lastCheckedAt: null })),
  ];
}

const VALID_ROLES = new Set<WorkspaceRole>(DEMO_SWITCHABLE_ROLES);

on("GET", "/health", () => ({ status: "ok", mode: "fixture-preview", providers: providerStatuses() }), { public: true });

on("GET", "/auth/session", (ctx) => sessionOf(ctx.db));
on("POST", "/auth/logout", (ctx) => {
  ctx.db.session = null;
  return undefined;
});
on(
  "POST",
  "/auth/login",
  () => {
    throw new FixtureError("UNAUTHENTICATED", "Owner login is handled by the API server (pending backend). Use “Start demo workspace”.");
  },
  { public: true },
);

on(
  "POST",
  "/demo/sessions",
  (ctx) => {
    const { role } = body<{ role?: WorkspaceRole }>(ctx);
    const r = role && VALID_ROLES.has(role) ? role : "admin";
    ctx.db.session = { userId: "usr_visitor", role: r, csrf: newId("csrf") };
    return sessionOf(ctx.db);
  },
  { public: true },
);
on("POST", "/demo/sessions/role", (ctx) => {
  const { role } = body<{ role: WorkspaceRole }>(ctx);
  if (!VALID_ROLES.has(role)) throw new FixtureError("VALIDATION", "Unknown demo role.");
  // The server issues a new session for the same visitor inside the same demo workspace.
  ctx.db.session = { userId: ctx.userId, role, csrf: newId("csrf") };
  ctx.db.audit.unshift({ id: newId("aud"), actorId: ctx.userId, actorName: "Demo Visitor", action: "demo.role_switch", target: role, requestId: newId("req"), createdAt: iso(Date.now()) });
  return sessionOf(ctx.db);
});

on("GET", "/members", (ctx) =>
  ctx.db.users.map((u) => ({ user: u, role: u.id === ctx.userId ? ctx.role : ctx.db.roles[u.id]!, joinedAt: iso(ctx.db.now - 30 * 86_400_000) })),
);
on("GET", "/audit", (ctx: Ctx) => {
  requireAction(ctx, "settings.admin");
  return ctx.db.audit;
});

on("GET", "/models", () => registryNow());
on("GET", "/providers", () => providerStatuses());
on("GET", "/tools", () => TOOL_CATALOG);
on("GET", "/routing-policy", (ctx) => ctx.db.routingPolicy);
on("PUT", "/routing-policy", (ctx) => {
  requireAction(ctx, "settings.admin");
  const next = body<RoutingPolicy>(ctx);
  const known = new Set(registryNow().map((m) => m.key));
  for (const r of next.rules) {
    if (!known.has(r.preferredModelKey) || (r.fallbackModelKey && !known.has(r.fallbackModelKey))) throw new FixtureError("VALIDATION", `Unknown model in rule ${r.id}.`);
  }
  ctx.db.routingPolicy = { ...next, id: ctx.db.routingPolicy.id, version: ctx.db.routingPolicy.version + 1, allowAutomaticFallback: false, updatedAt: iso(Date.now()) };
  return ctx.db.routingPolicy;
});
