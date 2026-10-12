import type { HttpMethod } from "@atlas/contracts";

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  signal?: AbortSignal;
}

export interface BinaryResponse {
  blob: Blob;
  filename: string;
}

/** Same contract for the HTTP API and the FIXTURE preview transport. */
export interface Transport {
  readonly kind: "http" | "fixture";
  request<T>(method: HttpMethod, path: string, opts?: RequestOptions): Promise<T>;
  download(path: string, opts?: RequestOptions): Promise<BinaryResponse>;
}
