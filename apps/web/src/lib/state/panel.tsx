"use client";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Citation } from "@atlas/contracts";

/** Right panel of the workspace: evidence (citations) or canvas (artifact). */
export type PanelState =
  | { kind: "evidence"; citations: Citation[]; activeIndex: number; messageId: string }
  | { kind: "canvas"; artifactId: string }
  | { kind: "run"; runId: string }
  | null;

const Ctx = createContext<{ panel: PanelState; open: (p: PanelState) => void; close: () => void }>({ panel: null, open: () => {}, close: () => {} });

export function PanelProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<PanelState>(null);
  const value = useMemo(() => ({ panel, open: setPanel, close: () => setPanel(null) }), [panel]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePanel = () => useContext(Ctx);
