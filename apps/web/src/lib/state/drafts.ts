"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * Composer drafts survive navigation (R01: "navegar sin pérdida de borrador").
 * sessionStorage is a per-tab convenience, not business persistence.
 */
const key = (scope: string) => `atlas.draft.${scope}`;

export function useDraft(scope: string): [string, (v: string) => void, () => void] {
  const [value, setValue] = useState("");
  useEffect(() => {
    // Sync from sessionStorage after hydration (external store; static export prerenders without it).
    let stored = "";
    try {
      stored = sessionStorage.getItem(key(scope)) ?? "";
    } catch {
      stored = "";
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(stored);
  }, [scope]);
  const update = useCallback(
    (v: string) => {
      setValue(v);
      try {
        if (v) sessionStorage.setItem(key(scope), v);
        else sessionStorage.removeItem(key(scope));
      } catch {
        /* storage unavailable */
      }
    },
    [scope],
  );
  const clear = useCallback(() => update(""), [update]);
  return [value, update, clear];
}

export function setDraft(scope: string, v: string) {
  try {
    sessionStorage.setItem(key(scope), v);
  } catch {
    /* storage unavailable */
  }
}
