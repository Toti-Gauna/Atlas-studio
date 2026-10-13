"use client";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import type { UsageGroupBy, UsageQuery } from "@atlas/contracts";
import { api } from "@/lib/api";
import { useCan } from "@/lib/state/session";
import { usageCopy as c } from "@/copy/usage";
import { Page } from "@/components/shell/StudioShell";
import { Button, Card, DemoTag, EmptyState, PageHeader, QueryState, SectionHead, Segmented, Select, cx, useToast } from "@/components/ui";
import { downloadBlob } from "@/features/artifacts/useArtifactActions";
import { UsageFilters, type UsageFilterState } from "./UsageFilters";
import { TokenTotals, UsageKpis } from "./UsageKpis";
import { DailyChart } from "./DailyChart";
import { GroupsTable } from "./GroupsTable";
import { LedgerSection } from "./LedgerSection";
import { BudgetsSection } from "./BudgetsSection";
import s from "./usage.module.css";

type Range = "7d" | "30d";
const GROUPS = ["model", "agent", "project", "user", "provider", "day"] as const;

/**
 * Usage & costs (R09). Answers "how am I doing against budget?" first (budget
 * strip, then three business numbers), then where the money goes. Tokens and
 * the per-attempt ledger sit in a collapsed "Technical detail" section.
 */
export function UsageView() {
  const toast = useToast();
  const isAdmin = useCan("budget.admin");
  const [range, setRange] = useState<Range>("30d");
  const [groupBy, setGroupBy] = useState<UsageGroupBy>("model");
  const [filters, setFilters] = useState<UsageFilterState>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [techOpen, setTechOpen] = useState(false);
  const query: UsageQuery = { range, groupBy, ...filters };
  const report = useQuery({ queryKey: ["usage", query], queryFn: () => api.usage.report(query), placeholderData: keepPreviousData });
  /** The 30-day daily series (same filters) gives "last 7 days vs previous 7" for either range. */
  const trendQuery: UsageQuery = { ...query, range: "30d" };
  const trend = useQuery({ queryKey: ["usage", trendQuery], queryFn: () => api.usage.report(trendQuery), enabled: range === "7d" });
  const daily30 = range === "30d" ? report.data?.daily : trend.data?.daily;
  const budgets = useQuery({ queryKey: ["budgets"], queryFn: api.budgets.list });
  const workspaceBudget = budgets.data?.find((b) => b.scope === "workspace");
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const demo = report.data?.label === "DEMO";

  const exportCsv = useMutation({
    mutationFn: () => api.usage.exportCsv({ range }),
    onSuccess: (file) => {
      downloadBlob(file.blob, file.filename);
      toast({ tone: "success", title: c.ledger.exportDone, body: file.filename });
    },
    onError: (e) => toast({ tone: "error", title: c.ledger.exportFailed, body: (e as Error).message }),
  });

  return (
    <Page wide>
      <PageHeader
        title={c.title}
        description={c.description}
        actions={
          <Button icon={<Download size={14} aria-hidden />} onClick={() => exportCsv.mutate()} loading={exportCsv.isPending} disabled={!isAdmin} title={isAdmin ? undefined : c.ledger.exportAdminOnly}>
            {c.ledger.export}
          </Button>
        }
      />
      <p className={s.disclaimer}>
        {demo ? (
          <>
            <DemoTag /> {c.disclaimerDemo}
          </>
        ) : (
          c.disclaimer
        )}
      </p>

      <div className={s.page}>
        <BudgetsSection query={budgets} />

        <div className={s.controls}>
          <div className={s.toolbar} role="group" aria-label={c.range.label}>
            <span className={s.toolLabel} aria-hidden>
              {c.range.label}
            </span>
            <Segmented<Range> label={c.range.label} value={range} onChange={setRange} options={[{ value: "7d", label: c.range.d7 }, { value: "30d", label: c.range.d30 }]} />
            <Button size="sm" className={s.filtersToggle} aria-expanded={filtersOpen} aria-controls="usage-filters" onClick={() => setFiltersOpen((v) => !v)}>
              {c.filters.toggle(activeFilters)}
            </Button>
          </div>
          <div id="usage-filters" className={cx(s.filtersWrap, filtersOpen && s.filtersOpen)}>
            <UsageFilters value={filters} onChange={setFilters} />
          </div>
        </div>

        <QueryState query={report}>
          {(r) => (
            <div className={cx(s.stack, report.isPlaceholderData && s.stale)} aria-busy={report.isFetching || undefined}>
              <UsageKpis report={r} daily30={daily30} workspaceBudget={workspaceBudget} />
              <DailyChart daily={r.daily} rangeLabel={range === "7d" ? c.range.d7 : c.range.d30} />
              <section aria-labelledby="usage-groups-h">
                <SectionHead id="usage-groups-h" title={c.groups.title} />
                <div className={s.groupBar}>
                  <Select label={c.groupBy.label} value={groupBy} onChange={(e) => setGroupBy(e.target.value as UsageGroupBy)} options={GROUPS.map((g) => ({ value: g, label: c.groupBy[g] }))} />
                </div>
                {r.groups.length ? <GroupsTable groups={r.groups} groupBy={r.query.groupBy} /> : <EmptyState title={c.groups.empty} body={c.groups.emptyBody} />}
              </section>

              <details className={s.technical} onToggle={(e) => setTechOpen(e.currentTarget.open)}>
                <summary>
                  <span className={s.technicalTitle}>{c.technical.title}</span>
                  <span className={s.muted}>{c.technical.summary}</span>
                </summary>
                {techOpen ? (
                  <div className={s.technicalBody}>
                    <TokenTotals totals={r.totals} />
                    {r.groups.length ? (
                      <Card>
                        <h3 className={s.cardTitle}>{c.groups.tokensTitle}</h3>
                        <GroupsTable groups={r.groups} groupBy={r.query.groupBy} variant="tokens" />
                      </Card>
                    ) : null}
                    <LedgerSection range={range} modelKey={filters.modelKey} />
                  </div>
                ) : null}
              </details>
            </div>
          )}
        </QueryState>
      </div>
    </Page>
  );
}
