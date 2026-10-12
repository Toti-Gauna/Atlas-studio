import type { ErrorCode } from "@atlas/contracts";

export class ApiError extends Error {
  readonly code: ErrorCode | "NETWORK";
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;
  readonly requestId: string | undefined;

  constructor(code: ErrorCode | "NETWORK", message: string, status: number, details?: Record<string, unknown>, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

export const STATUS_BY_CODE: Partial<Record<ErrorCode, number>> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  BUDGET_EXCEEDED: 402,
  QUOTA_RESERVATION_FAILED: 409,
  PROVIDER_DISCONNECTED: 503,
  CAPABILITY_UNSUPPORTED: 422,
  CONSENT_REQUIRED: 428,
  REDACTION_REVIEW_REQUIRED: 428,
  TOOL_NOT_ALLOWED: 403,
  CONFIRMATION_EXPIRED: 410,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  CANCELLED: 499,
  TIMEOUT: 504,
  INTERNAL: 500,
};
