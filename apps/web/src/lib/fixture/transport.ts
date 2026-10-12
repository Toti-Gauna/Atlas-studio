/**
 * FIXTURE transport (P02 frontend preview only — removed in P04).
 * Implements the API contract in the browser so every screen can be reviewed
 * on static hosting. It applies the same session/role rules the API will
 * enforce, uses the real domain logic, and labels all data DEMO.
 */
import type { HttpMethod } from "@atlas/contracts";
import { ApiError, STATUS_BY_CODE } from "../api/errors";
import type { BinaryResponse, RequestOptions, Transport } from "../api/transport";
import { buildDb } from "./build";
import type { Db } from "./db";
import { FixtureError, match, type Ctx } from "./router";
import { previewState } from "./preview";
import "./handlers/platform";
import "./handlers/projects";
import "./handlers/documents";
import "./handlers/conversations";
import "./handlers/agents";
import "./handlers/artifacts";
import "./handlers/operations";
import { exportArtifact } from "./handlers/artifacts";
import { usageExport } from "./handlers/operations";

let db: Db | null = null;
const getDb = () => (db ??= buildDb());

export function resetFixture() {
  const keepSession = db?.session ?? null;
  db = buildDb();
  db.session = keepSession;
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (ms <= 0) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new ApiError("CANCELLED", "Request cancelled.", 499));
    });
  });

async function gate(method: HttpMethod, signal?: AbortSignal) {
  const p = previewState.get();
  if (p.forced === "loading") await new Promise<never>(() => {});
  await wait(p.latencyMs, signal);
  if (p.forced === "offline") throw new ApiError("NETWORK", "The Atlas API is unreachable (preview: offline state).", 0);
  if (p.forced === "error") throw new ApiError("INTERNAL", "Something went wrong on the server (preview: error state).", 500, undefined, "req_preview_error");
  if (p.forced === "forbidden") throw new ApiError("FORBIDDEN", "Your role cannot access this (preview: forbidden state).", 403);
  return method === "GET" && p.forced === "empty";
}

function ctxFor(path: string, opts: RequestOptions, params: Record<string, string>, isPublic: boolean): Ctx {
  const d = getDb();
  if (!d.session && !isPublic) throw new ApiError("UNAUTHENTICATED", "Start a demo workspace to continue.", 401);
  const query = Object.fromEntries(Object.entries(opts.query ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, String(v)]));
  return { db: d, params, query, body: opts.body === undefined ? undefined : structuredClone(opts.body), userId: d.session?.userId ?? "anonymous", role: d.session?.role ?? "viewer" };
}

function emptyLike(value: unknown): unknown {
  if (Array.isArray(value)) return [];
  if (value && typeof value === "object" && "items" in value) return { ...(value as object), items: [] };
  if (value && typeof value === "object" && "groups" in value) return { ...(value as object), groups: [], daily: [] };
  return value;
}

function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof FixtureError) return new ApiError(e.code, e.message, STATUS_BY_CODE[e.code] ?? 400, e.details);
  const code = (e as { code?: string }).code;
  if (code === "NOT_FOUND") return new ApiError("NOT_FOUND", (e as Error).message, 404);
  console.error("[fixture]", e);
  return new ApiError("INTERNAL", "Unexpected error in the preview transport.", 500);
}

export const fixtureTransport: Transport = {
  kind: "fixture",
  async request<T>(method: HttpMethod, path: string, opts: RequestOptions = {}): Promise<T> {
    const forceEmpty = await gate(method, opts.signal);
    const m = match(method, path);
    if (!m) throw new ApiError("NOT_FOUND", `No route for ${method} ${path}`, 404);
    try {
      const ctx = ctxFor(path, opts, m.params, m.route.public);
      const result = await m.route.handler(ctx);
      const cloned = result === undefined ? undefined : structuredClone(result);
      return (forceEmpty ? emptyLike(cloned) : cloned) as T;
    } catch (e) {
      throw toApiError(e);
    }
  },
  async download(path: string, opts: RequestOptions = {}): Promise<BinaryResponse> {
    await gate("GET", opts.signal);
    try {
      const exp = /^\/artifacts\/([^/]+)\/versions\/(\d+)\/export$/.exec(path);
      if (exp) {
        const ctx = ctxFor(path, opts, {}, false);
        return await exportArtifact(ctx, exp[1]!, Number(exp[2]), (ctx.query.format ?? "md") as never);
      }
      if (path === "/usage/export.csv") return usageExport(ctxFor(path, opts, {}, false));
      throw new ApiError("NOT_FOUND", `No download route for ${path}`, 404);
    } catch (e) {
      throw toApiError(e);
    }
  },
};
