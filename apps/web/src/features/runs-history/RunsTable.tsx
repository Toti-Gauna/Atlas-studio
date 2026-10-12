import type { RunSummary } from "@atlas/contracts";
import { formatDateTime, modelName, ms, relativeTime } from "@/lib/format";
import { runHistoryCopy as c } from "@/copy/deliverables";
import { Badge, DemoTag, Table, numCell } from "@/components/ui";
import { RUN_TONE, costLabel } from "@/features/runs/RunTrace";
import s from "./runs-history.module.css";

export function RunsTable({ rows, selectedId, onSelect, projectName }: { rows: RunSummary[]; selectedId: string | null; onSelect: (id: string) => void; projectName: Map<string, string> }) {
  return (
    <Table caption={c.caption}>
      <thead>
        <tr>
          <th scope="col">Objective</th>
          <th scope="col">Status</th>
          <th scope="col">Agent</th>
          <th scope="col">Model</th>
          <th scope="col">Mode</th>
          <th scope="col">Started</th>
          <th scope="col" className={numCell}>Latency</th>
          <th scope="col" className={numCell}>Cost</th>
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
                <div className={s.sub}>
                  {projectName.get(r.projectId) ?? r.projectId}
                  {r.label === "DEMO" ? <DemoTag /> : null}
                </div>
              </td>
              <td>
                <Badge tone={RUN_TONE[r.status]}>{r.status.replace(/_/g, " ")}</Badge>
              </td>
              <td>{r.agentName}</td>
              <td>{modelName(r.modelKey)}</td>
              <td>
                <Badge tone={r.mode === "local" ? "teal" : "info"}>{r.mode === "local" ? c.local : c.connected}</Badge>
              </td>
              <td className={s.nowrap}>
                <time dateTime={r.startedAt} title={formatDateTime(r.startedAt)}>{relativeTime(r.startedAt)}</time>
              </td>
              <td className={numCell}>{ms(r.latencyMs)}</td>
              <td className={numCell}>{costLabel(r.costStatus, r.costNanoUsd)}</td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
