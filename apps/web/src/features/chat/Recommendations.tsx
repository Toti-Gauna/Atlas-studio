"use client";
import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileOutput, HelpCircle, Lightbulb, X } from "lucide-react";
import type { Suggestion } from "@atlas/contracts";
import { api } from "@/lib/api";
import { gsap, MOTION, useGSAP, useReducedMotion } from "@/lib/motion";
import { Badge, Button, EmptyState, ErrorState, IconButton, Skeleton } from "@/components/ui";
import s from "./chat.module.css";

const KIND = {
  question: { label: "Question", icon: HelpCircle, tone: "info" as const },
  next_step: { label: "Next step", icon: Lightbulb, tone: "teal" as const },
  deliverable: { label: "Deliverable", icon: FileOutput, tone: "violet" as const },
};

/** Sources the suggestion builds on, as one readable line (agents are implied by the project). */
function basis(sg: Suggestion): string {
  const names = sg.basedOn.filter((b) => b.type !== "agent").map((b) => (b.type === "objective" ? "the project objective" : b.label));
  return names.length ? listFormat.format(names.slice(0, 3)) : "";
}

const listFormat = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

/** R02: suggestions explain why they exist and which data they used. */
export function Recommendations({ projectId, conversationId, agentId, onUse, actionLabel = () => "Use", limit = 4 }: { projectId?: string; conversationId?: string; agentId?: string; onUse: (s: Suggestion) => void; actionLabel?: (s: Suggestion) => string; limit?: number }) {
  const qc = useQueryClient();
  const key = ["recommendations", projectId ?? null, conversationId ?? null, agentId ?? null];
  const q = useQuery({ queryKey: key, queryFn: () => api.recommendations.list({ projectId, conversationId, agentId }) });
  const dismiss = useMutation({
    mutationFn: (id: string) => api.recommendations.dismiss(id),
    onMutate: (id) => qc.setQueryData<Suggestion[]>(key, (old) => old?.filter((x) => x.id !== id)),
  });
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useGSAP(
    () => {
      if (reduced || !q.data?.length) return;
      gsap.from("[data-reco]", { y: 10, opacity: 0, duration: MOTION.reco, stagger: 0.05, ease: MOTION.ease, clearProps: "transform,opacity" });
    },
    { scope: ref, dependencies: [q.dataUpdatedAt, reduced] },
  );
  if (q.isPending)
    return (
      <div className={s.recos} aria-busy>
        {[0, 1, 2].map((i) => <Skeleton key={i} block={130} />)}
      </div>
    );
  if (q.isError) return <ErrorState error={q.error} compact onRetry={() => void q.refetch()} />;
  if (!q.data.length) return <EmptyState title="No suggestions" body="Suggestions appear when a project has an objective, documents or a conversation to build on. Atlas does not invent context." />;
  return (
    <div className={s.recos} ref={ref}>
      {q.data.slice(0, limit).map((sg) => {
        const k = KIND[sg.kind];
        const Icon = k.icon;
        return (
          <article key={sg.id} className={s.reco} data-reco>
            <div className={s.recoKind}>
              <Badge tone={k.tone} icon={<Icon size={12} aria-hidden />}>
                {k.label}
              </Badge>
              <IconButton label={`Dismiss suggestion: ${sg.title}`} size="sm" style={{ marginLeft: "auto" }} onClick={() => dismiss.mutate(sg.id)}>
                <X size={14} />
              </IconButton>
            </div>
            <h3 className={s.recoTitle}>{sg.title}</h3>
            <p className={s.recoReason}>
              <span className="sr-only">Why: </span>
              {sg.reason}
            </p>
            {basis(sg) ? <p className={s.recoBasis}>Uses {basis(sg)}</p> : null}
            <div className={s.recoActions}>
              <Button size="sm" variant="secondary" onClick={() => onUse(sg)}>
                {actionLabel(sg)}
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
