"use client";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, MessageSquarePlus } from "lucide-react";
import { api } from "@/lib/api";
import { activityCopy as c } from "@/copy/activity";
import { Page } from "@/components/shell/StudioShell";
import { Button, DemoTag, EmptyState, IconButton, LinkButton, PageHeader, QueryState, Select, statusLabel } from "@/components/ui";
import { useProjects } from "@/features/deliverables/queries";
import { RunsTable } from "./RunsTable";
import { RunDetailColumn } from "./RunDetailColumn";
import s from "./runs-history.module.css";

type Filters = { project: string; agent: string; status: string };
const NONE: Filters = { project: "", agent: "", status: "" };
const PAGE = 20;

/** Activity: every agent run, newest first, 20 per page; synthetic runs carry one page-level DEMO note. */
export function RunsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selected = params.get("id");
  const runs = useQuery({ queryKey: ["runs", "history"], queryFn: () => api.runs.list() });
  const projects = useProjects();
  const [f, setF] = useState<Filters>(NONE);
  const [page, setPage] = useState(0);
  const projectName = useMemo(() => new Map((projects.data ?? []).map((p) => [p.id, p.name])), [projects.data]);

  const select = (id: string | null) => router.replace(id ? `${pathname}?id=${id}` : pathname, { scroll: false });
  const setFilters = (next: Filters) => {
    setF(next);
    setPage(0);
  };
  const filtered = useMemo(
    () => (runs.data ?? []).filter((r) => (!f.project || r.projectId === f.project) && (!f.agent || r.agentId === f.agent) && (!f.status || r.status === f.status)).sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [runs.data, f],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages - 1);
  const rows = filtered.slice(current * PAGE, current * PAGE + PAGE);
  const hasDemo = (runs.data ?? []).some((r) => r.label === "DEMO");

  return (
    <Page wide>
      <PageHeader title={c.title} description={c.description} />
      {hasDemo ? (
        <p className={s.demoNote}>
          <DemoTag /> {c.demoNote}
        </p>
      ) : null}
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
              const statuses = [...new Set(all.map((r) => r.status))];
              return (
                <>
                  <div className={s.filters} role="group" aria-label={c.filtersLabel}>
                    <Select label={c.project} value={f.project} onChange={(e) => setFilters({ ...f, project: e.target.value })} options={[{ value: "", label: c.allProjects }, ...projectIds.map((id) => ({ value: id, label: projectName.get(id) ?? id }))]} />
                    <Select label={c.agent} value={f.agent} onChange={(e) => setFilters({ ...f, agent: e.target.value })} options={[{ value: "", label: c.allAgents }, ...agents.map(([value, label]) => ({ value, label }))]} />
                    <Select label={c.status} value={f.status} onChange={(e) => setFilters({ ...f, status: e.target.value })} options={[{ value: "", label: c.allStatuses }, ...statuses.map((st) => ({ value: st, label: statusLabel("run", st) }))]} />
                    <p className={s.count} aria-live="polite">
                      {c.count(filtered.length, all.length)}
                    </p>
                  </div>
                  {filtered.length === 0 ? (
                    <EmptyState title={c.noMatchTitle} action={<Button onClick={() => setFilters(NONE)}>{c.clearFilters}</Button>} />
                  ) : (
                    <>
                      <RunsTable rows={rows} selectedId={selected} onSelect={select} projectName={projectName} />
                      {pages > 1 ? (
                        <nav className={s.pager} aria-label={c.pagination}>
                          <IconButton label={c.prev} size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
                            <ChevronLeft size={16} />
                          </IconButton>
                          <span className={s.pageLabel}>{c.page(current * PAGE + 1, current * PAGE + rows.length, filtered.length)}</span>
                          <IconButton label={c.next} size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                            <ChevronRight size={16} />
                          </IconButton>
                        </nav>
                      ) : null}
                    </>
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
