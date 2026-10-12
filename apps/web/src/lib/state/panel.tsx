"use client";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { Citation } from "@atlas/contracts";

/** Right panel of the workspace: evidence (citations) or canvas (artifact). */
export type PanelState =
  | { kind: "evidence"; citations: Citation[]; activeIndex: number; messageId: string }
  | { kind: "canvas"; artifactId: string }
  | { kind: "run"; runId: string }
  | null;

const Ctx = createContext<{ panel: PanelState; open: (p: PanelState) => void; close: () => void }>({ panel: null, open: () => {}, close: () => {} });

/** Panels belong to the page that opened them: navigating away closes them. */
export function PanelProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [entry, setEntry] = useState<{ panel: PanelState; path: string }>({ panel: null, path: pathname });
  const panel = entry.path === pathname ? entry.panel : null;
  const value = useMemo(
    () => ({ panel, open: (p: PanelState) => setEntry({ panel: p, path: pathname }), close: () => setEntry({ panel: null, path: pathname }) }),
    [panel, pathname],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePanel = () => useContext(Ctx);
