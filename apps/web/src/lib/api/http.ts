import type { ApiErrorBody, HttpMethod } from "@atlas/contracts";
import { API_URL } from "../config";
import { ApiError } from "./errors";
import type { BinaryResponse, RequestOptions, Transport } from "./transport";

let csrfToken: string | null = null;
export const setCsrfToken = (t: string | null) => {
  csrfToken = t;
};

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`${API_URL}${path}`);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  return url.toString();
}

async function toError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return new ApiError(body.error.code, body.error.message, res.status, body.error.details, body.error.requestId);
  } catch {
    return new ApiError("INTERNAL", `Request failed with status ${res.status}`, res.status);
  }
}

/** Cookie session (HttpOnly, SameSite) + CSRF header on mutations. */
export const httpTransport: Transport = {
  kind: "http",
  async request<T>(method: HttpMethod, path: string, opts: RequestOptions = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(buildUrl(path, opts.query), {
        method,
        credentials: "include",
        signal: opts.signal,
        headers: {
          Accept: "application/json",
          ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(method !== "GET" && csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") throw new ApiError("CANCELLED", "Request cancelled.", 499);
      throw new ApiError("NETWORK", "The Atlas API is unreachable. Check your connection or the API status.", 0);
    }
    if (!res.ok) throw await toError(res);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  },
  async download(path: string, opts: RequestOptions = {}): Promise<BinaryResponse> {
    const res = await fetch(buildUrl(path, opts.query), { credentials: "include", signal: opts.signal });
    if (!res.ok) throw await toError(res);
    const cd = res.headers.get("Content-Disposition") ?? "";
    const filename = /filename="?([^";]+)"?/.exec(cd)?.[1] ?? "atlas-export";
    return { blob: await res.blob(), filename };
  },
};
