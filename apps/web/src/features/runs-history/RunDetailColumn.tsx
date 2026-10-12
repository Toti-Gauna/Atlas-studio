"use client";
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import { gsap, MOTION, useGSAP, useReducedMotion } from "@/lib/motion";
import { runHistoryCopy as c } from "@/copy/deliverables";
import { Card, ErrorState, IconButton, LoadingBlock } from "@/components/ui";
import { RunTrace } from "@/features/runs/RunTrace";
import s from "./runs-history.module.css";

/** Detail column for the selected run; slides in once per selection to show what changed. */
export function RunDetailColumn({ runId, onClose }: { runId: string; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const q = useQuery({ queryKey: ["run", runId], queryFn: () => api.runs.get(runId) });

  useGSAP(
    () => {
      if (!ref.current) return;
      // Stacked layout: bring the detail (rendered below the table) into view.
      if (window.matchMedia("(max-width: 1100px)").matches) ref.current.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
      if (reduced) return;
      gsap.fromTo(ref.current, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: MOTION.drawer, ease: MOTION.ease, clearProps: "opacity,transform" });
    },
    { scope: ref, dependencies: [runId, reduced] },
  );

  return (
    <aside ref={ref} className={s.detailCol} aria-labelledby="run-detail-h">
      <Card>
        <div className={s.detailHead}>
          <h2 id="run-detail-h" className={s.detailTitle}>
            {c.detailTitle} <span className="mono">{runId}</span>
          </h2>
          <IconButton label={c.close} size="sm" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div aria-live="polite">
          {q.isPending ? <LoadingBlock rows={4} /> : q.isError ? <ErrorState error={q.error} compact onRetry={() => void q.refetch()} /> : <RunTrace run={q.data} />}
        </div>
      </Card>
    </aside>
  );
}
