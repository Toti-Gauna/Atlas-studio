"use client";
import { useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RotateCcw, X } from "lucide-react";
import { previewState, type ForcedState } from "@/lib/fixture/preview";
import { resetFixture } from "@/lib/fixture/transport";
import { Button, Callout, IconButton, Segmented, Sheet, Switch, useToast } from "@/components/ui";

/**
 * P02 preview-only controls (FIXTURE transport). Lets reviewers inspect every
 * state of every screen on static hosting. Removed with the fixture in P04.
 */
export function PreviewControls({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useSyncExternalStore(previewState.subscribe, previewState.get, previewState.get);
  const qc = useQueryClient();
  const toast = useToast();
  const apply = (patch: Partial<typeof state>) => {
    previewState.set(patch);
    void qc.resetQueries({ predicate: (q) => q.queryKey[0] !== "session" });
  };
  return (
    <Sheet open={open} onClose={onClose} label="Preview states">
      <div style={{ display: "flex", alignItems: "center", padding: "16px 16px 8px 20px" }}>
        <h2 style={{ fontSize: 18 }}>Preview states</h2>
        <IconButton label="Close" onClick={onClose} style={{ marginLeft: "auto" }}>
          <X size={16} />
        </IconButton>
      </div>
      <div style={{ padding: "8px 20px 24px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>
        <Callout tone="info">Frontend preview only. These controls change how the in-browser FIXTURE transport responds so you can review loading, empty, error, forbidden and offline states. They do not exist once the API is connected.</Callout>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Force response state</div>
          <Segmented<ForcedState>
            label="Force response state"
            value={state.forced}
            onChange={(v) => apply({ forced: v })}
            options={[
              { value: "none", label: "Live" },
              { value: "loading", label: "Loading" },
              { value: "empty", label: "Empty" },
              { value: "error", label: "Error" },
              { value: "forbidden", label: "Forbidden" },
              { value: "offline", label: "Offline" },
            ]}
          />
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Network latency</div>
          <Segmented<string> label="Network latency" value={String(state.latencyMs)} onChange={(v) => apply({ latencyMs: Number(v) })} options={[{ value: "0", label: "None" }, { value: "600", label: "600 ms" }, { value: "1800", label: "1.8 s" }]} />
        </div>
        <Switch
          checked={!state.localAdapterOnline}
          onChange={(v) => apply({ localAdapterOnline: !v })}
          label="Disconnect local adapter"
          description="Shows the provider-disconnected state: runs are blocked instead of switching models."
        />
        <Button
          icon={<RotateCcw size={14} />}
          onClick={() => {
            resetFixture();
            apply({ forced: "none", latencyMs: 0, localAdapterOnline: true });
            toast({ tone: "success", title: "Demo data reset", body: "Synthetic workspace rebuilt from the seed." });
          }}
        >
          Reset demo data
        </Button>
      </div>
    </Sheet>
  );
}
