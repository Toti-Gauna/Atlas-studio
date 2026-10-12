"use client";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import type { UsageGroupBy, UsageQuery } from "@atlas/contracts";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useCan } from "@/lib/state/session";
import { copy } from "@/copy/en";
import { usageCopy as c } from "@/copy/usage";
import { Page } from "@/components/shell/StudioShell";
import { Button, Callout, DemoTag, EmptyState, PageHeader, QueryState, Segmented, useToast } from "@/components/ui";
import { downloadBlob } from "@/features/artifacts/useArtifactActions";
import { UsageFilters, type UsageFilterState } from "./UsageFilters";
import { UsageKpis } from "./UsageKpis";
import { DailyChart } from "./DailyChart";
import { GroupsTable } from "./GroupsTable";
import { LedgerSection } from "./LedgerSection";
import { BudgetsSection } from "./BudgetsSection";
import s from "./usage.module.css";

type Range = "7d" | "30d";

/** FinOps (R09): DEMO usage of Atlas API calls only, priced per attempt. */
export function UsageView() {
  const toast = useToast();
  const isAdmin = useCan("budget.admin");
  const [range, setRange] = useState<Range>("30d");
  const [groupBy, setGroupBy] = useState<UsageGroupBy>("model");
  const [filters, setFilters] = useState<UsageFilterState>({});
  const query: UsageQuery = { range, groupBy, ...filters };
  const report = useQuery({ queryKey: ["usage", query], queryFn: () => api.usage.report(query), placeholderData: keepPreviousData });

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

      <div className={s.toolbar} role="group" aria-label={c.filters.title}>
        <span className={s.toolLabel} aria-hidden>{c.range.label}</span>
        <Segmented<Range> label={c.range.label} value={range} onChange={setRange} options={[{ value: "7d", label: c.range.d7 }, { value: "30d", label: c.range.d30 }]} />
        <span className={s.toolLabel} aria-hidden>{c.groupBy.label}</span>
        <Segmented<UsageGroupBy>
          label={c.groupBy.label}
          value={groupBy}
          onChange={setGroupBy}
          options={(["model", "agent", "project", "user", "provider", "day"] as const).map((g) => ({ value: g, label: c.groupBy[g] }))}
        />
      </div>
      <UsageFilters value={filters} onChange={setFilters} />

      <QueryState query={report}>
        {(r) => (
          <div className={s.stack} style={{ opacity: report.isPlaceholderData ? 0.6 : 1 }} aria-busy={report.isFetching || undefined}>
            <Callout tone="warn">
              <strong>
                <DemoTag /> {r.disclaimer}
              </strong>
              <div style={{ marginTop: 4 }}>{copy.disclaimers.finops}</div>
              <div className={s.muted} style={{ marginTop: 4 }}>
                {formatDate(r.from)} – {formatDate(r.to)}
              </div>
            </Callout>
            <UsageKpis totals={r.totals} />
            <DailyChart daily={r.daily} rangeLabel={range === "7d" ? c.range.d7 : c.range.d30} />
            {r.groups.length ? <GroupsTable groups={r.groups} groupBy={r.query.groupBy} /> : <EmptyState title={c.groups.empty} body={c.groups.emptyBody} />}
          </div>
        )}
      </QueryState>

      <LedgerSection range={range} modelKey={filters.modelKey} />
      <BudgetsSection />
    </Page>
  );
}
