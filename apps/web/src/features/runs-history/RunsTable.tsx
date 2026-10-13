import type { RunSummary } from "@atlas/contracts";
import { formatDateTime, modelName, money, relativeTime } from "@/lib/format";
import { activityCopy as c } from "@/copy/activity";
import { StatusBadge, Table, numCell } from "@/components/ui";
import s from "./runs-history.module.css";

/** Compact cost: "—" for local runs (no provider charge), never zero for unknown costs. */
function CostCell({ r }: { r: RunSummary }) {
  const demo = r.label === "DEMO" ? (
    <span className={s.demoCell} title={c.demoCellTitle}>
      {" "}
      · {c.demoCell}
    </span>
  ) : null;
  if (r.costStatus === "no_provider_charge") {
    return (
      <span title={c.costLocal}>
        <span aria-hidden>—</span>
        <span className="sr-only">{c.costLocal}</span>
        {demo}
      </span>
    );
  }
  if (r.costStatus === "unknown" || r.costNanoUsd === null) return <span className={s.unknown}>{c.costUnknown}{demo}</span>;
  const v = money(r.costNanoUsd);
  return (
    <span>
      {r.costStatus === "estimated" ? c.costEstimated(v) : v}
      {demo}
    </span>
  );
}

export function RunsTable({ rows, selectedId, onSelect, projectName }: { rows: RunSummary[]; selectedId: string | null; onSelect: (id: string) => void; projectName: Map<string, string> }) {
  const k = c.cols;
  return (
    <Table stack caption={c.caption}>
      <thead>
        <tr>
          <th scope="col">{k.objective}</th>
          <th scope="col">{k.status}</th>
          <th scope="col">{k.agent}</th>
          <th scope="col">{k.model}</th>
          <th scope="col">{k.started}</th>
          <th scope="col" className={numCell}>{k.cost}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const active = r.id === selectedId;
          return (
            <tr key={r.id} className={active ? s.activeRow : undefined}>
              <td className={s.objectiveCell}>
                <button type="button" className={s.rowButton} aria-current={active ? "true" : undefined} onClick={() => onSelect(r.id)}>
                  {r.objective}
                </button>
                <div className={s.sub}>{projectName.get(r.projectId) ?? r.projectId}</div>
              </td>
              <td data-label={k.status}>
                <StatusBadge kind="run" status={r.status} />
              </td>
              <td data-label={k.agent}>{r.agentName}</td>
              <td data-label={k.model}>{modelName(r.modelKey)}</td>
              <td className={s.nowrap} data-label={k.started}>
                <time dateTime={r.startedAt} title={formatDateTime(r.startedAt)}>
                  {relativeTime(r.startedAt)}
                </time>
              </td>
              <td className={numCell} data-label={k.cost}>
                <CostCell r={r} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
