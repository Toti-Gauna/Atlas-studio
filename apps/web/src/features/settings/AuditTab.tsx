"use client";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useCan } from "@/lib/state/session";
import { EmptyState, QueryState, SectionHead, StatePanel, Table } from "@/components/ui";
import { copy } from "@/copy/en";
import { settingsCopy as c } from "@/copy/settings";
import s from "./settings.module.css";

export function AuditTab() {
  const isAdmin = useCan("settings.admin");
  const audit = useQuery({ queryKey: ["audit"], queryFn: api.audit, enabled: isAdmin });
  return (
    <section aria-labelledby="audit-h" className={s.stack}>
      <SectionHead id="audit-h" title={c.audit.heading} aside={c.audit.note} />
      {!isAdmin ? (
        <StatePanel tone="warn" icon={<Lock size={22} />} title={copy.states.forbiddenTitle} body={copy.states.forbiddenBody} />
      ) : (
        <QueryState query={audit} isEmpty={(d) => d.length === 0} empty={<EmptyState title={c.audit.empty} />}>
          {(events) => (
            <Table stack caption={c.audit.caption}>
              <thead>
                <tr>
                  <th scope="col">{c.audit.when}</th>
                  <th scope="col">{c.audit.actor}</th>
                  <th scope="col">{c.audit.action}</th>
                  <th scope="col">{c.audit.target}</th>
                  <th scope="col">{c.audit.request}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className={s.nowrap}>{formatDateTime(e.createdAt)}</td>
                    <td data-label={c.audit.actor}>{e.actorName}</td>
                    <td className="mono" data-label={c.audit.action}>{e.action}</td>
                    <td className="mono" data-label={c.audit.target}>{e.target}</td>
                    <td className="mono" data-label={c.audit.request}>{e.requestId}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </QueryState>
      )}
    </section>
  );
}
