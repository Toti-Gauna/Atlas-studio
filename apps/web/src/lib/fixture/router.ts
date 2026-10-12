/** FIXTURE (P02 preview only): tiny method+path router with server-style authorization. */
import type { ErrorCode, HttpMethod, WorkspaceRole } from "@atlas/contracts";
import { can, type Action } from "@atlas/domain";
import type { Db } from "./db";

export class FixtureError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export interface Ctx {
  db: Db;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  userId: string;
  role: WorkspaceRole;
}

export type Handler = (ctx: Ctx) => unknown | Promise<unknown>;

interface Route {
  method: HttpMethod;
  pattern: RegExp;
  keys: string[];
  public: boolean;
  handler: Handler;
}

const routes: Route[] = [];

export function on(method: HttpMethod, path: string, handler: Handler, opts: { public?: boolean } = {}) {
  const keys: string[] = [];
  const pattern = new RegExp(
    `^${path.replace(/:[a-zA-Z]+/g, (m) => {
      keys.push(m.slice(1));
      return "([^/]+)";
    })}$`,
  );
  routes.push({ method, pattern, keys, public: opts.public ?? false, handler });
}

export function match(method: HttpMethod, path: string): { route: Route; params: Record<string, string> } | null {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.pattern.exec(path);
    if (m) return { route: r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1]!)])) };
  }
  return null;
}

/** Server-style permission gate derived from the session role (never from client input). */
export function requireAction(ctx: Ctx, action: Action) {
  if (!can(ctx.role, action)) throw new FixtureError("FORBIDDEN", `Your role (${ctx.role}) cannot perform ${action}.`);
}

export function notFound(what: string): never {
  throw new FixtureError("NOT_FOUND", `${what} not found in this workspace.`);
}

export function body<T>(ctx: Ctx): T {
  return (ctx.body ?? {}) as T;
}
