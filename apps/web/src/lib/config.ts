/**
 * Runtime configuration (public, non-secret). Secrets never reach the browser.
 * - NEXT_PUBLIC_DATA_MODE=fixture → in-browser FIXTURE transport (P02 preview only, labeled in UI)
 * - NEXT_PUBLIC_DATA_MODE=api     → HTTP transport to NEXT_PUBLIC_API_URL (Express API)
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const DATA_MODE: "fixture" | "api" = process.env.NEXT_PUBLIC_DATA_MODE === "api" ? "api" : "fixture";
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export const asset = (path: string) => `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
