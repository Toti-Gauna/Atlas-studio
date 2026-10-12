"use client";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MessageSquarePlus } from "lucide-react";
import { api } from "@/lib/api";
import { runHistoryCopy as c } from "@/copy/deliverables";
import { Page } from "@/components/shell/StudioShell";
import { Button, EmptyState, LinkButton, PageHeader, QueryState, Select } from "@/components/ui";
import { RUN_TONE } from "@/features/runs/RunTrace";
import { useProjects } from "@/features/deliverables/queries";
import { RunsTable } from "./RunsTable";
import { RunDetailColumn } from "./RunDetailColumn";
import s from "./runs-history.module.css";

type Filters = { project: string; agent: string; status: string };
const NONE: Filters = { project: "", agent: "", status: "" };
export const statusLabel = (st: string) => st.replace(/_/g, " ");

export function RunsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selected = params.get("id");
  const runs = useQuery({ queryKey: ["runs", "history"], queryFn: () => api.runs.list() });
  const projects = useProjects();
  const [f, setF] = useState<Filters>(NONE);
  const projectName = useMemo(() => new Map((projects.data ?? []).map((p) => [p.id, p.name])), [projects.data]);

  const select = (id: string | null) => router.replace(id ? `${pathname}?id=${id}` : pathname, { scroll: false });
  const filtered = useMemo(
    () => (runs.data ?? []).filter((r) => (!f.project || r.projectId === f.project) && (!f.agent || r.agentId === f.agent) && (!f.status || r.status === f.status)),
    [runs.data, f],
  );

  return (
    <Page wide>
      <PageHeader eyebrow={c.eyebrow} title={c.title} description={c.description} />
      <div className={selected ? s.layoutWithDetail : undefined}>
        <div className={s.listCol}>
          <QueryState
            query={runs}
            isEmpty={(d) => d.length === 0}
            empty={<EmptyState title={c.emptyTitle} body={c.emptyBody} action={<LinkButton href="/app/chat/?new=1" variant="primary" icon={<MessageSquarePlus size={14} aria-hidden />}>{c.emptyCta}</LinkButton>} />}
          >
            {(all) => {
              const agents = [...new Map(all.map((r) => [r.agentId, r.agentName])).entries()];
              const projectIds = [...new Set(all.map((r) => r.projectId))];
              return (
                <>
                  <div className={s.filters} role="group" aria-label={c.filtersLabel}>
                    <Select label="Project" value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })} options={[{ value: "", label: c.allProjects }, ...projectIds.map((id) => ({ value: id, label: projectName.get(id) ?? id }))]} />
                    <Select label="Agent" value={f.agent} onChange={(e) => setF({ ...f, agent: e.target.value })} options={[{ value: "", label: c.allAgents }, ...agents.map(([value, label]) => ({ value, label }))]} />
                    <Select label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} options={[{ value: "", label: c.allStatuses }, ...Object.keys(RUN_TONE).map((st) => ({ value: st, label: statusLabel(st) }))]} />
                    <p className={s.count} aria-live="polite">{filtered.length} of {all.length}</p>
                  </div>
                  {filtered.length === 0 ? (
                    <EmptyState title={c.noMatchTitle} action={<Button onClick={() => setF(NONE)}>{c.clearFilters}</Button>} />
                  ) : (
                    <RunsTable rows={filtered} selectedId={selected} onSelect={select} projectName={projectName} />
                  )}
                  {!selected ? <p className={s.hint}>{c.selectHint}</p> : null}
                </>
              );
            }}
          </QueryState>
        </div>
        {selected ? <RunDetailColumn runId={selected} onClose={() => select(null)} /> : null}
      </div>
    </Page>
  );
}
