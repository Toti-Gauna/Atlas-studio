"use client";
/**
 * Per-viewer conveniences (demo role, preview tooling, folded nav groups,
 * dismissed hints). Storage can be unavailable; every access is guarded and
 * the UI must render correctly without it.
 */

type Store = "local" | "session";

function store(kind: Store): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readPref(kind: Store, key: string): string | null {
  try {
    return store(kind)?.getItem(`atlas.${key}`) ?? null;
  } catch {
    return null;
  }
}

export function writePref(kind: Store, key: string, value: string | null): void {
  try {
    const s = store(kind);
    if (!s) return;
    if (value === null) s.removeItem(`atlas.${key}`);
    else s.setItem(`atlas.${key}`, value);
  } catch {
    /* storage blocked: the preference simply isn't remembered */
  }
}

/** Preview tooling is opt-in: `?preview=1` turns it on for this tab, `?preview=0` off. */
export function previewEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const flag = new URLSearchParams(window.location.search).get("preview");
  if (flag === "1" || flag === "0") writePref("session", "preview", flag === "1" ? "1" : null);
  return readPref("session", "preview") === "1";
}
