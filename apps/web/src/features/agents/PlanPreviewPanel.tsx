"use client";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Callout, Card, ErrorState, Select, Skeleton, TextArea } from "@/components/ui";
import { agentsCopy as c } from "@/copy/agents";
import { planCopy } from "@/copy/workflows";
import { PlanPreview } from "@/features/workflows/PlanPreview";
import s from "./agents.module.css";
import ps from "./panels.module.css";

/** Editor side panel: preview the plan of the saved version for an objective (nothing runs). */
export function PlanPreviewPanel({ agentId, version }: { agentId: string | null; version: number | null }) {
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects.list });
  const [objective, setObjective] = useState("");
  const [projectId, setProjectId] = useState("");
  const [touched, setTouched] = useState(false);
  const pid = projectId || projects.data?.[0]?.id || "";
  const plan = useMutation({ mutationFn: () => api.agents.plan(agentId!, { objective: objective.trim(), projectId: pid, pinnedModelKey: null }) });
  const missing = !objective.trim();

  return (
    <Card className={ps.planCard} aria-labelledby="plan-h">
      <h2 id="plan-h" className={s.sectionTitle}>
        <Eye size={16} aria-hidden /> {planCopy.title}
      </h2>
      <p className={s.hint}>{c.plan.intro}</p>
      {!agentId || version === null ? (
        <Callout>{c.plan.saveFirst}</Callout>
      ) : (
        <form
          className={s.fields}
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (!missing && pid) plan.mutate();
          }}
        >
          <p className={s.hint}>{c.plan.savedOnly(version)}</p>
          <TextArea label={c.plan.objective} rows={3} value={objective} onChange={(e) => setObjective(e.target.value)} maxLength={2000} error={touched && missing ? c.plan.objectiveRequired : null} />
          {projects.isPending ? (
            <Skeleton lines={1} />
          ) : projects.isError ? (
            <ErrorState error={projects.error} compact onRetry={() => void projects.refetch()} />
          ) : projects.data.length === 0 ? (
            <p className={s.hint}>{c.plan.noProjects}</p>
          ) : (
            <Select label={c.plan.project} value={pid} options={projects.data.map((p) => ({ value: p.id, label: p.name }))} onChange={(e) => setProjectId(e.target.value)} />
          )}
          <div>
            <Button type="submit" variant="secondary" icon={<Eye size={14} aria-hidden />} loading={plan.isPending} disabled={!pid}>
              {c.plan.preview}
            </Button>
          </div>
        </form>
      )}
      <div aria-live="polite">
        {plan.isError ? <ErrorState error={plan.error} compact onRetry={() => plan.mutate()} /> : null}
        {plan.data && !plan.isPending ? (
          <div className={ps.planResult}>
            <PlanPreview plan={plan.data} />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
